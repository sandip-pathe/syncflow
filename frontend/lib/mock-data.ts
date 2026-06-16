import { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import {
  Bot,
  Globe,
  Target,
  CheckCheck,
  Clock,
  Radio,
  Merge,
  GitBranchPlus,
  Zap,
  CheckCircle2,
} from "lucide-react";

export const mockNodes: WorkflowNode[] = [
  {
    id: "diligence-trigger",
    type: "trigger",
    position: { x: 32, y: 260 },
    data: {
      label: "Diligence Notes",
      type: "trigger",
      status: "idle",
      config: {
        name: "Diligence Notes",
        type: "manual",
        input_text:
          "Company memo: Revenue grew 42% YoY, gross retention is above 90%, enterprise pipeline is concentrated in six accounts, and AI automation is expected to drive expansion margin.",
      },
    },
  },
  {
    id: "diligence-extract-claims",
    type: "agent",
    position: { x: 260, y: 260 },
    data: {
      label: "Extract Claims & Risks",
      type: "agent",
      status: "idle",
      config: {
        name: "Extract Claims & Risks",
        system_instructions:
          "Extract material claims, risks, assumptions, and missing evidence from private-market diligence notes.",
        temperature: 0.2,
        expected_output_format: "structured diligence findings",
        provider: "custom",
        agent_id: "local-diligence-analyst",
      },
    },
  },
  {
    id: "diligence-eval",
    type: "eval",
    position: { x: 488, y: 260 },
    data: {
      label: "Risk Completeness Eval",
      type: "eval",
      status: "idle",
      config: {
        name: "Risk Completeness Eval",
        eval_type: "policy",
        config: {
          policy_rules: [{ type: "confidence_threshold", min_confidence: 0.75 }],
        },
        on_failure: "warn",
      },
    },
  },
  {
    id: "diligence-approval",
    type: "approval",
    position: { x: 716, y: 260 },
    data: {
      label: "Partner Review",
      type: "approval",
      status: "idle",
      config: {
        name: "Partner Review",
        description:
          "Review flagged diligence risks before generating the IC memo section.",
        approver_email: "partner-review@syncflow.local",
      },
    },
  },
  {
    id: "diligence-ic-memo",
    type: "agent",
    position: { x: 944, y: 260 },
    data: {
      label: "Draft IC Memo",
      type: "agent",
      status: "idle",
      config: {
        name: "Draft IC Memo",
        system_instructions:
          "Write a concise investment committee memo section from approved diligence findings.",
        temperature: 0.3,
        expected_output_format: "IC memo bullets",
        provider: "custom",
        agent_id: "local-ic-memo-writer",
      },
    },
  },
  {
    id: "diligence-end",
    type: "end",
    position: { x: 1172, y: 260 },
    data: {
      label: "Audit-Ready Memo",
      type: "end",
      status: "idle",
      config: {
        name: "Audit-Ready Memo",
        capture_output: true,
        show_output: true,
      },
    },
  },
];

export const mockEdges: WorkflowEdge[] = [
  { id: "d1", source: "diligence-trigger", target: "diligence-extract-claims" },
  { id: "d2", source: "diligence-extract-claims", target: "diligence-eval" },
  { id: "d3", source: "diligence-eval", target: "diligence-approval" },
  {
    id: "d4",
    source: "diligence-approval",
    target: "diligence-ic-memo",
    sourceHandle: "approve",
  },
  { id: "d5", source: "diligence-ic-memo", target: "diligence-end" },
];

export const nodeTemplates = [
  {
    type: "trigger",
    label: "Trigger",
    description: "Start workflow",
    color: "bg-green-500",
    icon: Zap,
  },
  {
    type: "agent",
    label: "AI Agent",
    description: "Call AI model",
    color: "bg-teal-600",
    icon: Bot,
  },
  {
    type: "api_call",
    label: "API Call",
    description: "HTTP/API call",
    color: "bg-sky-600",
    icon: Globe,
  },
  {
    type: "conditional",
    label: "Conditional",
    description: "If/else branching logic",
    color: "bg-blue-600",
    icon: GitBranchPlus,
  },
  {
    type: "approval",
    label: "Approval",
    description: "Simple in-app confirmation",
    color: "bg-orange-500",
    icon: CheckCheck,
  },
  {
    type: "eval",
    label: "Evaluation",
    description: "Policy check",
    color: "bg-blue-700",
    icon: Target,
  },
  {
    type: "merge",
    label: "Merge",
    description: "Combine branches",
    color: "bg-slate-600",
    icon: Merge,
  },
  {
    type: "event",
    label: "Event",
    description: "Pub/sub",
    color: "bg-teal-600",
    icon: Radio,
  },
  {
    type: "timer",
    label: "Timer",
    description: "Delay/wait",
    color: "bg-cyan-600",
    icon: Clock,
  },
  {
    type: "end",
    label: "End",
    description: "End of workflow",
    color: "bg-gray-800",
    icon: CheckCircle2,
  },
] as const;
