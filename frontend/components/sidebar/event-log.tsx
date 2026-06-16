"use client";

import { useEffect, useRef } from "react";
import { useWorkflowStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Zap,
  Activity,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExecutionEvent } from "@/types/workflow";

const eventIcons: Record<string, typeof Activity> = {
  "workflow.started": Zap,
  "workflow.completed": CheckCircle2,
  "workflow.failed": XCircle,
  "node.started": Zap,
  "node.completed": CheckCircle2,
  "node.failed": XCircle,
  "approval.requested": AlertCircle,
  "hitl.approval.requested": AlertCircle,
  "ui.approval.requested": AlertCircle,
  "approval.granted": CheckCircle2,
  "approval.denied": XCircle,
};

const eventColors: Record<string, string> = {
  "workflow.started": "text-blue-700 bg-blue-50",
  "workflow.completed": "text-emerald-700 bg-emerald-50",
  "workflow.failed": "text-red-700 bg-red-50",
  "node.started": "text-blue-700 bg-blue-50",
  "node.completed": "text-emerald-700 bg-emerald-50",
  "node.failed": "text-red-700 bg-red-50",
  "approval.requested": "text-amber-700 bg-amber-50",
  "hitl.approval.requested": "text-amber-700 bg-amber-50",
  "ui.approval.requested": "text-amber-700 bg-amber-50",
  "approval.granted": "text-emerald-700 bg-emerald-50",
  "approval.denied": "text-red-700 bg-red-50",
};

export function EventLogStream({
  onViewReport,
}: {
  onViewReport: (event: ExecutionEvent) => void;
}) {
  const { events, wsConnected, executionBackend } = useWorkflowStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineEvents = [...events].reverse();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const eventTitle = (event: ExecutionEvent) => {
    if (event.eventType === "workflow.started") return "Run started";
    if (event.eventType === "workflow.completed") return "Run completed";
    if (event.eventType === "workflow.failed") return "Run failed";
    if (event.eventType === "node.started") return "Node started";
    if (event.eventType === "node.completed") return "Node completed";
    if (event.eventType === "node.failed") return "Node failed";
    if (
      event.eventType === "approval.requested" ||
      event.eventType === "hitl.approval.requested" ||
      event.eventType === "ui.approval.requested"
    ) {
      return "Approval requested";
    }
    if (event.eventType === "approval.granted") return "Approval granted";
    if (event.eventType === "approval.denied") return "Approval denied";
    return String(event.eventType).replace(".", " ");
  };

  const eventSummary = (event: ExecutionEvent) => {
    const data = event.data || {};

    if (event.eventType === "workflow.started") {
      return "Workflow run accepted by the execution backend.";
    }

    if (event.eventType === "workflow.completed") {
      return "Workflow finished and produced a final output.";
    }

    if (event.eventType === "workflow.failed") {
      return event.error || data.error || "Workflow failed during execution.";
    }

    if (event.eventType === "node.started") {
      return `${formatNodeName(event.nodeId)} is now running.`;
    }

    if (
      event.eventType === "approval.requested" ||
      event.eventType === "hitl.approval.requested" ||
      event.eventType === "ui.approval.requested"
    ) {
      return (
        data.description ||
        `${data.title || "Approval"} is required before the workflow continues.`
      );
    }

    if (event.eventType === "node.completed") {
      if (typeof data.output === "string") return data.output;
      if (typeof data.reason === "string") return data.reason;
      if (data.action) {
        return `Approval ${data.action} by ${data.approver || "reviewer"}.`;
      }
      if (data.status === "workflow end") {
        return "Final workflow output was captured.";
      }
      return `${formatNodeName(event.nodeId)} completed successfully.`;
    }

    if (
      event.eventType === "approval.granted" ||
      event.eventType === "approval.denied"
    ) {
      return `Reviewer ${data.action || "responded"}${
        data.comment ? `: ${data.comment}` : "."
      }`;
    }

    if (event.eventType === "node.failed") {
      return event.error || data.error || `${formatNodeName(event.nodeId)} failed.`;
    }

    return "Workflow event recorded.";
  };

  const eventMetadata = (event: ExecutionEvent) => {
    const data = event.data || {};
    const metadata: Array<{ label: string; value: string }> = [];

    if (event.nodeId) {
      metadata.push({ label: "Node", value: formatNodeName(event.nodeId) });
    }
    if (typeof data.score === "number") {
      metadata.push({ label: "Score", value: data.score.toFixed(2) });
    }
    if (typeof data.cost === "number") {
      metadata.push({ label: "Cost", value: `$${data.cost.toFixed(4)}` });
    }
    if (typeof data.latency_ms === "number") {
      metadata.push({ label: "Latency", value: `${data.latency_ms}ms` });
    }
    if (typeof data.model === "string") {
      metadata.push({ label: "Model", value: data.model });
    }
    if (typeof data.usage?.total_tokens === "number") {
      metadata.push({ label: "Tokens", value: String(data.usage.total_tokens) });
    }
    if (typeof data.approver === "string") {
      metadata.push({ label: "Approver", value: data.approver });
    }

    return metadata;
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Execution Timeline
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Audit trail for this run
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                wsConnected || executionBackend === "local"
                  ? "bg-emerald-500"
                  : "bg-slate-300"
              )}
            />
            <span className="text-xs text-slate-500">
              {executionBackend === "local"
                ? "Local"
                : wsConnected
                ? "Live"
                : "Offline"}
            </span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        <AnimatePresence initial={false}>
          {timelineEvents.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-500">
              {wsConnected ? (
                <Loader2 className="mb-2 h-8 w-8 animate-spin text-blue-700" />
              ) : (
                <Activity className="mb-2 h-10 w-10" />
              )}
              <p className="text-sm">
                {wsConnected ? "Workflow initializing..." : "No events yet"}
              </p>
              <p className="mt-1 text-xs">
                Events will appear here during execution.
              </p>
            </div>
          ) : (
            timelineEvents.map((event, index) => {
              if (event.eventType === "workflow.failed" && event.data?.errors) {
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-red-200 bg-red-50 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-red-100 p-2">
                        <XCircle className="h-5 w-5 text-red-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="mb-1 font-semibold text-red-800">
                          Workflow validation failed
                        </h3>
                        <p className="mb-3 text-sm text-red-700">
                          {event.data.message ||
                            "Please fix the following issues and try again."}
                        </p>
                        <div className="space-y-2">
                          {event.data.errors.map(
                            (error: string, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-sm"
                              >
                                <span className="font-bold text-red-600">
                                  -
                                </span>
                                <span className="text-red-800">{error}</span>
                              </div>
                            )
                          )}
                        </div>
                        <div className="mt-3 border-t border-red-200 pt-3">
                          <p className="text-xs text-red-700">
                            Check node configurations and canvas connections.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              const Icon = eventIcons[event.eventType] || Activity;
              const colorClass =
                eventColors[event.eventType] || "bg-slate-100 text-slate-700";
              const metadata = eventMetadata(event);

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: index * 0.02 }}
                  className="rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-md p-1.5", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">
                          {eventTitle(event)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          {formatTime(event.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs leading-5 text-slate-600">
                        {eventSummary(event)}
                      </p>

                      {metadata.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {metadata.map((item) => (
                            <span
                              key={`${item.label}-${item.value}`}
                              className="max-w-full truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
                              title={`${item.label}: ${item.value}`}
                            >
                              {item.label}: {item.value}
                            </span>
                          ))}
                        </div>
                      )}

                      {event.error && (
                        <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
                          {event.error}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Total Events: {events.length}</span>
          <button
            onClick={() => events[0] && onViewReport(events[0])}
            className="text-blue-700 hover:underline disabled:text-slate-400"
            disabled={events.length === 0}
          >
            View Narration
          </button>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Audit
          </span>
        </div>
      </div>
    </div>
  );
}

function formatNodeName(nodeId?: string) {
  if (!nodeId) return "Workflow";
  return nodeId
    .replace(/^diligence-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
