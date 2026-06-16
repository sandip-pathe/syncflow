#api/approvals.py

"""Approval API - enhanced with multi-approver support"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from temporalio.client import Client
from typing import List
from app.core.config import settings
from app.core.database import get_db
from app.models.workflow import ApprovalRequest, Execution, Workflow
from app.schemas.workflow import ApprovalResponseSchema
from app.services.local_execution import LocalWorkflowExecutor
from app.temporal.workflows import OrchestrationWorkflow

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.post("/{execution_id}/approve")
async def respond_to_approval(
    execution_id: str,
    response: ApprovalResponseSchema,
    db: Session = Depends(get_db)
):
    approval = db.query(ApprovalRequest).filter(
        ApprovalRequest.execution_id == execution_id,
        ApprovalRequest.status == "pending"
    ).first()
    
    if not approval:
        raise HTTPException(404, "Approval request not found")
    
    if response.action not in {"approve", "reject"}:
        raise HTTPException(400, "Invalid action")
    
    if not approval.approval_data:
        approval.approval_data = {"responses": []}
    
    approval.approval_data["responses"].append({
        "approver": response.approver,
        "action": response.action,
        "comment": response.comment,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Check if approval threshold is met
    approval_type = approval.approval_data.get("approval_type", "any")
    total_approvers = approval.approval_data.get("total_approvers", 1)
    responses = approval.approval_data["responses"]
    
    approvals = [r for r in responses if r["action"] == "approve"]
    rejections = [r for r in responses if r["action"] == "reject"]
    
    should_proceed = False
    final_status = "pending"
    
    if approval_type == "any":
        # Any approval proceeds
        if len(approvals) > 0:
            should_proceed = True
            final_status = "approved"
        elif len(rejections) > 0:
            should_proceed = True
            final_status = "rejected"
    
    elif approval_type == "all":
        # All must approve
        if len(rejections) > 0:
            should_proceed = True
            final_status = "rejected"
        elif len(approvals) == total_approvers:
            should_proceed = True
            final_status = "approved"
    
    elif approval_type == "majority":
        # Majority wins
        if len(responses) >= total_approvers:
            if len(approvals) > len(rejections):
                should_proceed = True
                final_status = "approved"
            else:
                should_proceed = True
                final_status = "rejected"
    
    if should_proceed:
        approval.status = final_status
        approval.resolved_at = datetime.now(timezone.utc)
        db.commit()

        if settings.EXECUTION_BACKEND.lower() == "local":
            execution = db.query(Execution).filter(Execution.id == execution_id).first()
            if not execution:
                raise HTTPException(404, "Execution not found")
            workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
            if not workflow:
                raise HTTPException(404, "Workflow not found")

            result = LocalWorkflowExecutor().resume_after_approval(
                db=db,
                workflow_def=workflow.definition,
                execution=execution,
                approval=approval,
                approval_result={
                    "action": final_status,
                    "approver": response.approver,
                    "comment": response.comment,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            return {
                "status": final_status,
                "execution_id": execution_id,
                "execution_status": result.get("status"),
                "execution_backend": "local",
                "events": result.get("events", []),
                "output": result.get("output"),
            }
        
        # Signal Temporal workflow with proper authentication
        if settings.TEMPORAL_API_KEY:
            client = await Client.connect(
                settings.TEMPORAL_HOST,
                namespace=settings.TEMPORAL_NAMESPACE,
                api_key=settings.TEMPORAL_API_KEY,
                tls=True
            )
        else:
            client = await Client.connect(
                settings.TEMPORAL_HOST,
                namespace=settings.TEMPORAL_NAMESPACE
            )
        
        handle = client.get_workflow_handle(execution_id)
        
        signal_data = {
             "action": final_status,
             "approver": response.approver,
             "comment": response.comment,
             "timestamp": datetime.now(timezone.utc).isoformat(),
             # Optionally include all responses if workflow needs them
        }
        await handle.signal(
            "approval_signal", # <-- Pass the signal name as a string
            signal_data
        )

        return {"status": final_status, "execution_id": execution_id}
    else:
        db.commit()
        return {"status": "pending", "execution_id": execution_id, "waiting_for_more": True}

@router.get("/pending")
async def get_pending_approvals(db: Session = Depends(get_db)):
    """Get all pending approvals"""
    approvals = db.query(ApprovalRequest).filter(
        ApprovalRequest.status == "pending"
    ).all()
    
    return [
        {
            "id": a.id,
            "execution_id": a.execution_id,
            "node_id": a.node_id,
            "requested_at": a.requested_at,
            "approval_data": a.approval_data
        }
        for a in approvals
    ]
