"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WorkflowNode } from "@/types/workflow";
import {
  Zap,
  Bot,
  Globe,
  UserCheck,
  Target,
  GitFork,
  GitMerge,
  Clock,
  Radio,
  Eye,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pause,
  GitBranch,
} from "lucide-react";

const iconMap: { [key: string]: React.ElementType } = {
  trigger: Zap,
  agent: Bot,
  api_call: Globe,
  approval: UserCheck,
  eval: Target,
  fork: GitFork,
  merge: GitMerge,
  timer: Clock,
  event: Radio,
  meta: Eye,
  conditional: GitBranch,
  end: CheckCircle2,
};

const accentMap: {
  [key: string]: { icon: string; rail: string; label: string };
} = {
  trigger: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rail: "bg-emerald-500",
    label: "text-emerald-700",
  },
  agent: {
    icon: "bg-teal-50 text-teal-700 ring-teal-200",
    rail: "bg-teal-500",
    label: "text-teal-700",
  },
  api_call: {
    icon: "bg-sky-50 text-sky-700 ring-sky-200",
    rail: "bg-sky-500",
    label: "text-sky-700",
  },
  approval: {
    icon: "bg-amber-50 text-amber-700 ring-amber-200",
    rail: "bg-amber-500",
    label: "text-amber-700",
  },
  eval: {
    icon: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    rail: "bg-indigo-500",
    label: "text-indigo-700",
  },
  fork: {
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    rail: "bg-slate-400",
    label: "text-slate-700",
  },
  merge: {
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    rail: "bg-slate-400",
    label: "text-slate-700",
  },
  timer: {
    icon: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    rail: "bg-cyan-500",
    label: "text-cyan-700",
  },
  event: {
    icon: "bg-teal-50 text-teal-700 ring-teal-200",
    rail: "bg-teal-500",
    label: "text-teal-700",
  },
  meta: {
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    rail: "bg-slate-400",
    label: "text-slate-700",
  },
  conditional: {
    icon: "bg-blue-50 text-blue-700 ring-blue-200",
    rail: "bg-blue-500",
    label: "text-blue-700",
  },
  end: {
    icon: "bg-slate-100 text-slate-900 ring-slate-200",
    rail: "bg-slate-700",
    label: "text-slate-700",
  },
};

const statusConfig: { [key: string]: any } = {
  idle: {
    border: "border-slate-200",
    surface: "bg-white",
    label: "Idle",
    chip: "border-slate-200 bg-slate-50 text-slate-600",
    icon: null,
    pulse: false,
  },
  running: {
    border: "border-blue-300",
    surface: "bg-blue-50/60",
    label: "Running",
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Loader2,
    pulse: true,
  },
  completed: {
    border: "border-emerald-300",
    surface: "bg-emerald-50/40",
    label: "Completed",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
    pulse: false,
  },
  failed: {
    border: "border-red-300",
    surface: "bg-red-50/50",
    label: "Failed",
    chip: "border-red-200 bg-red-50 text-red-700",
    icon: AlertCircle,
    pulse: false,
  },
  waiting_approval: {
    border: "border-amber-300",
    surface: "bg-amber-50/50",
    label: "Needs approval",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Pause,
    pulse: true,
  },
  paused: {
    border: "border-slate-300",
    surface: "bg-slate-50",
    label: "Paused",
    chip: "border-slate-200 bg-slate-100 text-slate-700",
    icon: Pause,
    pulse: false,
  },
};

export const CustomNode = memo(
  ({ data, selected }: NodeProps<WorkflowNode>) => {
    const Icon = iconMap[data.type] || Eye;
    const statusInfo = statusConfig[data.status] || statusConfig.idle;
    const StatusIcon = statusInfo.icon;
    const accent = accentMap[data.type] || accentMap.meta;

    const metadata = [
      data.cost !== undefined
        ? { label: "Cost", value: `$${Number(data.cost).toFixed(4)}` }
        : null,
      data.executionTime !== undefined
        ? { label: "Latency", value: formatLatency(Number(data.executionTime)) }
        : null,
      data.reliability !== undefined
        ? {
            label: "Reliability",
            value: `${Math.round(Number(data.reliability) * 100)}%`,
          }
        : null,
      data.lastResult?.score !== undefined
        ? { label: "Score", value: Number(data.lastResult.score).toFixed(2) }
        : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item));

    const renderHandles = () => {
      switch (data.type) {
        case "trigger":
          return (
            <Handle type="source" position={Position.Bottom} id="output" />
          );
        case "agent":
        case "api_call":
          return (
            <>
              <Handle type="target" position={Position.Top} id="input" />
              <Handle type="source" position={Position.Bottom} id="output" />
            </>
          );
        case "conditional":
          return (
            <>
              <Handle type="target" position={Position.Top} id="input" />
              <Handle
                type="source"
                position={Position.Bottom}
                id="true"
                style={{ left: "25%" }}
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="false"
                style={{ left: "75%" }}
              />
            </>
          );
        case "approval":
          return (
            <>
              <Handle type="target" position={Position.Top} id="input" />
              <Handle
                type="source"
                position={Position.Bottom}
                id="approve"
                style={{ left: "25%" }}
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="reject"
                style={{ left: "75%" }}
              />
            </>
          );
        case "event":
          return (
            <>
              <Handle type="target" position={Position.Top} id="input" />
              <Handle
                type="source"
                position={Position.Bottom}
                id="sub1"
                style={{ left: "20%" }}
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="sub2"
                style={{ left: "40%" }}
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="sub3"
                style={{ left: "60%" }}
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="sub4"
                style={{ left: "80%" }}
              />
            </>
          );
        case "end":
          return (
            <>
              <Handle type="target" position={Position.Top} id="input" />
            </>
          );
        default:
          return (
            <>
              <Handle type="target" position={Position.Top} />
              <Handle type="source" position={Position.Bottom} />
            </>
          );
      }
    };

    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-[244px]"
      >
        {renderHandles()}
        <div
          className={cn(
            "relative overflow-hidden rounded-md border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition",
            statusInfo.border,
            statusInfo.surface,
            selected && "ring-2 ring-slate-900/10 ring-offset-2"
          )}
        >
          <div className={cn("absolute inset-y-0 left-0 w-1", accent.rail)} />
          <div className="space-y-3 px-3 py-3 pl-4">
            <div className="flex items-start gap-2.5">
              <div className={cn("rounded-md p-1.5 ring-1", accent.icon)}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-5 text-slate-950">
                  {data.label}
                </div>
                <div
                  className={cn(
                    "truncate text-[10px] font-semibold uppercase tracking-wide",
                    accent.label
                  )}
                >
                  {String(data.type).replace("_", " ")}
                </div>
              </div>
              {StatusIcon && (
                <StatusIcon
                  className={cn(
                    "mt-0.5 h-4 w-4 flex-shrink-0",
                    statusInfo.chip.includes("blue")
                      ? "text-blue-700"
                      : statusInfo.chip.includes("emerald")
                      ? "text-emerald-700"
                      : statusInfo.chip.includes("amber")
                      ? "text-amber-700"
                      : statusInfo.chip.includes("red")
                      ? "text-red-700"
                      : "text-slate-700",
                    data.status === "running" && "animate-spin"
                  )}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  statusInfo.chip
                )}
              >
                {statusInfo.label || "Idle"}
              </span>
              {metadata.map((item) => (
                <span
                  key={`${item.label}-${item.value}`}
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600"
                  title={`${item.label}: ${item.value}`}
                >
                  <span className="font-sans text-slate-400">{item.label}</span>
                  {item.value}
                </span>
              ))}
            </div>

            {data.error && (
              <p className="flex items-start gap-1 rounded-md border border-red-100 bg-red-50 px-2 py-1.5 text-xs leading-5 text-red-700">
                <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span className="line-clamp-3">{data.error}</span>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

function formatLatency(seconds: number) {
  if (!Number.isFinite(seconds)) return "-";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(1)}s`;
}

CustomNode.displayName = "CustomNode";
