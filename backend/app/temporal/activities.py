"""Temporal activities - CORRECTED with await"""
from datetime import datetime, timezone
import json
from uuid import uuid4
from temporalio import activity
import httpx
import asyncio
from typing import Any, Counter, Dict, List, Optional
from app.services.agent_executor import AgentExecutor
from app.services.eval_service import EvalService
from app.services.compensation_service import CompensationService
from app.services.self_healing import SelfHealingService
from app.services.output_mapper import OutputMapper
from app.core.database import SessionLocal
from app.models.workflow import ApprovalRequest
from app.core.events import event_bus

eval_service = EvalService()
compensation_service = CompensationService()
self_healing_service = SelfHealingService()
agent_executor_util = AgentExecutor()
output_mapper = OutputMapper()

@activity.defn
async def execute_agent_node(node: dict, activity_context: dict) -> dict:
    """Execute agent node with intelligent input mapping."""
    node_data = node.get("data", {})
    node_config = node_data.get("config", {})
    
    # Extract config based on new schema
    name = node_config.get("name", "Unnamed Agent")
    system_instructions = node_config.get("system_instructions", "You are a helpful assistant.")
    temperature = node_config.get("temperature", 0.7)
    expected_output_format = node_config.get("expected_output_format")
    
    # Legacy support for provider/agent_id
    provider = node_config.get("provider", "openai")
    agent_id = node_config.get("agent_id", "gpt-4o-mini")
    
    # ✅ USE OUTPUT MAPPER to intelligently extract input
    # The previous_output is already a mapped BaseNodeOutput from workflow
    previous_output = activity_context.get("previous_output", {})
    
    # 🔍 DEBUG: Log what we received
    print(f"=== DEBUG AGENT {name} ===")
    print(f"previous_output type: {type(previous_output)}")
    print(f"previous_output value: {previous_output}")
    if isinstance(previous_output, dict):
        print(f"previous_output keys: {list(previous_output.keys())}")
    
    activity.logger.info(f"📥 Agent '{name}' previous_output type: {type(previous_output)}")
    activity.logger.info(f"📥 Agent '{name}' previous_output keys: {previous_output.keys() if isinstance(previous_output, dict) else 'N/A'}")
    
    # Prepare input_data for the agent based on what we received
    if isinstance(previous_output, dict):
        # If it's a dict, it might be from trigger or already formatted
        if "prompt" in previous_output:
            # Already has prompt field
            input_data = previous_output
        elif "input_text" in previous_output:
            # Trigger format
            input_data = {"prompt": previous_output.get("input_text", "")}
        elif "output" in previous_output:
            # Agent chaining - previous agent's output becomes this agent's prompt
            input_data = {"prompt": previous_output.get("output", "")}
        elif "body" in previous_output:
            # API response
            body = previous_output.get("body", {})
            input_data = {"prompt": f"Process this API response: {body}"}
        elif "current_item" in previous_output:
            # Loop iteration
            input_data = {"prompt": str(previous_output.get("current_item"))}
        else:
            # Generic dict - convert to prompt
            import json
            input_data = {"prompt": json.dumps(previous_output, indent=2)}
    else:
        # Fallback to string conversion
        input_data = {"prompt": str(previous_output)}

    activity.logger.info(f"Executing agent node '{name}' with model {agent_id}")
    print(f"📤 Agent '{name}' final input_data: {input_data}")
    activity.logger.info(f"📤 Agent '{name}' final input_data: {input_data}")

    result = await agent_executor_util.execute(
        name=name,
        system_instructions=system_instructions,
        input_data=input_data,
        temperature=temperature,
        expected_output_format=expected_output_format,
        provider=provider,
        agent_id=agent_id
    )

    return result

@activity.defn
async def get_fallback_agent(provider: str, failed_agent_id: str, all_agent_ids: List[str]) -> Optional[str]:
    """Activity to get a fallback agent using the self-healing service."""
    activity.logger.info(f"Getting fallback for failed agent {failed_agent_id}")
    return self_healing_service.get_alternate_agent(provider, failed_agent_id, all_agent_ids)

@activity.defn
async def compensate_node(node: dict, state: dict):
    """Activity to trigger compensation for a single node."""
    activity.logger.info(f"⏪ Compensating node {node.get('id')}")
    # state here is the full state passed from the workflow (_get_full_state())
    result = await compensation_service.compensate_node(
        node=node,
        execution_id=state.get("execution_id", ""),
        workflow_id=state.get("workflow_id", ""),
        state=state
    )
    activity.logger.info(f"Compensation result for node {node.get('id')}: {result}")

@activity.defn
async def execute_api_call_node(node: dict, activity_context: dict) -> dict:
    """Execute API Call node with intelligent input mapping."""
    node_data = node.get("data", {})
    node_config = node_data.get("config", {})
    
    # Extract config based on new schema
    name = node_config.get("name", "Unnamed API Call")
    url = node_config.get("url")
    method = node_config.get("method", "POST")
    headers = node_config.get("headers", {})
    body = node_config.get("body", {})
    
    if not url:
        raise ValueError(f"API Call node '{name}' requires a URL")

    # ✅ USE OUTPUT MAPPER to intelligently format request body
    previous_output = activity_context.get("previous_output", {})
    
    # Start with config body as base
    request_body = {**body}
    
    # Intelligently merge previous output based on its type
    if previous_output:
        if isinstance(previous_output, dict):
            if "output" in previous_output:
                # Agent output - use the text
                request_body["input"] = previous_output["output"]
                request_body["context"] = previous_output
            elif "body" in previous_output:
                # Another API response - chain it
                request_body["previous_response"] = previous_output["body"]
            elif "current_item" in previous_output:
                # Loop iteration
                request_body["item"] = previous_output["current_item"]
                request_body["iteration"] = previous_output.get("iteration", 0)
            elif "action" in previous_output:
                # Approval/HITL decision
                request_body["approval_action"] = previous_output["action"]
                request_body["approved_by"] = previous_output.get("approved_by", "system")
            else:
                # Generic dict merge
                request_body.update(previous_output)
        else:
            # String or other type
            request_body["input"] = str(previous_output)

    activity.logger.info(f"Executing API call '{name}' to {method} {url}")
    activity.logger.debug(f"Request body: {request_body}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                json=request_body if method != "GET" else None,
                headers=headers,
                timeout=60.0,
            )
            response.raise_for_status()
            result = {
                "status_code": response.status_code,
                "body": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
                "headers": dict(response.headers)
            }
        activity.logger.info(f"API call '{name}' successful: Status {result['status_code']}")
        return result
    except httpx.HTTPStatusError as e:
        activity.logger.error(f"API call '{name}' failed: Status {e.response.status_code}, Response: {e.response.text}")
        raise RuntimeError(f"API call failed with status {e.response.status_code}: {e.response.text}") from e
    except httpx.RequestError as e:
        activity.logger.error(f"API call '{name}' request error: {e}")
        raise RuntimeError(f"API call request error: {e}") from e


@activity.defn
async def execute_merge_node(node: dict, activity_context: dict) -> dict:
    """Merge results from parallel branches based on strategy."""
    node_config = node.get("data", {}).get("config", {})
    
    # Extract config based on new schema
    name = node_config.get("name", "Unnamed Merge")
    merge_strategy = node_config.get("merge_strategy", "combine")
    
    node_outputs = activity_context.get("node_outputs", {})
    incoming_branch_node_ids = activity_context.get("incoming_branch_node_ids", [])
    branch_results = [node_outputs.get(branch_id) for branch_id in incoming_branch_node_ids if branch_id in node_outputs]

    activity.logger.info(f"Merging results from branches {incoming_branch_node_ids} using strategy '{merge_strategy}'")

    merged_result: Any = None
    if not branch_results:
        activity.logger.warning(f"No branch results found for merge node '{name}'")
        merged_result = {"warning": "No branch results to merge", "results": []}

    elif merge_strategy == "combine":
        merged_result = {"merged_results": branch_results}

    elif merge_strategy == "first":
        merged_result = branch_results[0]

    elif merge_strategy == "vote":
        try:
            votes = [json.dumps(r, sort_keys=True) for r in branch_results]
        except TypeError:
             votes = [str(r) for r in branch_results]
        if votes:
            most_common_vote_str = Counter(votes).most_common(1)[0][0]
            try:
                winner = json.loads(most_common_vote_str)
            except json.JSONDecodeError:
                winner = most_common_vote_str
            merged_result = {"winner": winner, "all_votes": branch_results}
        else:
            merged_result = {"winner": None, "all_votes": []}

    else:
        activity.logger.warning(f"Unknown merge strategy '{merge_strategy}', defaulting to 'combine'")
        merged_result = {"merged_results": branch_results}

    activity.logger.info(f"Merge '{name}' completed")
    return merged_result


# --- NEW: publish_generic_event Activity ---
@activity.defn
async def publish_generic_event(event_type: str, data: Dict[str, Any]):
    """Publishes any event to the event bus."""
    # Ensure data doesn't contain non-serializable items if not already handled
    try:
        activity.logger.info(f"🔔 Publishing generic event: {event_type} with data keys: {list(data.keys())}")
        await event_bus.publish(event_type, data)
        activity.logger.info(f"✅ Published generic event: {event_type}")
        return {"status": "published", "event_type": event_type}
    except Exception as e:
        activity.logger.error(f"❌ Failed to publish generic event {event_type}: {e}")
        # Return a structured failure result rather than raising so workflow can decide retry behavior
        return {"status": "failed", "event_type": event_type, "error": str(e)}

@activity.defn
async def send_approval_request(node: dict, activity_context: dict) -> dict:
    """Send approval request (UI or external). Now uses activity_context."""
    # This was previously request_ui_approval, let's keep it general
    node_id = node.get("id")
    node_config = node.get("data", {}).get("config", {})
    # Get details from the node config defined in schemas/node_types.py
    title = node_config.get("title", "Approval Required")
    description = node_config.get("description") or node_config.get("message", "Please review and take action.")
    
    # Handle both approvers (array) and approver_email (single string) for backward compatibility
    approvers = node_config.get("approvers", [])
    if not approvers and node_config.get("approver_email"):
        approvers = [node_config.get("approver_email")]
    
    channels = node_config.get("channels", ["ui"]) # Default to UI event

    approval_id = str(uuid4())
    workflow_id = activity_context.get("workflow_id")
    execution_id = activity_context.get("execution_id")
    previous_output = activity_context.get("node_outputs", {}).get(activity_context.get("previous_node_id")) # Or get from history

    # Persist the request state
    db = SessionLocal()
    try:
        approval = ApprovalRequest(
            id=approval_id,
            execution_id=execution_id,
            node_id=node_id,
            status="pending",
            approval_data={ # Store context for display
                "title": title,
                "description": description,
                "context": previous_output,
                "approvers": approvers,
                "channels": channels,
            },
            requested_at=datetime.now(timezone.utc)
        )
        db.add(approval)
        db.commit()
    finally:
        db.close()

    # Publish event for UI/Notifications
    await event_bus.publish("approval.requested", {
        "workflow_id": workflow_id,
        "execution_id": execution_id,
        "node_id": node_id,
        "approval_id": approval_id,
        "title": title,
        "description": description,
        "context": previous_output, # Send context in the event too
    })



    activity.logger.info(f"Approval request '{approval_id}' sent for node {node_id}")
    return {"approval_id": approval_id, "status": "pending"}

@activity.defn
async def execute_eval_node(node: dict, activity_context: dict) -> dict:
    """Execute eval/compliance node with intelligent input mapping."""
    node_config = node.get("data", {}).get("config", {})
    
    # Extract config
    name = node_config.get("name", "Unnamed Eval")
    eval_type = node_config.get("eval_type", "schema")
    eval_specific_config = node_config.get("config", {})
    on_failure = node_config.get("on_failure", "block")
    
    # ✅ USE OUTPUT MAPPER to extract evaluation target
    previous_output = activity_context.get("previous_output", {})
    
    # Extract the actual content to evaluate based on previous node type
    if isinstance(previous_output, dict):
        if "output" in previous_output:
            # Agent output - evaluate the text
            input_to_evaluate = previous_output["output"]
        elif "body" in previous_output:
            # API response - evaluate the response
            input_to_evaluate = previous_output["body"]
        elif "value" in previous_output:
            # Generic value
            input_to_evaluate = previous_output["value"]
        else:
            # Evaluate entire object
            input_to_evaluate = previous_output
    else:
        input_to_evaluate = previous_output

    activity.logger.info(f"📊 Evaluating '{name}' using type '{eval_type}'")
    activity.logger.debug(f"Evaluation input: {input_to_evaluate}")

    result = await eval_service.evaluate(eval_type, input_to_evaluate, eval_specific_config)
    
    # Add on_failure to result for workflow to handle
    result["on_failure"] = on_failure

    return result

@activity.defn
async def execute_timer_node(node: dict, activity_context: dict) -> dict:
    """Logs start/end for timer node (actual sleep is in workflow)."""
    node_config = node.get("data", {}).get("config", {})
    
    # Extract config based on new schema
    name = node_config.get("name", "Unnamed Timer")
    duration_seconds = node_config.get("duration_seconds", 0)

    activity.logger.info(f"Timer node '{name}' activity started (wait duration: {duration_seconds}s)")

    return {"waited_seconds": duration_seconds}


@activity.defn
async def execute_event_node(node: dict, activity_context: dict) -> dict:
    """Publish or subscribe to event using new schema."""
    node_config = node.get("data", {}).get("config", {})
    
    # Extract config based on new schema
    name = node_config.get("name", "Unnamed Event")
    operation = node_config.get("operation", "publish")
    channel = node_config.get("channel")

    if not channel:
         raise ValueError(f"Event node '{name}' requires a 'channel' in its config")

    previous_output = activity_context.get("previous_output", {})

    if operation == "publish":
        payload = {
            "workflow_id": activity_context.get("workflow_id"),
            "execution_id": activity_context.get("execution_id"),
            "node_id": node.get("id"),
            "payload": previous_output
        }
        await event_bus.publish(channel, payload)
        activity.logger.info(f"Event node '{name}' published to channel '{channel}'")
        return {"operation": "published", "channel": channel}

    elif operation == "subscribe":
        activity.logger.warning(f"Event node '{name}': 'subscribe' operation is not fully implemented in this activity.")
        return {"operation": "subscribe_attempted", "channel": channel}

    else:
        raise ValueError(f"Unknown event operation: {operation}")


@activity.defn
async def execute_meta_node(node: dict, activity_context: dict) -> dict:
    """Execute meta-observability node."""
    node_config = node.get("data", {}).get("config", {})
    operation = node_config.get("operation", "observe")

    if operation == "observe":
        metrics = {
            # Example metrics - customize as needed
            "nodes_executed_count": len(activity_context.get("node_outputs", {})),
            "current_node_id": node.get("id"),
            "workflow_id": activity_context.get("workflow_id"),
            "execution_id": activity_context.get("execution_id"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metrics_to_capture": node_config.get("metrics_to_capture", [])
        }
        activity.logger.info(f"Meta observation: {metrics}")
        # Publishing event is now handled by the workflow using publish_generic_event
        return metrics
    else:
        activity.logger.warning(f"Meta operation '{operation}' not fully implemented.")
        return {"operation": operation, "status": "not_implemented"}


@activity.defn
async def publish_workflow_status(execution_id: str, workflow_id: str, status: str, result: Optional[Dict[str, Any]] = None, error: Optional[str] = None):
    """Publish workflow completion or failure event."""
    event_type = f"workflow.{status}"
    data = {
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        # Ensure result and error are serializable
        "result": result, # Already should be dict/serializable
        "error": error
    }
    activity.logger.info(f"🔔 Publishing workflow status: {event_type} for execution {execution_id}")
    await event_bus.publish(event_type, data)
    activity.logger.info(f"✅ Workflow status published successfully: {event_type}")


@activity.defn
async def request_ui_approval(node: dict, activity_context: dict) -> dict:
    """
    HITL (Human in the Loop) - Request human approval/input with intelligent context mapping.
    Supports approval decisions, form submissions, and manual interventions.
    """
    node_config = node.get("data", {}).get("config", {})
    
    # Extract config - support both description and message for backward compatibility
    name = node_config.get("name", "Human Review Required")
    description = node_config.get("description") or node_config.get("message", "Please review and take action.")
    approval_type = node_config.get("approval_type", "binary")  # binary, form, review
    required_fields = node_config.get("required_fields", [])  # For form type
    
    # ✅ USE OUTPUT MAPPER to format context intelligently
    previous_output = activity_context.get("previous_output", {})
    
    # Build rich context for human reviewer
    context = {"raw": previous_output}
    
    if isinstance(previous_output, dict):
        if "output" in previous_output:
            # Agent output - show the generated content
            context["type"] = "agent_output"
            context["content"] = previous_output["output"]
            context["model"] = previous_output.get("model", "unknown")
            context["cost"] = previous_output.get("cost", 0)
        elif "body" in previous_output:
            # API response - show the response
            context["type"] = "api_response"
            context["status_code"] = previous_output.get("status_code")
            context["response"] = previous_output["body"]
        elif "passed" in previous_output:
            # Eval result - show the evaluation
            context["type"] = "evaluation"
            context["passed"] = previous_output["passed"]
            context["score"] = previous_output.get("score")
            context["reason"] = previous_output.get("reason", "")
        else:
            # Generic data
            context["type"] = "data"
            context["data"] = previous_output
    else:
        context["type"] = "text"
        context["content"] = str(previous_output)
    
    approval_id = str(uuid4())

    # Publish HITL request event
    await event_bus.publish("approval.requested", {
        "workflow_id": activity_context.get("workflow_id"),
        "execution_id": activity_context.get("execution_id"),
        "node_id": node.get("id"),
        "approval_id": approval_id,
        "title": name,
        "description": description,
        "approval_type": approval_type,
        "required_fields": required_fields,
        "context": context
    })

    activity.logger.info(f"🙋 HITL approval '{approval_id}' requested for '{name}' (type: {approval_type})")
    return {"status": "hitl_approval_sent", "approval_id": approval_id, "approval_type": approval_type}
