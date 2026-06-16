# API And Events Reference

This document describes the current public API contract used by the SyncFlow
frontend.

## Base URLs

Frontend defaults:

| Setting | Default |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000` |

Backend defaults:

| Setting | Default |
| --- | --- |
| `EXECUTION_BACKEND` | `local` |
| `DATABASE_URL` | `sqlite:///./local-dev.sqlite3` |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `TEMPORAL_HOST` | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | `default` |
| `OPENAI_API_KEY` | `local-demo-key` |

## Workflow Endpoints

### `GET /api/workflows`

Lists templates and session workflows. Templates sort first, and the private
market diligence template is pinned to the top.

Response:

```json
{
  "items": [
    {
      "id": "template-private-market-diligence",
      "name": "Private Market Diligence Review",
      "description": "Extract claims, flag risks, require human approval, and draft an IC memo with audit-ready execution metadata.",
      "definition": {
        "nodes": [],
        "edges": []
      }
    }
  ]
}
```

### `POST /api/workflows`

Creates a workflow definition.

Request:

```json
{
  "name": "Calm Atlas 482",
  "description": "Blank workflow canvas for building AI automations.",
  "nodes": [],
  "edges": []
}
```

Response includes the generated workflow `id`, timestamps, and persisted
definition.

### `GET /api/workflows/{workflow_id}`

Returns one workflow definition.

### `POST /api/workflows/{workflow_id}/execute`

Starts execution.

Request:

```json
{
  "input_data": {
    "input_text": "Revenue grew 42% YoY and gross retention is above 90%.",
    "source_name": "sample-memo.txt"
  }
}
```

Temporal response:

```json
{
  "execution_id": "uuid",
  "workflow_id": "template-private-market-diligence",
  "status": "running",
  "execution_backend": "temporal"
}
```

Local response may include events, output, and pending approval:

```json
{
  "execution_id": "uuid",
  "workflow_id": "template-private-market-diligence",
  "status": "waiting_approval",
  "execution_backend": "local",
  "events": [
    {
      "event_type": "workflow.started",
      "timestamp": "2026-06-16T09:47:44.000000+00:00",
      "data": {
        "workflow_id": "template-private-market-diligence",
        "execution_id": "uuid"
      }
    }
  ],
  "output": null,
  "pending_approval": {
    "id": "uuid",
    "execution_id": "uuid",
    "node_id": "diligence-approval",
    "title": "Partner Review",
    "description": "Review flagged diligence risks before generating the IC memo section.",
    "context": {}
  }
}
```

Validation failures return HTTP 400:

```json
{
  "detail": {
    "message": "Workflow validation failed",
    "errors": ["Workflow must contain at least one trigger node"]
  }
}
```

## Approval Endpoint

### `POST /api/approvals/{execution_id}/approve`

Records an approval response. The request accepts `approve` or `reject`.

Request:

```json
{
  "action": "approve",
  "approver": "approvals@syncflow.local",
  "comment": "Risk framing approved."
}
```

Local approval response:

```json
{
  "status": "approved",
  "execution_id": "uuid",
  "execution_status": "completed",
  "execution_backend": "local",
  "events": [],
  "output": {
    "summary": "Local workflow completed with execution metadata.",
    "final_result": {},
    "audit": {
      "execution_id": "uuid",
      "approval": {},
      "eval_score": 0.88,
      "total_cost": 0.0085,
      "total_latency_ms": 1810,
      "nodes_executed": 6
    },
    "node_outputs": {}
  }
}
```

If local rejection has no reject edge, the response returns a stopped run:

```json
{
  "status": "rejected",
  "execution_status": "failed",
  "execution_backend": "local",
  "events": [
    {
      "event_type": "workflow.failed",
      "data": {
        "error": "Approval was rejected; workflow stopped before downstream nodes."
      }
    }
  ],
  "output": {
    "summary": "Local workflow failed with execution metadata.",
    "error": "Approval was rejected; workflow stopped before downstream nodes."
  }
}
```

Temporal approval response:

```json
{
  "status": "approved",
  "execution_id": "uuid"
}
```

## Event Names

Canonical event names:

| Event | Meaning | Node status impact |
| --- | --- | --- |
| `workflow.started` | Execution accepted | Workflow running |
| `node.started` | Node began execution | `running` |
| `node.completed` | Node completed successfully | `completed` |
| `node.failed` | Node failed | `failed` |
| `approval.requested` | Human review required | `waiting_approval` |
| `approval.granted` | Human approved | `completed` |
| `approval.denied` | Human rejected | `failed` |
| `workflow.completed` | Run completed | Completed mode/report |
| `workflow.failed` | Run stopped or failed | Failed report |

Legacy approval request names accepted by the frontend:

- `hitl.approval.requested`
- `ui.approval.requested`

## Event Shape

The local backend emits events in this shape:

```json
{
  "event_type": "node.completed",
  "timestamp": "2026-06-16T09:47:44.000000+00:00",
  "data": {
    "workflow_id": "template-private-market-diligence",
    "execution_id": "uuid",
    "node_id": "diligence-eval",
    "node_type": "eval",
    "result": {
      "passed": true,
      "score": 0.88,
      "reason": "Claims, risk flags, and approval context are present."
    }
  }
}
```

The frontend normalizes `event_type` or `eventType`, parses stringified `data`
when necessary, normalizes timestamps, and produces a stable
`ExecutionEvent`.

## Local Node Semantics

| Node type | Local behavior |
| --- | --- |
| `trigger` | Captures pasted/uploaded input and source name |
| `agent` | Returns deterministic demo output with model, token, cost, and latency metadata |
| `eval` | Returns deterministic pass/score/reason metadata |
| `approval` | Creates `ApprovalRequest`, pauses execution, returns `pending_approval` |
| `end` | Builds final report output |
| `api_call` | Simulates a 200 response without external calls |
| `conditional` | Simulates condition evaluation |
| `timer` | Records a simulated wait |
| `event` | Simulates pub/sub activity |
| `merge` | Combines prior node outputs |

## Frontend Consumption Contract

Local execute path:

1. `POST /execute`.
2. Normalize returned `events`.
3. Apply events to node state.
4. If `pending_approval` exists, open approval modal.
5. If `output` exists, open report modal and set completed mode.

Local approval path:

1. `POST /approvals/{execution_id}/approve`.
2. Keep modal open until the API succeeds.
3. Normalize continuation `events`.
4. Apply final `output`.
5. Open completed or failed report modal.

Temporal path:

1. `POST /execute`.
2. Store `execution_id`.
3. Listen for WebSocket events.
4. Normalize events through the same helper.
5. Update node statuses, approvals, and output from streamed events.
