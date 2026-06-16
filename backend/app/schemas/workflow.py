"""Enhanced workflow schemas"""
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class NodeSchema(BaseModel):
    id: str
    type: str
    data: Dict[str, Any] = {}
    position: Optional[Dict[str, float]] = None

class EdgeSchema(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    condition: Optional[str] = None

class WorkflowCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]

class WorkflowExecuteSchema(BaseModel):
    input_data: Dict[str, Any] = {}

class ApprovalResponseSchema(BaseModel):
    action: str = Field(..., description="approve|reject")
    approver: str = Field(..., description="Approver email or ID")
    comment: Optional[str] = None

class WorkflowUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[NodeSchema]] = None
    edges: Optional[List[EdgeSchema]] = None
