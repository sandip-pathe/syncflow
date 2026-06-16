"""Node type definitions and JSON schemas"""
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class NodeType(str, Enum):
    TRIGGER = "trigger"
    AGENT = "agent"
    API_CALL = "api_call"
    APPROVAL = "approval"
    CONDITIONAL = "conditional"
    MERGE = "merge"
    EVENT = "event"
    TIMER = "timer"
    EVAL = "eval"
    END = "end"

# --- Specific Node Configs ---

class TriggerConfig(BaseModel):
    """Trigger node - Entry point of the workflow"""
    name: str = Field(..., description="Name identifies the trigger node")
    type: str = Field("manual", description="Type of trigger (manual/event)")
    input_text: Optional[str] = Field(None, description="Simple user input text")
    input_json: Optional[Dict[str, Any]] = Field(None, description="Structured data for LLMs or API calls")

class AgentConfig(BaseModel):
    """Agent node - Executes LLM/AI reasoning step"""
    name: str = Field(..., description="Name identifies the agent step")
    temperature: Optional[float] = Field(0.7, description="Controls creativity (0.0-1.0)")
    system_instructions: str = Field(..., description="Defines model behavior")
    expected_output_format: Optional[str] = Field(None, description="Ensures predictable downstream parsing")
    # Legacy fields for backward compatibility
    provider: Optional[str] = Field("openai", description="AI provider (e.g., openai, anthropic, external)")
    agent_id: Optional[str] = Field("gpt-4o-mini", description="Specific agent/model ID")

class ApiCallConfig(BaseModel):
    """API Call node - Integrates external APIs or internal services"""
    name: str = Field(..., description="Name identifies the API call step")
    url: str = Field(..., description="Points to endpoint")
    method: str = Field("POST", description="HTTP method (GET, POST, PUT, DELETE, etc.)")
    headers: Optional[Dict[str, str]] = Field(default_factory=dict, description="Support auth/content-type")
    body: Optional[Dict[str, Any]] = Field(None, description="Passes payload data (optional for GET)")

class ConditionalConfig(BaseModel):
    """Conditional node - Branches workflow based on logic"""
    name: str = Field(..., description="Name identifies the conditional step")
    condition_expression: str = Field(..., description="Evaluates runtime state to determine flow path")

class EndConfig(BaseModel):
    """End node - Marks workflow completion"""
    name: str = Field(..., description="Name identifies the end node")
    capture_output: Optional[bool] = Field(False, description="Allows saving result")
    show_output: Optional[bool] = Field(True, description="Allows UI display to user")

class ApprovalConfig(BaseModel):
    """Approval node - On-screen checkpoint for user decision"""
    name: str = Field(..., description="Name identifies the approval step")
    description: str = Field(..., description="Gives context to the user")

class EvalConfig(BaseModel):
    """Eval node - Validates output correctness or structure"""
    name: str = Field(..., description="Name identifies the eval step")
    eval_type: str = Field(..., description="Selects strategy (schema, llm_judge, policy)")
    config: Dict[str, Any] = Field(default_factory=dict, description="Passes thresholds/rules")
    on_failure: str = Field("block", description="Defines fallback behavior (block, warn, retry, compensate)")

class MergeConfig(BaseModel):
    """Merge node - Combines outputs from multiple parallel branches"""
    name: str = Field(..., description="Name identifies the merge step")
    merge_strategy: str = Field("combine", description="Defines how branch results are reconciled (combine, first, vote)")

class EventConfig(BaseModel):
    """Event node - Publishes or subscribes to events for async workflows"""
    name: str = Field(..., description="Name identifies the event step")
    operation: str = Field("publish", description="Selects publish/subscribe")
    channel: str = Field(..., description="Acts as topic key")

class TimerConfig(BaseModel):
    """Timer node - Pauses workflow for a fixed period"""
    name: str = Field(..., description="Name identifies the timer step")
    duration_seconds: int = Field(..., description="Controls delay timing")

# --- Update the Master Registry ---
NODE_TYPE_SCHEMAS = {
    NodeType.TRIGGER: TriggerConfig,
    NodeType.AGENT: AgentConfig,
    NodeType.API_CALL: ApiCallConfig,
    NodeType.APPROVAL: ApprovalConfig,
    NodeType.CONDITIONAL: ConditionalConfig,
    NodeType.MERGE: MergeConfig,
    NodeType.TIMER: TimerConfig,
    NodeType.EVENT: EventConfig,
    NodeType.EVAL: EvalConfig,
    NodeType.END: EndConfig,
}

def get_node_type_info(node_type: str) -> Dict[str, Any]:
    """Get JSON schema for node type"""
    try:
        node_type_enum = NodeType(node_type)
    except ValueError:
        return {}

    schema_class = NODE_TYPE_SCHEMAS[node_type_enum]
    return {
        "type": node_type,
        "name": node_type.capitalize().replace("_", " "),
        "schema": schema_class.model_json_schema(),
        "description": schema_class.__doc__ or f"{node_type} node"
    }

def get_all_node_types() -> List[Dict[str, Any]]:
    """Get all node types with schemas"""
    return [get_node_type_info(nt.value) for nt in NodeType]
