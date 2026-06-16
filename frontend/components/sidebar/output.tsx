"use client";

import { useWorkflowStore } from "@/lib/store";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  DollarSign,
  FileText,
  Terminal,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function OutputPanel({ onOpenReport }: { onOpenReport?: () => void }) {
  const { output } = useWorkflowStore();
  const result = output?.result;
  const finalResult = result?.final_result ?? result;
  const audit = result?.audit;
  const approval = audit?.approval;
  const nodeOutputs =
    result && typeof result === "object" && result.node_outputs
      ? result.node_outputs
      : {};

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Run Summary
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Final output, audit metrics, and operator decisions
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {output && (
              <Badge
                variant={
                  output.status === "completed" ? "default" : "destructive"
                }
              >
                {output.status === "completed" ? (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                ) : (
                  <XCircle className="mr-1 h-3 w-3" />
                )}
                {output.status?.toUpperCase()}
              </Badge>
            )}
            {onOpenReport && output && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-slate-200"
                onClick={onOpenReport}
              >
                <FileText className="h-3.5 w-3.5" />
                Report
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {output ? (
            <>
              {finalResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-lg border p-4",
                    output.status === "completed"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "rounded-md p-1.5",
                        output.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      <Zap className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="mb-2 block text-sm font-medium text-slate-950">
                        Final Result
                      </span>
                      <OutputRenderer output={finalResult} />
                    </div>
                  </div>
                </motion.div>
              )}

              {audit && (
                <div className="grid grid-cols-2 gap-2">
                  <AuditMetric label="Eval score" value={audit.eval_score ?? "-"} />
                  <AuditMetric
                    label="Cost"
                    value={
                      audit.total_cost !== undefined
                        ? `$${Number(audit.total_cost).toFixed(4)}`
                        : "-"
                    }
                  />
                  <AuditMetric
                    label="Latency"
                    value={
                      audit.total_latency_ms !== undefined
                        ? `${Math.round(audit.total_latency_ms)}ms`
                        : "-"
                    }
                  />
                  <AuditMetric label="Nodes" value={audit.nodes_executed ?? "-"} />
                </div>
              )}

              {approval && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-slate-100 p-1.5 text-slate-700">
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-950">
                          Approval Decision
                        </h4>
                        <p className="text-xs text-slate-500">
                          Human review captured before completion
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "border",
                        approval.action === "approved"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      )}
                    >
                      {approval.action || "not recorded"}
                    </Badge>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <SummaryRow
                      label="Approver"
                      value={approval.approver || "Reviewer"}
                    />
                    <SummaryRow
                      label="Comment"
                      value={approval.comment || "No comment"}
                    />
                  </dl>
                </div>
              )}

              {Object.keys(nodeOutputs).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-600">
                    Node Execution Details
                  </h4>
                  {Object.entries(nodeOutputs).map(([nodeId, nodeOutput]) => (
                    <Card key={nodeId} className="bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {nodeId}
                        </p>
                        <Badge variant="default" className="text-xs">
                          success
                        </Badge>
                      </div>
                      <OutputRenderer output={nodeOutput} />
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-20 text-slate-400">
              <Terminal className="mb-2 h-12 w-12" />
              <p className="text-sm">No output yet</p>
              <p className="mt-1 text-xs">
                Run a workflow to see the final result.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function AuditMetric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="break-words text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function OutputRenderer({ output }: { output: any }) {
  if (output === null || output === undefined) {
    return <p className="text-sm italic text-slate-500">No output</p>;
  }

  if (typeof output === "string") {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {output}
        </p>
      </div>
    );
  }

  if (typeof output === "boolean" || typeof output === "number") {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="font-mono text-sm text-slate-700">{String(output)}</p>
      </div>
    );
  }

  if (typeof output === "object") {
    const content = extractContent(output);

    if (content) {
      return (
        <div className="space-y-2">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
              {content}
            </p>
          </div>
          {(output.usage || output.cost !== undefined) && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {output.usage && (
                <span>
                  {output.usage.total_tokens || output.usage.prompt_tokens} tokens
                </span>
              )}
              {output.cost !== undefined && (
                <span className="flex items-center">
                  <DollarSign className="mr-1 h-3 w-3" />
                  {Number(output.cost).toFixed(6)}
                </span>
              )}
              {output.model && <span className="font-mono">{output.model}</span>}
            </div>
          )}
        </div>
      );
    }

    return <StructuredSummary output={output} />;
  }

  return <p className="text-sm italic text-slate-500">Unknown output format</p>;
}

function extractContent(output: any): string | null {
  if (typeof output.output === "string") return output.output;
  if (typeof output.result === "string") return output.result;
  if (typeof output.text === "string") return output.text;
  if (typeof output.content === "string") return output.content;
  if (typeof output.message === "string") return output.message;
  if (typeof output.value === "string") return output.value;
  if (typeof output.data === "string") return output.data;
  if (typeof output.input_text === "string") return output.input_text;

  if (output.output && typeof output.output === "object") {
    return extractContent(output.output);
  }
  if (output.result && typeof output.result === "object") {
    return extractContent(output.result);
  }

  return null;
}

function StructuredSummary({ output }: { output: Record<string, any> }) {
  const rows = Object.entries(output)
    .map(([key, value]) => ({
      key,
      value: summarizeValue(value),
    }))
    .filter((row) => row.value);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-sm text-slate-500">Structured metadata captured.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <dl className="space-y-2">
        {rows.slice(0, 5).map((row) => (
          <div key={row.key} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
            <dt className="truncate text-xs font-medium uppercase text-slate-500">
              {formatLabel(row.key)}
            </dt>
            <dd className="break-words text-sm text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function summarizeValue(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return keys.length
      ? `${keys.length} field${keys.length === 1 ? "" : "s"} captured`
      : "";
  }
  return "";
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}
