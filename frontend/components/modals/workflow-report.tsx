"use client";

import type React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  ShieldCheck,
  Target,
  Timer,
  UserCheck,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface WorkflowReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  output: { status: string; result: any } | null;
  workflowName: string;
  executionBackend?: "local" | "temporal" | null;
  isDiligenceWorkflow?: boolean;
}

export function WorkflowReportModal({
  open,
  onOpenChange,
  output,
  workflowName,
  executionBackend,
  isDiligenceWorkflow = false,
}: WorkflowReportModalProps) {
  const report = buildReport(output?.result);
  const isCompleted = output?.status === "completed";
  const reportDescription = isCompleted
    ? isDiligenceWorkflow
      ? "IC memo, extracted diligence signals, approval decision, and audit metadata from the completed workflow run."
      : "Final output, approval decision, and audit metadata from the completed workflow run."
    : isDiligenceWorkflow
    ? "Stopped diligence run with approval decision, error reason, and audit metadata captured for review."
    : "Stopped workflow run with final state, approval decision, and audit metadata captured for review.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] w-[92vw] max-w-[1180px] flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex flex-col gap-3 pr-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <Badge
                  className={cn(
                    "gap-1 border-0",
                    isCompleted
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {output?.status || "No run"}
                </Badge>
                <Badge className="border-slate-200 bg-white text-slate-600">
                  {executionBackend === "temporal" ? "Temporal" : "Local Demo"}
                </Badge>
              </div>
              <DialogTitle className="truncate text-xl font-semibold text-slate-950">
                {workflowName} {isDiligenceWorkflow ? "Report" : "Run Report"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-600">
                {reportDescription}
              </DialogDescription>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
              <MetricTile
                icon={Target}
                label="Eval"
                value={formatScore(report.audit?.eval_score)}
              />
              <MetricTile
                icon={DollarSign}
                label="Cost"
                value={formatCurrency(report.audit?.total_cost)}
              />
              <MetricTile
                icon={Timer}
                label="Latency"
                value={formatLatency(report.audit?.total_latency_ms)}
              />
              <MetricTile
                icon={Activity}
                label="Nodes"
                value={report.audit?.nodes_executed ?? "-"}
              />
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <main className="min-w-0 space-y-4">
              <ReportSection
                icon={FileText}
                title={
                  isCompleted
                    ? isDiligenceWorkflow
                      ? "Investment Committee Memo"
                      : "Final Output"
                    : "Stopped Run"
                }
                tone={isCompleted ? "emerald" : "amber"}
              >
                <div
                  className={cn(
                    "rounded-lg border p-4",
                    isCompleted
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  )}
                >
                  <p className="text-sm leading-6 text-slate-900">
                    {report.finalMemo || "No memo was produced."}
                  </p>
                </div>

                {report.memo?.recommendation && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Recommendation
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-950">
                      {report.memo.recommendation}
                    </p>
                  </div>
                )}

                {Array.isArray(report.memo?.key_points) &&
                  report.memo.key_points.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Key points
                      </div>
                      <ul className="mt-2 space-y-2">
                        {report.memo.key_points.map(
                          (point: string, index: number) => (
                            <li
                              key={index}
                              className="flex gap-2 text-sm leading-6 text-slate-800"
                            >
                              <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-600" />
                              <span>{point}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </ReportSection>

              {isDiligenceWorkflow && (
                <>
                  <ReportSection
                    icon={AlertTriangle}
                    title="Flagged Risks"
                    tone="amber"
                  >
                    {report.risks.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {report.risks.map((risk: any, index: number) => (
                          <div
                            key={`${risk.risk || "risk"}-${index}`}
                            className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-semibold text-amber-950">
                                {risk.risk || String(risk)}
                              </h4>
                              {risk.severity && (
                                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-800">
                                  {risk.severity}
                                </span>
                              )}
                            </div>
                            {risk.rationale && (
                              <p className="mt-2 text-sm leading-5 text-amber-900">
                                {risk.rationale}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyLine text="No risks were returned by this run." />
                    )}
                  </ReportSection>

                  <ReportSection
                    icon={ClipboardList}
                    title="Claims And Assumptions"
                    tone="blue"
                  >
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <h4 className="text-sm font-semibold text-slate-950">
                          Extracted claims
                        </h4>
                        {report.claims.length > 0 ? (
                          <ul className="mt-3 space-y-3">
                            {report.claims.map((claim: any, index: number) => (
                              <li key={index} className="text-sm leading-6">
                                <div className="font-medium text-slate-900">
                                  {claim.claim || String(claim)}
                                </div>
                                {claim.source && (
                                  <div className="text-xs text-slate-500">
                                    Source: {claim.source}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyLine text="No claims extracted." />
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <h4 className="text-sm font-semibold text-slate-950">
                          Assumptions to verify
                        </h4>
                        {report.assumptions.length > 0 ? (
                          <ul className="mt-3 space-y-2">
                            {report.assumptions.map(
                              (assumption: string, index: number) => (
                                <li
                                  key={index}
                                  className="flex gap-2 text-sm leading-6 text-slate-800"
                                >
                                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-600" />
                                  <span>{assumption}</span>
                                </li>
                              )
                            )}
                          </ul>
                        ) : (
                          <EmptyLine text="No assumptions extracted." />
                        )}
                      </div>
                    </div>
                  </ReportSection>
                </>
              )}
            </main>

            <aside className="space-y-4">
              <ReportSection icon={UserCheck} title="Approval" tone="slate">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      Decision
                    </span>
                    <Badge
                      className={cn(
                        "border",
                        report.approval?.action === "approved"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : report.approval?.action
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      )}
                    >
                      {report.approval?.action || "not recorded"}
                    </Badge>
                  </div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <KeyValue
                      label="Approver"
                      value={report.approval?.approver || "-"}
                    />
                    <KeyValue
                      label="Comment"
                      value={report.approval?.comment || "No comment"}
                    />
                  </dl>
                </div>
              </ReportSection>

              <ReportSection icon={ShieldCheck} title="Audit Trail" tone="slate">
                <div className="space-y-2">
                  {report.nodeRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-950">
                            {formatNodeName(row.id)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.summary}
                          </div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      </div>
                      {(row.cost || row.latency) && (
                        <div className="mt-2 flex gap-2 text-[11px] text-slate-500">
                          {row.cost && <span>{row.cost}</span>}
                          {row.latency && <span>{row.latency}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ReportSection>

              {report.sourceExcerpt && (
                <ReportSection icon={FileText} title="Source Excerpt" tone="slate">
                  <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs leading-5 text-slate-700">
                      {report.sourceExcerpt}
                    </p>
                  </div>
                </ReportSection>
              )}
            </aside>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end border-t border-slate-200 bg-white px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back to Canvas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildReport(result: any) {
  const nodeOutputs = result?.node_outputs || {};
  const outputs = Object.values(nodeOutputs).filter(
    (value): value is Record<string, any> =>
      Boolean(value) && typeof value === "object"
  );
  const extraction =
    outputs.find(
      (value) =>
        Array.isArray(value.claims) ||
        Array.isArray(value.risks) ||
        Array.isArray(value.assumptions)
    ) || {};
  const evalOutput =
    outputs.find((value) => typeof value.score === "number") || {};
  const finalResult = result?.final_result || {};
  const audit = result?.audit || {};

  return {
    audit,
    finalMemo:
      finalResult.output ||
      finalResult.memo?.recommendation ||
      result?.summary ||
      "",
    memo: finalResult.memo || {},
    claims: extraction.claims || [],
    risks: extraction.risks || [],
    assumptions: extraction.assumptions || [],
    sourceExcerpt:
      extraction.source_excerpt ||
      findSourceInput(nodeOutputs) ||
      "",
    approval: audit.approval,
    evalOutput,
    nodeRows: Object.entries(nodeOutputs).map(([id, value]) => {
      const item = value as any;
      return {
        id,
        summary: summarizeNodeOutput(item),
        cost:
          typeof item?.cost === "number"
            ? `$${Number(item.cost).toFixed(4)}`
            : "",
        latency:
          typeof item?.latency_ms === "number"
            ? `${Math.round(item.latency_ms)}ms`
            : "",
      };
    }),
  };
}

function ReportSection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: typeof FileText;
  title: string;
  tone: "emerald" | "amber" | "blue" | "slate";
  children: React.ReactNode;
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("rounded-md p-1.5", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-900">{value}</dd>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}

function formatScore(value: unknown) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

function formatCurrency(value: unknown) {
  return typeof value === "number" ? `$${value.toFixed(4)}` : "-";
}

function formatLatency(value: unknown) {
  return typeof value === "number" ? `${Math.round(value)}ms` : "-";
}

function formatNodeName(nodeId: string) {
  return nodeId
    .replace(/^diligence-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function findSourceInput(nodeOutputs: Record<string, any>) {
  const triggerOutput = Object.values(nodeOutputs).find(
    (value) => value && typeof value === "object" && "input_text" in value
  ) as { input_text?: string } | undefined;

  return triggerOutput?.input_text || "";
}

function summarizeNodeOutput(output: any) {
  if (!output) return "No output recorded";
  if (typeof output.output === "string") return output.output;
  if (typeof output.reason === "string") return output.reason;
  if (typeof output.action === "string") return `Approval ${output.action}`;
  if (typeof output.input_text === "string") return "Source material captured";
  if (typeof output.status === "string") return output.status;
  return "Execution metadata captured";
}
