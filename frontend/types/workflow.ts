// frontend/types/workflow.ts
// --- UPDATED for simplified node schema ---

import { Node, Edge } from "@xyflow/react";

export type NodeType =
  | "trigger"
  | "agent"
  | "api_call"
  | "approval"
  | "conditional"
  | "timer"
  | "merge"
  | "event"
  | "eval"
  | "end";

export type NodeStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "waiting_approval"
  | "paused";

export type WorkflowMode =
  | "design"
  | "executing"
  | "completed"
  | "failed"
  | "paused";

export type LayoutType = "dag" | "event-hub";

// --- Configuration Types (Matching Backend Pydantic Schemas) ---

export interface TriggerConfig {
  name: string;
  type: "manual" | "event";
  input_text?: string;
  input_json?: Record<string, any>;
}

export interface AgentConfig {
  name: string;
  temperature?: number;
  system_instructions: string;
  expected_output_format?: string;
  // Legacy fields for backward compatibility
  provider?: string;
  agent_id?: string;
}

export interface ApiCallConfig {
  name: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: Record<string, any>;
}

export interface ConditionalConfig {
  name: string;
  condition_expression: string;
}

export interface EndConfig {
  name: string;
  capture_output?: boolean;
  show_output?: boolean;
}

export interface ApprovalConfig {
  name: string;
  description: string;
  approver_email?: string;
  approvers?: string[];
}

export interface EvalConfig {
  name: string;
  eval_type: "schema" | "llm_judge" | "policy" | "custom";
  config: Record<string, any>;
  on_failure: "block" | "warn" | "retry" | "compensate";
}

export interface MergeConfig {
  name: string;
  merge_strategy: "combine" | "first" | "vote";
}

export interface EventConfig {
  name: string;
  operation: "publish" | "subscribe";
  channel: string;
}

export interface TimerConfig {
  name: string;
  duration_seconds: number;
}

// --- Union Type for Specific Configs ---
export type SpecificNodeConfig =
  | TriggerConfig
  | AgentConfig
  | ApiCallConfig
  | ApprovalConfig
  | ConditionalConfig
  | EvalConfig
  | MergeConfig
  | TimerConfig
  | EventConfig
  | EndConfig;

// --- NodeData Interface ---
export interface NodeData {
  [key: string]: unknown;
  label: string;
  type: NodeType;
  status: NodeStatus;
  config: SpecificNodeConfig;
  error?: string;
  executionTime?: number;
  cost?: number;
  reliability?: number;
  lastResult?: any;
}

// WorkflowNode and WorkflowEdge remain structurally similar, but use the refined NodeData
export interface WorkflowNode extends Node<NodeData> {
  type: NodeType;
  data: NodeData;
}

export interface WorkflowEdge extends Edge {
  // id, source, target are inherited
  label?: string; // Optional label (e.g., for conditional branches 'true'/'false')
  animated?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
}
// ... rest of the file (Workflow, ExecutionEvent, ApprovalRequest etc.) remains the same ...
export type EventTypeName =
  | "node.started"
  | "node.completed"
  | "node.failed"
  | "workflow.started"
  | "workflow.completed"
  | "workflow.failed"
  | "approval.requested"
  | "approval.granted" // Assuming backend sends these
  | "approval.denied" // Assuming backend sends these
  | "compensation.started"
  | "compensation.completed"
  | "compensation.failed"
  | "eval.completed"
  | "fork.started"
  | "merge.completed"
  | "timer.started"
  | "timer.completed"
  | "meta.observation"
  | "ui.approval.requested" // From activities.py
  | string; // Allow for custom events

export interface ExecutionEvent {
  // Using a unique ID combining execution, node, type, and timestamp might be more robust
  id: string; // e.g., `${executionId}-${nodeId}-${eventType}-${timestamp}`
  workflowId: string;
  executionId: string;
  nodeId?: string; // Optional for workflow-level events
  eventType: EventTypeName;
  timestamp: string; // ISO 8601 format string
  data?: any; // Contains result on success, error details on failure, etc.
  error?: string; // Explicit error message if applicable
}

// ApprovalRequest seems okay, maybe add title/description if sent from backend
export interface ApprovalRequest {
  id: string; // approval_id from backend event
  executionId: string;
  nodeId: string;
  title: string; // Added
  description: string; // Added
  context: any; // Data passed for the approver to see
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  respondedAt?: string;
  respondedBy?: string;
  comment?: string;
}

// Metrics types seem okay for now
export interface MetricsSummary {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  successRate: number;
  totalCost: number;
  averageDuration: number;
}

export interface AgentMetrics {
  agentId: string;
  provider: string;
  executionCount: number;
  reliability: number;
  averageCost: number;
  averageLatency: number;
}
