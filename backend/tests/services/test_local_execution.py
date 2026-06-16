from unittest.mock import MagicMock

from app.models.workflow import ApprovalRequest, Execution
from app.services.local_execution import LocalWorkflowExecutor


def _approval_workflow():
    return {
        "nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "data": {
                    "label": "Diligence Notes",
                    "config": {"name": "Diligence Notes", "type": "manual"},
                },
            },
            {
                "id": "extract",
                "type": "agent",
                "data": {
                    "label": "Extract Claims & Risks",
                    "config": {"name": "Extract Claims & Risks"},
                },
            },
            {
                "id": "approval",
                "type": "approval",
                "data": {
                    "label": "Partner Review",
                    "config": {
                        "name": "Partner Review",
                        "description": "Approve risks",
                        "approver_email": "partner-review@syncflow.local",
                    },
                },
            },
            {
                "id": "memo",
                "type": "agent",
                "data": {
                    "label": "Draft IC Memo",
                    "config": {
                        "name": "Draft IC Memo",
                        "system_instructions": "Draft memo",
                    },
                },
            },
            {
                "id": "end",
                "type": "end",
                "data": {"label": "Done", "config": {"name": "Done"}},
            },
        ],
        "edges": [
            {"id": "e1", "source": "trigger", "target": "extract"},
            {"id": "e2", "source": "extract", "target": "approval"},
            {
                "id": "e3",
                "source": "approval",
                "target": "memo",
                "sourceHandle": "approve",
            },
            {"id": "e4", "source": "memo", "target": "end"},
        ],
    }


def _linear_eval_workflow():
    return {
        "nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "data": {
                    "label": "Diligence Notes",
                    "config": {"name": "Diligence Notes", "type": "manual"},
                },
            },
            {
                "id": "agent",
                "type": "agent",
                "data": {
                    "label": "Extract Claims & Risks",
                    "config": {"name": "Extract Claims & Risks"},
                },
            },
            {
                "id": "eval",
                "type": "eval",
                "data": {
                    "label": "Risk Completeness Eval",
                    "config": {"name": "Risk Completeness Eval"},
                },
            },
            {
                "id": "end",
                "type": "end",
                "data": {"label": "Done", "config": {"name": "Done"}},
            },
        ],
        "edges": [
            {"id": "e1", "source": "trigger", "target": "agent"},
            {"id": "e2", "source": "agent", "target": "eval"},
            {"id": "e3", "source": "eval", "target": "end"},
        ],
    }


def test_local_execution_completes_trigger_agent_eval_end():
    db = MagicMock()
    execution = Execution(
        id="exec-linear",
        workflow_id="workflow-linear",
        status="running",
        input_data={"input_text": "Revenue grew 42% YoY"},
    )

    result = LocalWorkflowExecutor().start(
        db=db,
        workflow_id="workflow-linear",
        workflow_def=_linear_eval_workflow(),
        execution=execution,
        input_data={"input_text": "Revenue grew 42% YoY"},
    )

    assert result["status"] == "completed"
    assert execution.status == "completed"
    assert result["output"]["audit"]["nodes_executed"] == 4
    assert result["output"]["audit"]["eval_score"] == 0.9
    assert result["output"]["audit"]["total_cost"] > 0
    assert "diligence" not in result["output"]["summary"].lower()
    assert (
        result["output"]["node_outputs"]["trigger"]["input_text"]
        == "Revenue grew 42% YoY"
    )


def test_local_execution_pauses_and_resumes_after_approval():
    db = MagicMock()
    execution = Execution(
        id="exec-1",
        workflow_id="workflow-1",
        status="running",
        input_data={"input_text": "Revenue grew 42% YoY"},
    )
    executor = LocalWorkflowExecutor()

    start_result = executor.start(
        db=db,
        workflow_id="workflow-1",
        workflow_def=_approval_workflow(),
        execution=execution,
        input_data={"input_text": "Revenue grew 42% YoY"},
    )

    assert start_result["status"] == "waiting_approval"
    assert start_result["pending_approval"]["node_id"] == "approval"
    assert start_result["pending_approval"]["context"]["claims"][0]["claim"] == (
        "Revenue grew 42% YoY."
    )
    assert "approval.requested" in [
        event["event_type"] for event in start_result["events"]
    ]
    assert "hitl.approval.requested" not in [
        event["event_type"] for event in start_result["events"]
    ]
    assert execution.status == "waiting_approval"
    assert execution.output_data["local_state"]["paused_node_id"] == "approval"

    approval = ApprovalRequest(
        id=start_result["pending_approval"]["id"],
        execution_id="exec-1",
        node_id="approval",
        status="approved",
        approval_data={"responses": []},
    )
    resume_result = executor.resume_after_approval(
        db=db,
        workflow_def=_approval_workflow(),
        execution=execution,
        approval=approval,
        approval_result={
            "action": "approved",
            "approver": "partner-review@example.com",
            "comment": "Looks good",
        },
    )

    assert resume_result["status"] == "completed"
    assert execution.status == "completed"
    assert resume_result["output"]["audit"]["approval"]["action"] == "approved"
    assert resume_result["output"]["audit"]["nodes_executed"] == 5
    assert "approval.granted" in [
        event["event_type"] for event in resume_result["events"]
    ]
