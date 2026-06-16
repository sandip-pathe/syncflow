"use client";

import { useEffect, useState } from "react";
import { useWorkflowWebSocket } from "@/hooks/useWorkflowWebSocket";
import { useWorkflow } from "@/hooks/useWorkflow";
import { ApprovalModal } from "@/components/modals/approval";
import { EventLogStream } from "@/components/sidebar/event-log";
import { WorkflowCanvas } from "@/components/canvas/canvas";
import { useWorkflowStore } from "@/lib/store";
import { ExecutionToolbar } from "@/components/toolbar/top";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { NarrationModal } from "@/components/modals/narration";
import { NodePalette } from "@/components/sidebar/node-pallete";
import { PropertiesPanel } from "@/components/sidebar/properties";
import { OutputPanel } from "@/components/sidebar/output";
import { WorkflowProgressIndicator } from "@/components/toolbar/progress-indicator";
import { api } from "@/lib/api";
import { normalizeBackendEvent } from "@/lib/workflow-events";
import { WorkflowReportModal } from "@/components/modals/workflow-report";

export default function WorkflowEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const {
    mode,
    workflowName,
    leftSidebarOpen,
    selectedNodeId,
    setWorkflowId,
    executionId,
    executionBackend,
    events,
    currentApproval,
    setCurrentApproval,
    applyExecutionEvent,
    setMode,
    setOutput,
    output,
  } = useWorkflowStore();
  const [isNarrationModalOpen, setIsNarrationModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    setWorkflowId(params.id);
  }, [params.id, setWorkflowId]);

  const { isLoading: isWorkflowLoading, error } = useWorkflow(params.id);
  useWorkflowWebSocket(
    executionId,
    executionBackend !== "local" && (mode === "executing" || mode === "paused")
  );

  useEffect(() => {
    if ((mode === "completed" || mode === "failed") && output) {
      setIsReportOpen(true);
    }
  }, [mode, output]);

  const respondToApprovalMutation = useMutation({
    mutationFn: ({
      action,
      comment,
      executionId,
    }: {
      action: "approve" | "reject";
      comment: string;
      executionId: string;
    }) => {
      return api.approvals.approve(executionId, {
        action,
        approver: "approvals@syncflow.local",
        comment,
      });
    },
    onSuccess: (data) => {
      toast.success(`Request ${data.status}!`);
      setCurrentApproval(null);
      data.events?.forEach((event: any) =>
        applyExecutionEvent(normalizeBackendEvent(event))
      );
      if (data.output) {
        setOutput({ status: data.execution_status || "completed", result: data.output });
      }
      if (data.execution_status === "completed") {
        setMode("completed");
      } else if (data.execution_status === "failed") {
        setMode("failed");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const {
    data: narrationData,
    isLoading: isNarrationLoading,
    refetch: fetchNarration,
  } = useQuery({
    queryKey: ["narration", executionId],
    queryFn: () => (executionId ? api.executions.narrate(executionId) : null),
    enabled: false,
  });

  if (isWorkflowLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50 text-red-700">
        {error.message}
      </div>
    );
  }

  const isTerminalMode = mode === "completed" || mode === "failed";
  const isRunMode = mode === "executing" || mode === "paused";
  const hasDesignEvents = mode === "design" && !selectedNodeId && events.length > 0;
  const isDiligenceWorkflow =
    params.id === "template-private-market-diligence";
  const showLeftRail = leftSidebarOpen && mode === "design";
  const showRightRail = Boolean(
    (mode === "design" && selectedNodeId) ||
      hasDesignEvents ||
      isRunMode ||
      (isTerminalMode && output)
  );
  const rightRailContent =
    mode === "design" ? (
      hasDesignEvents ? (
        <EventLogStream
          onViewReport={() => {
            fetchNarration();
            setIsNarrationModalOpen(true);
          }}
        />
      ) : (
        <PropertiesPanel />
      )
    ) : isRunMode ? (
      <EventLogStream
        onViewReport={() => {
          fetchNarration();
          setIsNarrationModalOpen(true);
        }}
      />
    ) : (
      <OutputPanel onOpenReport={() => setIsReportOpen(true)} />
    );

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `${
            showLeftRail ? "288px " : ""
          }minmax(0, 1fr)${showRightRail ? " 380px" : ""}`,
        }}
      >
        {showLeftRail && (
          <aside className="min-w-0 border-r border-slate-200 bg-white">
            <NodePalette />
          </aside>
        )}

        <main className="relative min-w-0 overflow-hidden">
          <WorkflowCanvas />
        </main>

        {showRightRail && (
          <aside className="min-w-0 border-l border-slate-200 bg-white">
            <div className="h-full pt-20">{rightRailContent}</div>
          </aside>
        )}
      </div>

      <ExecutionToolbar />
      <WorkflowProgressIndicator />

      <ApprovalModal
        open={!!currentApproval}
        onClose={() => setCurrentApproval(null)}
        onApprove={async (c) => {
          if (!currentApproval) return;
          await respondToApprovalMutation.mutateAsync({
            action: "approve",
            comment: c,
            executionId: currentApproval.executionId,
          });
        }}
        onReject={async (c) => {
          if (!currentApproval) return;
          await respondToApprovalMutation.mutateAsync({
            action: "reject",
            comment: c,
            executionId: currentApproval.executionId,
          });
        }}
        approval={currentApproval}
      />
      <NarrationModal
        open={isNarrationModalOpen}
        onClose={() => setIsNarrationModalOpen(false)}
        narration={narrationData?.narration}
        isLoading={isNarrationLoading}
      />
      <WorkflowReportModal
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        output={output}
        workflowName={workflowName}
        executionBackend={executionBackend}
        isDiligenceWorkflow={isDiligenceWorkflow}
      />
    </div>
  );
}
