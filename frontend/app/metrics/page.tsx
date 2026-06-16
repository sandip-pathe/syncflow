import { MetricsDashboard } from "@/components/dashboard/metrics";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Metrics - SyncFlow",
  description:
    "Monitor workflow runs, approval-critical execution health, latency, cost, and agent reliability.",
  keywords:
    "metrics, analytics, workflow metrics, performance monitoring, AI agent metrics, dashboard",
  openGraph: {
    title: "Metrics Dashboard - SyncFlow",
    description: "Workflow run and AI agent performance metrics",
    type: "website",
  },
};

export default function MetricsPage() {
  return <MetricsDashboard />;
}
