import type {
  ApprovalRequest,
  EventTypeName,
  ExecutionEvent,
  NodeStatus,
  WorkflowNode,
} from "@/types/workflow";

export interface BackendExecutionEvent {
  event_type?: string;
  eventType?: string;
  data?: string | Record<string, any>;
  timestamp?: string | number;
}

export interface PendingApprovalPayload {
  id?: string;
  execution_id?: string;
  node_id?: string;
  title?: string;
  description?: string;
  context?: Record<string, any>;
  requested_at?: string;
}

const APPROVAL_EVENT_TYPES = new Set([
  "approval.requested",
  "hitl.approval.requested",
  "ui.approval.requested",
]);

export function normalizeBackendEvent(
  raw: BackendExecutionEvent
): ExecutionEvent {
  const eventType = (raw.event_type || raw.eventType || "event") as EventTypeName;
  const eventData =
    typeof raw.data === "string" ? safeJsonParse(raw.data) : raw.data || {};
  const timestamp = normalizeTimestamp(raw.timestamp);

  return {
    id: `${eventData.execution_id || "execution"}-${
      eventData.node_id || "workflow"
    }-${eventType}-${timestamp}`,
    workflowId: eventData.workflow_id || "",
    executionId: eventData.execution_id || "",
    nodeId: eventData.node_id,
    eventType,
    timestamp,
    data: eventData.result ?? eventData.error ?? eventData,
    error: eventData.error,
  };
}

export function normalizeBackendEvents(
  rawEvents: BackendExecutionEvent[] = []
): ExecutionEvent[] {
  return rawEvents.map((event) => normalizeBackendEvent(event));
}

export function resetWorkflowNodeRuntime(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => {
    const {
      status: _status,
      lastResult: _lastResult,
      cost: _cost,
      executionTime: _executionTime,
      error: _error,
      ...data
    } = node.data as any;

    return {
      ...node,
      data: {
        ...data,
        status: "idle",
      },
    };
  });
}

export function getNodeStatusForEvent(event: ExecutionEvent): NodeStatus | null {
  if (isApprovalRequestedEvent(event.eventType)) return "waiting_approval";

  const suffix = String(event.eventType).includes(".")
    ? String(event.eventType).split(".").pop()
    : String(event.eventType);

  const statusMap: Record<string, NodeStatus> = {
    started: "running",
    completed: "completed",
    failed: "failed",
    requested: "waiting_approval",
    granted: "completed",
    denied: "failed",
  };

  return suffix ? statusMap[suffix] || null : null;
}

export function isApprovalRequestedEvent(eventType: EventTypeName): boolean {
  return APPROVAL_EVENT_TYPES.has(String(eventType));
}

export function approvalFromEvent(event: ExecutionEvent): ApprovalRequest | null {
  if (!isApprovalRequestedEvent(event.eventType)) return null;

  const data = event.data || {};
  return {
    id: data.approval_id || data.id,
    executionId: data.execution_id || event.executionId,
    nodeId: data.node_id || event.nodeId || "",
    title: data.title || "Approval Required",
    description: data.description || "Please review before continuing.",
    context: data.context || {},
    status: "pending",
    requestedAt: event.timestamp,
  };
}

export function approvalFromPendingApproval(
  pendingApproval: PendingApprovalPayload | null | undefined
): ApprovalRequest | null {
  if (!pendingApproval) return null;

  return {
    id:
      pendingApproval.id ||
      `${pendingApproval.execution_id || "execution"}-${
        pendingApproval.node_id || "approval"
      }`,
    executionId: pendingApproval.execution_id || "",
    nodeId: pendingApproval.node_id || "",
    title: pendingApproval.title || "Approval Required",
    description:
      pendingApproval.description || "Please review before continuing.",
    context: pendingApproval.context || {},
    status: "pending",
    requestedAt: pendingApproval.requested_at || new Date().toISOString(),
  };
}

function safeJsonParse(value: string): Record<string, any> {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function normalizeTimestamp(value: string | number | undefined): string {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string") {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && value.trim() !== "") {
      return new Date(asNumber * 1000).toISOString();
    }
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString();
    }
  }

  return new Date().toISOString();
}
