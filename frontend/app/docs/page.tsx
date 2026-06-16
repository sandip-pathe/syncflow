"use client";

import {
  ArrowRight,
  Book,
  CheckCircle2,
  Clock,
  GitBranch,
  ListChecks,
  PanelsTopLeft,
  ShieldCheck,
  Terminal,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const localSteps = [
  "Start the backend with EXECUTION_BACKEND=local.",
  "Start the frontend and open SyncFlow.",
  "Open Private Market Diligence Review.",
  "Paste notes or upload a supported text file.",
  "Run, approve the risk gate, then inspect the report.",
];

const trustFeatures = [
  {
    title: "Local demo runner",
    body: "Deterministic node execution without Temporal, Redis, OpenAI, Docker, or cloud credentials.",
    icon: Terminal,
  },
  {
    title: "Approval pause",
    body: "Execution stops at the human gate and resumes only after the API records the decision.",
    icon: UserCheck,
  },
  {
    title: "Eval gate",
    body: "Intermediate output gets a quality score before downstream memo generation runs.",
    icon: CheckCircle2,
  },
  {
    title: "Audit report",
    body: "Final output, approval decision, cost, latency, eval score, and node evidence stay together.",
    icon: ShieldCheck,
  },
];

const architectureNotes = [
  {
    title: "Frontend builder",
    body: "React Flow owns canvas interaction while the Zustand store owns workflow mode, node status, approvals, output, and execution events.",
    icon: PanelsTopLeft,
  },
  {
    title: "Event normalization",
    body: "Local execute responses and WebSocket events pass through one frontend helper, so legacy approval names still update the same node states.",
    icon: GitBranch,
  },
  {
    title: "Mode-aware inspector",
    body: "Design mode shows selected node config, run mode shows the execution timeline, and completed mode shows the report summary.",
    icon: ListChecks,
  },
  {
    title: "Approval UX",
    body: "The modal waits for the approval API to succeed before closing, then applies continuation events and final output.",
    icon: UserCheck,
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="border-b border-slate-200 pb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-3 text-emerald-700">
              <Book className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">SyncFlow Docs</h1>
              <p className="mt-1 text-sm text-slate-600">
                Durable AI workflow builder for approval-critical enterprise runs.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <Link href="/api">
              <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                API Reference
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Local demo first
            </div>
            <h2 className="text-2xl font-semibold">
              Review the trust layer without external infrastructure.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              SyncFlow is a proof-of-work for the reliability layer underneath
              visual AI workflow builders: local execution, human approvals,
              eval gates, event timelines, audit reports, and a preserved
              Temporal path for durable production runs.
            </p>

            <ol className="mt-5 space-y-3">
              {localSteps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-slate-700">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Clock className="h-4 w-4" />
              Flagship reviewer path
            </div>
            <h2 className="mt-3 text-2xl font-semibold">
              Private Market Diligence Review
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The template turns investment notes into extracted claims, risk
              flags, an eval score, a partner approval gate, and a final IC memo
              section with audit metadata.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {trustFeatures.map((feature) => (
            <article
              key={feature.title}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <feature.icon className="h-5 w-5 text-emerald-700" />
              <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {feature.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-slate-700" />
            <h2 className="text-xl font-semibold">Execution Modes</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-semibold text-emerald-950">
                EXECUTION_BACKEND=local
              </h3>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                The default reviewer mode. It reuses the workflow definition,
                runs deterministic node outputs, creates approval requests, and
                returns frontend-ready events directly from the execute API.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">
                EXECUTION_BACKEND=temporal
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Production-oriented mode. The existing Temporal client and
                worker path remain available for long-running workflows,
                retries, and external activity orchestration.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {architectureNotes.map((note) => (
            <article
              key={note.title}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <note.icon className="h-5 w-5 text-slate-700" />
              <h3 className="mt-3 text-sm font-semibold">{note.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {note.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">
            Why this matters for no-code AI workflows
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Visual builders make it easy to connect model calls. Enterprise
            users still need to know what ran, what it cost, which quality gate
            passed, who approved the risky step, and whether the run can be
            replayed or audited. SyncFlow focuses on those operator questions
            instead of trying to become a broad marketplace in two days.
          </p>
        </section>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Intentional 2-Day Boundaries</h2>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
            <li>Real PDF and DOCX parsing is not implemented yet.</li>
            <li>Model calls are deterministic in local demo mode.</li>
            <li>RBAC, multi-tenancy, and marketplace features are out of scope.</li>
            <li>Temporal mode remains the production reliability story.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
