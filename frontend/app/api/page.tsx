"use client";

import {
  CheckCircle2,
  Code2,
  ExternalLink,
  GitBranch,
  ListChecks,
  Play,
  ShieldCheck,
  Terminal,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const endpoints = [
  {
    method: "GET",
    path: "/api/workflows",
    title: "List workflows",
    body: "Returns templates first, including the Private Market Diligence Review reviewer path.",
  },
  {
    method: "POST",
    path: "/api/workflows",
    title: "Create workflow",
    body: "Creates a blank workflow definition with nodes, edges, and a generated operator-friendly name.",
  },
  {
    method: "POST",
    path: "/api/workflows/:id/execute",
    title: "Run workflow",
    body: "Starts local or Temporal execution depending on EXECUTION_BACKEND.",
  },
  {
    method: "POST",
    path: "/api/approvals/:executionId/approve",
    title: "Respond to approval",
    body: "Records approve or reject, then resumes local execution or signals Temporal.",
  },
];

const frontendContract = [
  {
    title: "Local responses",
    body: "The execute endpoint can return events, output, and pending_approval immediately.",
    icon: Play,
  },
  {
    title: "Temporal events",
    body: "Temporal mode keeps the async contract and streams state over WebSockets.",
    icon: GitBranch,
  },
  {
    title: "One normalizer",
    body: "Both paths use the same frontend helper before updating node status or approval state.",
    icon: ListChecks,
  },
  {
    title: "Approval resume",
    body: "Approval responses can include continuation events and final output in local mode.",
    icon: UserCheck,
  },
];

export default function APIPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="border-b border-slate-200 pb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-3 text-emerald-700">
              <Terminal className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">SyncFlow API</h1>
              <p className="mt-1 text-sm text-slate-600">
                Workflow design, local demo execution, approvals, event normalization, and audit output.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <a href={`${baseUrl}/docs`} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <ExternalLink className="h-4 w-4" />
                Open Swagger
              </Button>
            </a>
          </div>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Code2 className="h-4 w-4" />
              Base URL
            </div>
            <code className="mt-4 block rounded-md bg-slate-950 px-4 py-3 text-sm text-white">
              {baseUrl}
            </code>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              The local proof-of-work does not require auth. A production
              deployment should add auth, tenant isolation, and stricter CORS
              settings before exposing workflow execution.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <GitBranch className="h-4 w-4" />
              Execution contract
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              SyncFlow keeps the existing execute endpoint stable. Local mode
              extends the response with frontend-ready events and output, while
              Temporal mode keeps the original async shape and relies on
              WebSocket events for live state updates.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {endpoints.map((endpoint) => (
            <article
              key={`${endpoint.method}-${endpoint.path}`}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
                  {endpoint.method}
                </span>
                <code className="text-sm text-slate-700">{endpoint.path}</code>
              </div>
              <h2 className="mt-4 text-base font-semibold">{endpoint.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {endpoint.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-emerald-700" />
            <h2 className="text-xl font-semibold">Run Example</h2>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-white">
            <pre>{`curl -X POST "${baseUrl}/api/workflows/template-private-market-diligence/execute" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input_data": {
      "input_text": "Revenue grew 42% YoY, gross retention is above 90%, and enterprise pipeline is concentrated in six accounts.",
      "source_name": "sample-memo.txt"
    }
  }'`}</pre>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <ResponseField
              icon={CheckCircle2}
              title="events"
              body="Frontend-ready execution timeline in local mode."
            />
            <ResponseField
              icon={UserCheck}
              title="pending_approval"
              body="Approval modal payload when the run pauses."
            />
            <ResponseField
              icon={ShieldCheck}
              title="output"
              body="Final report data after a completed local run."
            />
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {frontendContract.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <item.icon className="h-5 w-5 text-slate-700" />
              <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Response Shapes</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <CodeBlock
              title="Local execute"
              code={`{
  "execution_id": "...",
  "workflow_id": "...",
  "status": "waiting_approval",
  "execution_backend": "local",
  "events": [],
  "pending_approval": {},
  "output": null
}`}
            />
            <CodeBlock
              title="Local approval resume"
              code={`{
  "status": "approved",
  "execution_status": "completed",
  "execution_backend": "local",
  "events": [],
  "output": {}
}`}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ResponseField({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CheckCircle2;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <Icon className="h-4 w-4 text-emerald-700" />
      <h3 className="mt-2 font-mono text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-2 text-xs font-medium text-slate-300">
        {title}
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-white">{code}</pre>
    </div>
  );
}
