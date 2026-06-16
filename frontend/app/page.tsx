"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  GitBranch,
  Loader2,
  Plus,
  ShieldCheck,
  Target,
  UserCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { generateWorkflowName } from "@/lib/workflow-name";

async function fetchWorkflows() {
  return api.workflows.list();
}

async function createNewWorkflow() {
  return api.workflows.create({
    name: generateWorkflowName(),
    description: "Blank workflow canvas for building AI automations.",
    nodes: [],
    edges: [],
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: workflowsData, isLoading, error } = useQuery({
    queryKey: ["workflows"],
    queryFn: fetchWorkflows,
  });

  const createWorkflowMutation = useMutation({
    mutationFn: createNewWorkflow,
    onSuccess: (data) => {
      router.push(`/workflows/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const workflows = useMemo(
    () => workflowsData?.items || [],
    [workflowsData?.items]
  );
  const diligenceWorkflow = useMemo(
    () =>
      workflows.find(
        (workflow: any) => workflow.id === "template-private-market-diligence"
      ),
    [workflows]
  );
  const secondaryWorkflows = workflows.filter(
    (workflow: any) => workflow.id !== "template-private-market-diligence"
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              SyncFlow
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              Durable AI Workflow Builder
            </h1>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <LinkButton href="/docs">Docs</LinkButton>
            <LinkButton href="/api">API</LinkButton>
            <Button
              size="sm"
              className="ml-2 gap-2 bg-slate-950 text-white hover:bg-slate-800"
              disabled={createWorkflowMutation.isPending}
              onClick={() => createWorkflowMutation.mutate()}
            >
              {createWorkflowMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New Workflow
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Local demo ready
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                    Temporal path preserved
                  </Badge>
                </div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Approval-critical AI workflows, shown through diligence.
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Run a private-market diligence review from pasted notes,
                  pause for human approval, evaluate risk completeness, and
                  generate an audit-ready IC memo.
                </p>
              </div>
              <Button
                asChild
                className="h-10 shrink-0 gap-2 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
              >
                <Link href="/workflows/template-private-market-diligence">
                  Open Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <TrustMetric
                icon={Zap}
                label="Backend"
                value="Local"
                detail="No Docker or API keys"
              />
              <TrustMetric
                icon={Target}
                label="Eval gate"
                value="0.88"
                detail="Risk completeness"
              />
              <TrustMetric
                icon={UserCheck}
                label="Review"
                value="HITL"
                detail="Approval before memo"
              />
              <TrustMetric
                icon={ShieldCheck}
                label="Audit"
                value="Traceable"
                detail="Cost, latency, nodes"
              />
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    Flagship Workflow
                  </h3>
                  <p className="text-sm text-slate-600">
                    The hiring demo path reviewers should try first.
                  </p>
                </div>
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                  Template
                </Badge>
              </div>
              <WorkflowRow
                workflow={
                  diligenceWorkflow || {
                    id: "template-private-market-diligence",
                    name: "Private Market Diligence Review",
                    description:
                      "Extract claims, flag risks, require human approval, and draft an IC memo.",
                    is_template: true,
                  }
                }
                featured
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">
                Demo Run Story
              </h3>
              <div className="mt-4 space-y-3">
                <RunStep icon={FileText} label="Paste or upload notes" />
                <RunStep icon={GitBranch} label="Extract claims and risks" />
                <RunStep icon={Target} label="Score completeness" />
                <RunStep icon={UserCheck} label="Approve flagged risks" />
                <RunStep icon={CheckCircle2} label="Review final IC report" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">
                Review Notes
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This demo intentionally uses deterministic local outputs. The
                product thesis is reliability, approvals, and auditability under
                AI workflow builders.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Workflow Library
              </h2>
              <p className="text-sm text-slate-600">
                Templates and session workflows available in this local demo.
              </p>
            </div>
            <Badge className="w-fit border-slate-200 bg-slate-50 text-slate-600">
              {workflows.length || 0} workflows
            </Badge>
          </div>

          {isLoading && (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading workflows
            </div>
          )}

          {error && (
            <div className="px-5 py-8 text-sm text-red-700">
              {error.message}
            </div>
          )}

          {!isLoading && !error && (
            <div className="divide-y divide-slate-100">
              {secondaryWorkflows.map((workflow: any) => (
                <WorkflowRow key={workflow.id} workflow={workflow} />
              ))}
              {secondaryWorkflows.length === 0 && (
                <div className="px-5 py-8 text-sm text-slate-500">
                  No secondary workflows yet.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function LinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-slate-600">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function TrustMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
      <div className="text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function RunStep({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-md bg-slate-100 p-1.5 text-slate-700">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  );
}

function WorkflowRow({
  workflow,
  featured = false,
}: {
  workflow: any;
  featured?: boolean;
}) {
  const isTemplate = workflow.id?.startsWith("template-");
  return (
    <Link
      href={`/workflows/${workflow.id}`}
      className="group grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-950 group-hover:text-emerald-700">
            {cleanWorkflowName(workflow.name)}
          </h3>
          {isTemplate && (
            <Badge className="border-slate-200 bg-slate-50 text-slate-600">
              Template
            </Badge>
          )}
          {featured && (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Recommended
            </Badge>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
          {workflow.description || "AI workflow orchestration"}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <Clock3 className="h-3.5 w-3.5" />
        <span>
          {isTemplate ? "Ready to run" : `Updated ${timeAgo(workflow.updated_at)}`}
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
      </div>
    </Link>
  );
}

function cleanWorkflowName(name: string) {
  return String(name || "Untitled Workflow")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
