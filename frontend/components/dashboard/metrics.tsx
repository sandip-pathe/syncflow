"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

// API fetching functions
async function fetchSummaryMetrics() {
  return api.metrics.summary();
}

async function fetchAgentMetrics() {
  return api.metrics.agents();
}

export function MetricsDashboard() {
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["summaryMetrics"],
    queryFn: fetchSummaryMetrics,
    retry: false,
  });
  const {
    data: agentMetrics,
    isLoading: isAgentLoading,
    error: agentError,
  } = useQuery({
    queryKey: ["agentMetrics"],
    queryFn: fetchAgentMetrics,
    retry: false,
  });

  if (isSummaryLoading || isAgentLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (summaryError || agentError || !summary) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-5 w-5" />
            Metrics unavailable
          </div>
          <p className="mt-2 text-sm leading-6">
            The dashboard could not load metrics from the backend. Confirm the
            backend is running and the metrics API is reachable at
            /api/metrics/summary.
          </p>
        </div>
      </div>
    );
  }

  const agents = Array.isArray(agentMetrics) ? agentMetrics : [];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold">Run Metrics</h1>
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Executions"
              value={summary.total_executions}
              icon={Activity}
            />
            <MetricCard
              title="Success Rate"
              value={`${summary.success_rate}%`}
              icon={CheckCircle2}
            />
            <MetricCard title="Failed" value={summary.failed} icon={XCircle} />
            <MetricCard
              title="Running"
              value={summary.running}
              icon={Loader2}
            />
          </div>
        </TabsContent>
        <TabsContent value="agents" className="space-y-4">
          {agents.length > 0 ? (
            agents.map((agent: any) => (
              <Card key={`${agent.provider}-${agent.agent_id}`}>
                <CardHeader>
                  <CardTitle>
                    {agent.provider}:{" "}
                    <span className="font-mono">{agent.agent_id}</span>
                  </CardTitle>
                  <CardDescription>
                    {agent.executions} executions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Reliability</p>
                      <p className="font-semibold">
                        {`${(Number(agent.reliability_score || 0) * 100).toFixed(
                          1
                        )}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Avg. Latency</p>
                      <p className="font-semibold">
                        {Number(agent.avg_latency_ms || 0).toFixed(0)}ms
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Cost</p>
                      <p className="font-semibold">
                        ${Number(agent.total_cost || 0).toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={Number(agent.reliability_score || 0) * 100}
                    className="mt-4 h-2"
                  />
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No agent metrics yet</CardTitle>
                <CardDescription>
                  Run a workflow to populate agent reliability, latency, and cost
                  metrics.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
