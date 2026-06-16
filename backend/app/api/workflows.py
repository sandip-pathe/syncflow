#api/workflows.py

"""Workflow API endpoints - enhanced with pause/resume/reset"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session
from temporalio.client import Client
from uuid import uuid4
from app.core.database import get_db
from app.core.config import settings
from app.models.workflow import Workflow, Execution
from app.schemas.workflow import WorkflowCreateSchema, WorkflowExecuteSchema, WorkflowUpdateSchema
from app.temporal.workflows import OrchestrationWorkflow
from app.services.local_execution import LocalWorkflowExecutor
from app.services.validation import validate_workflow

router = APIRouter(prefix="/workflows", tags=["workflows"])

async def get_temporal_client() -> Client:
    """Get Temporal client with proper authentication"""
    if settings.TEMPORAL_API_KEY:
        # Temporal Cloud with API Key (recommended)
        return await Client.connect(
            settings.TEMPORAL_HOST,
            namespace=settings.TEMPORAL_NAMESPACE,
            api_key=settings.TEMPORAL_API_KEY,
            tls=True
        )
    else:
        # Local Temporal or self-hosted
        return await Client.connect(
            settings.TEMPORAL_HOST,
            namespace=settings.TEMPORAL_NAMESPACE
        )

# --- [NEW ENDPOINT] ---
@router.get("/")
async def list_workflows(
    session_id: str | None = None,
    db: Session = Depends(get_db)
):
    """List available workflow definitions
    - Templates (is_template=true) are shown to everyone
    - User workflows filtered by session_id (only if provided)
    """
    query = db.query(Workflow).order_by(desc(Workflow.updated_at))
    
    if session_id:
        # Show templates + session workflows
        query = query.filter(
            (Workflow.is_template == "true") | (Workflow.session_id == session_id)
        )
    else:
        # Show only templates if no session
        query = query.filter(Workflow.is_template == "true")
    
    workflows = query.all()
    workflows.sort(
        key=lambda workflow: (
            workflow.id != "template-private-market-diligence",
            workflow.name.lower(),
        )
    )
    return {"items": workflows}

@router.delete("/session/{session_id}")
async def cleanup_session(session_id: str, db: Session = Depends(get_db)):
    """Delete all workflows for a session (called when browser tab closes)"""
    deleted = db.query(Workflow).filter(
        Workflow.session_id == session_id,
        Workflow.is_template == "false"
    ).delete()
    db.commit()
    return {"deleted": deleted, "session_id": session_id}

@router.post("/")
async def create_workflow(
    workflow: WorkflowCreateSchema,
    session_id: str | None = None,
    db: Session = Depends(get_db)
):
    """Create new workflow definition
    - If session_id provided, workflow belongs to that session (temporary)
    - Otherwise marked as template (permanent)
    """
    workflow_id = str(uuid4())
    db_workflow = Workflow(
        id=workflow_id,
        name=workflow.name,
        description=workflow.description,
        definition={
            "nodes": [n.dict() for n in workflow.nodes],
            "edges": [e.dict() for e in workflow.edges]
        },
        session_id=session_id,  # Link to session
        is_template="false" if session_id else "true"  # Only permanent if no session
    )
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    
    # Return full workflow object for immediate use
    return {
        "id": db_workflow.id,
        "name": db_workflow.name,
        "description": db_workflow.description,
        "definition": db_workflow.definition,
        "created_at": db_workflow.created_at,
        "updated_at": db_workflow.updated_at
    }

@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """Get workflow definition"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    
    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "definition": workflow.definition,
        "created_at": workflow.created_at
    }

@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    execute_request: WorkflowExecuteSchema,
    db: Session = Depends(get_db)
):
    """Start workflow execution"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    
    execution_id = str(uuid4())
    
    # Create execution record
    execution = Execution(
        id=execution_id,
        workflow_id=workflow_id,
        status="running",
        input_data=execute_request.input_data
    )
    
    # FIX: Pass the workflow.definition to the validation function
    errors = validate_workflow(workflow.definition)
    if errors:
        print(f"Workflow validation errors for {workflow_id}:")
        for error in errors:
            print(f"   - {error}")
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Workflow validation failed",
                "errors": errors
            },
        )
    
    db.add(execution)
    db.commit()

    if settings.EXECUTION_BACKEND.lower() == "local":
        result = LocalWorkflowExecutor().start(
            db=db,
            workflow_id=workflow_id,
            workflow_def=workflow.definition,
            execution=execution,
            input_data=execute_request.input_data,
        )
        return {
            "execution_id": execution_id,
            "workflow_id": workflow_id,
            "status": result["status"],
            "execution_backend": "local",
            "events": result.get("events", []),
            "output": result.get("output"),
            "pending_approval": result.get("pending_approval"),
        }
    
    # Start Temporal workflow
    client = await get_temporal_client()
    
    handle = await client.start_workflow(
        OrchestrationWorkflow.run,
        args=[workflow_id, workflow.definition, execute_request.input_data],
        id=execution_id,
        task_queue="orchestration-queue"
    )
    
    return {
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        "status": "running",
        "execution_backend": "temporal",
    }

@router.post("/{workflow_id}/pause")
async def pause_execution(workflow_id: str, execution_id: str):
    """Pause running workflow execution"""
    client = await get_temporal_client()
    try:
        handle = client.get_workflow_handle(execution_id)
        await handle.signal("pause")
        return {"status": "pause_signal_sent", "execution_id": execution_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to send pause signal: {str(e)}")

@router.post("/{workflow_id}/resume")
async def resume_execution(workflow_id: str, execution_id: str):
    """Resume paused workflow execution"""
    client = await get_temporal_client()
    try:
        handle = client.get_workflow_handle(execution_id)
        await handle.signal("resume")
        return {"status": "resume_signal_sent", "execution_id": execution_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to send resume signal: {str(e)}")

@router.get("/{workflow_id}/history")
async def get_workflow_history(workflow_id: str, execution_id: str):
    """Get workflow execution history from Temporal"""
    client = await get_temporal_client()
    handle = client.get_workflow_handle(execution_id)
    
    try:
        # Query workflow state
        state = await handle.query(OrchestrationWorkflow.get_state)
        
        # Get event history from Temporal
        history = []
        history_result = await handle.fetch_history()
        for event in history_result.events:
            history.append({
                "event_id": event.event_id,
                "event_type": event.event_type,
                "timestamp": event.event_time
            })
        
        return {
            "execution_id": execution_id,
            "state": state,
            "history": history
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get history: {str(e)}")

@router.post("/{workflow_id}/compensate")
async def trigger_compensation(workflow_id: str, execution_id: str):
    """Manually trigger compensation/rollback"""
    # This would terminate workflow and trigger compensation
    client = await get_temporal_client()
    handle = client.get_workflow_handle(execution_id)
    
    try:
        await handle.terminate(reason="Manual compensation triggered")
        return {"status": "compensating", "execution_id": execution_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to compensate: {str(e)}")

@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    workflow_update: WorkflowUpdateSchema,
    db: Session = Depends(get_db)
):
    """Update an existing workflow definition"""
    db_workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not db_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Pydantic's exclude_unset is great for PATCH, but for PUT we want to update the whole definition.
    update_data = workflow_update.dict()

    if "name" in update_data:
        db_workflow.name = update_data["name"]
    if "description" in update_data:
        db_workflow.description = update_data["description"]

    transient_node_fields = {"status", "lastResult", "cost", "executionTime"}
    sanitized_nodes = []
    for node in update_data.get("nodes", []):
        node_data = dict(node.get("data") or {})
        for field in transient_node_fields:
            node_data.pop(field, None)
        sanitized_nodes.append({**node, "data": node_data})
    
    # Update the definition field with the new nodes and edges
    # This replaces the entire 'definition' JSONB field.
    db_workflow.definition = {
        "nodes": sanitized_nodes,
        "edges": [e for e in update_data.get("edges", [])]
    }

    db.commit()
    db.refresh(db_workflow)
    
    return {"id": db_workflow.id, "status": "updated"}


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """Delete workflow definition"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    
    db.delete(workflow)
    db.commit()
    
    return {"status": "deleted", "workflow_id": workflow_id}
