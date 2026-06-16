from unittest.mock import MagicMock

from app.models.workflow import ApprovalRequest, Execution
from app.services.local_execution import LocalWorkflowExecutor


def _approval_without_reject_workflow():
    return {
        "nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "data": {
                    "label": "Input",
                    "config": {"name": "Input", "type": "manual"},
                },
            },
            {
                "id": "approval",
                "type": "approval",
                "data": {
                    "label": "Review",
                    "config": {
                        "name": "Review",
                        "description": "Approve before writing",
                        "approver_email": "approvals@syncflow.local",
                    },
                },
            },
            {
                "id": "writer",
                "type": "agent",
                "data": {
                    "label": "Writer",
                    "config": {"name": "Writer", "system_instructions": "Write"},
                },
            },
            {
                "id": "end",
                "type": "end",
                "data": {"label": "End", "config": {"name": "End"}},
            },
        ],
        "edges": [
            {"id": "e1", "source": "trigger", "target": "approval"},
            {
                "id": "e2",
                "source": "approval",
                "target": "writer",
                "sourceHandle": "approve",
            },
            {"id": "e3", "source": "writer", "target": "end"},
        ],
    }


def test_rejected_approval_without_reject_edge_stops_before_downstream_nodes():
    # Regression: ISSUE-001 - rejected approval still followed the approve path.
    # Found by /qa on 2026-06-16.
    # Report: .gstack/qa-reports/qa-report-localhost-2026-06-16.md
    db = MagicMock()
    execution = Execution(
        id="exec-reject",
        workflow_id="workflow-reject",
        status="running",
        input_data={"input_text": "Needs review"},
    )
    executor = LocalWorkflowExecutor()
    workflow = _approval_without_reject_workflow()

    start_result = executor.start(
        db=db,
        workflow_id="workflow-reject",
        workflow_def=workflow,
        execution=execution,
        input_data={"input_text": "Needs review"},
    )

    approval = ApprovalRequest(
        id=start_result["pending_approval"]["id"],
        execution_id="exec-reject",
        node_id="approval",
        status="approved",
        approval_data={"responses": []},
    )
    resume_result = executor.resume_after_approval(
        db=db,
        workflow_def=workflow,
        execution=execution,
        approval=approval,
        approval_result={
            "action": "rejected",
            "approver": "approvals@syncflow.local",
            "comment": "Do not continue",
        },
    )

    event_types = [event["event_type"] for event in resume_result["events"]]

    assert resume_result["status"] == "failed"
    assert execution.status == "failed"
    assert "approval.denied" in event_types
    assert "workflow.failed" in event_types
    assert resume_result["output"]["audit"]["approval"]["action"] == "rejected"
    assert "writer" not in execution.output_data["local_state"]["node_outputs"]
