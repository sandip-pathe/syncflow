"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkflowStore } from "@/lib/store";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Download,
  Sidebar,
  Loader2,
  Square,
  RotateCcw,
  Pause,
  PlayCircle,
  RefreshCw,
  Upload,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api";
import Link from "next/link";
import {
  approvalFromPendingApproval,
  normalizeBackendEvents,
  resetWorkflowNodeRuntime,
} from "@/lib/workflow-events";
import { RunInputModal } from "@/components/modals/run-input";

export function ExecutionToolbar() {
  const {
    mode,
    setMode,
    workflowName,
    executionBackend,
    toggleLeftSidebar,
    leftSidebarOpen,
    addEvent,
    setNodes,
    setEdges,
    nodes,
    edges,
    workflowId,
    setExecutionId,
    setExecutionBackend,
    executionId,
    clearEvents,
    applyExecutionEvent,
    setCurrentApproval,
    setOutput,
  } = useWorkflowStore();
  const [runInputOpen, setRunInputOpen] = useState(false);
  const isDiligenceWorkflow =
    workflowId === "template-private-market-diligence";

  const runDefaultInput = useMemo(() => {
    const triggerNode = nodes.find((node) => node.type === "trigger");
    const triggerConfig = triggerNode?.data?.config as any;
    if (triggerConfig?.input_text) return triggerConfig.input_text;
    if (!isDiligenceWorkflow) return "";

    return "Company memo: Revenue grew 42% YoY, gross retention is above 90%, enterprise pipeline is concentrated in six accounts, and AI automation is expected to drive expansion margin.";
  }, [isDiligenceWorkflow, nodes]);

  const handleRunWorkflow = (inputData: { input_text: string; source_name?: string }) => {
    setRunInputOpen(false);
    setNodes(resetWorkflowNodeRuntime(nodes));
    setCurrentApproval(null);
    setOutput(null);
    executeMutation.mutate(inputData);
  };

  const persistedPayload = useMemo(
    () => ({
      name: workflowName,
      nodes: nodes.map(({ id, type, position, data }) => {
        const {
          status: _status,
          lastResult: _lastResult,
          cost: _cost,
          executionTime: _executionTime,
          error: _error,
          ...persistedData
        } = data as any;

        return {
          id,
          type,
          position,
          data: persistedData,
        };
      }),
      edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
      })),
    }),
    [edges, nodes, workflowName]
  );

  const persistedSnapshot = useMemo(
    () => JSON.stringify(persistedPayload),
    [persistedPayload]
  );

  const executeMutation = useMutation({
    mutationFn: async (inputData: any) => {
      if (!workflowId) throw new Error("No workflow ID.");

      return fetch(apiUrl(`api/workflows/${workflowId}/execute`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_data: inputData }),
      }).then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();

          if (errorData.detail?.errors) {
            // Open left sidebar to show errors
            if (!leftSidebarOpen) toggleLeftSidebar();

            // Show validation errors in event log
            addEvent({
              id: `validation-error-${Date.now()}`,
              workflowId: workflowId || "",
              executionId: "",
              nodeId: "",
              eventType: "workflow.failed",
              timestamp: new Date().toISOString(),
              data: {
                error: "Workflow validation failed",
                errors: errorData.detail.errors,
                message:
                  errorData.detail.message ||
                  "Please fix the issues and try again",
              },
            });

            // Show user-friendly error toast
            toast.error("Workflow validation failed", {
              description: `Found ${errorData.detail.errors.length} issue(s). Check the event log for details.`,
              duration: 5000,
            });

            // Also show first few errors
            errorData.detail.errors
              .slice(0, 3)
              .forEach((error: string, idx: number) => {
                setTimeout(() => {
                  toast.error(`Issue ${idx + 1}`, {
                    description: error,
                    duration: 7000,
                  });
                }, (idx + 1) * 500);
              });

            return Promise.reject(
              new Error(
                errorData.detail.message || "Workflow validation failed"
              )
            );
          }

          // Generic error
          toast.error("Execution failed", {
            description:
              errorData.message ||
              "An unexpected error occurred. Please try again.",
          });

          return Promise.reject(new Error("Failed to start execution."));
        }
        return res.json();
      });
    },

    onSuccess: (data) => {
      clearEvents();
      setExecutionId(data.execution_id);
      setExecutionBackend(data.execution_backend || "temporal");

      normalizeBackendEvents(data.events).forEach((event) => {
        applyExecutionEvent(event);
      });

      const pendingApproval = approvalFromPendingApproval(
        data.pending_approval
      );
      if (pendingApproval) {
        setCurrentApproval(pendingApproval);
      }

      if (data.output) {
        setOutput({ status: data.status, result: data.output });
      }

      if (data.status === "completed") {
        setMode("completed");
      } else if (data.status === "waiting_approval") {
        setMode("paused");
      } else if (data.status === "failed") {
        setMode("failed");
      } else {
        setMode("executing");
      }

      toast.success(data.status === "completed" ? "Execution completed" : "Execution started", {
        description: `ID: ${data.execution_id}`,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId || !executionId) throw new Error("No active execution");
      return fetch(
        apiUrl(`api/workflows/${workflowId}/pause?execution_id=${executionId}`),
        {
          method: "POST",
        }
      ).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to pause"))
      );
    },
    onSuccess: () => {
      toast.success("Workflow paused");
      setMode("paused");
    },
    onError: (e: Error) => toast.error(`Pause failed: ${e.message}`),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId || !executionId) throw new Error("No paused execution");
      return fetch(
        apiUrl(
          `api/workflows/${workflowId}/resume?execution_id=${executionId}`
        ),
        {
          method: "POST",
        }
      ).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to resume"))
      );
    },
    onSuccess: () => {
      toast.success("Workflow resumed");
      setMode("executing");
    },
    onError: (e: Error) => toast.error(`Resume failed: ${e.message}`),
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) throw new Error("No workflow ID");
      // Re-execute with same input
      const triggerNode = nodes.find((n) => n.type === "trigger");
      const triggerConfig = triggerNode?.data?.config as any;
      const inputVars = triggerConfig?.input_text
        ? { input_text: triggerConfig.input_text }
        : triggerConfig?.input_variables || {};

      return fetch(apiUrl(`api/workflows/${workflowId}/execute`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_data: inputVars }),
      }).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Retry failed"))
      );
    },
    onSuccess: (data) => {
      toast.success("Workflow restarted!", {
        description: `New execution: ${data.execution_id}`,
      });
      setExecutionId(data.execution_id);
      setExecutionBackend(data.execution_backend || "temporal");
      clearEvents();
      normalizeBackendEvents(data.events).forEach((event) => {
        applyExecutionEvent(event);
      });
      const pendingApproval = approvalFromPendingApproval(
        data.pending_approval
      );
      if (pendingApproval) {
        setCurrentApproval(pendingApproval);
      }
      if (data.output) {
        setOutput({ status: data.status, result: data.output });
      }
      setMode(
        data.status === "completed"
          ? "completed"
          : data.status === "waiting_approval"
          ? "paused"
          : "executing"
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof persistedPayload) => {
      if (!workflowId) throw new Error("No workflow ID.");
      return fetch(apiUrl(`api/workflows/${workflowId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to save."))
      );
    },
    onError: () => undefined,
  });

  // Auto-save when nodes or edges change
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastAutosaveSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    if (!workflowId || nodes.length === 0 || mode !== "design") return;

    if (lastAutosaveSnapshotRef.current === null) {
      lastAutosaveSnapshotRef.current = persistedSnapshot;
      return;
    }

    if (lastAutosaveSnapshotRef.current === persistedSnapshot) {
      return;
    }

    // Debounce saves by 2 seconds
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      lastAutosaveSnapshotRef.current = persistedSnapshot;
      saveMutation.mutate(persistedPayload);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    mode,
    nodes.length,
    persistedPayload,
    persistedSnapshot,
    saveMutation,
    workflowId,
  ]);

  // Export workflow as JSON
  const handleExport = () => {
    const workflowData = {
      name: workflowName,
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      nodes: nodes.map(({ id, type, position, data }) => ({
        id,
        type,
        position,
        data,
      })),
      edges: edges.map(
        ({ id, source, target, sourceHandle, targetHandle }) => ({
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
        })
      ),
    };

    const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workflowName
      .replace(/\s+/g, "-")
      .toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Workflow exported!", {
      description: "Downloaded as JSON file",
    });
  };

  // Import workflow from JSON
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);

        if (!importedData.nodes || !importedData.edges) {
          throw new Error("Invalid workflow file format");
        }

        setNodes(importedData.nodes);
        setEdges(importedData.edges);

        toast.success("Workflow imported!", {
          description: `Loaded ${importedData.nodes.length} nodes`,
        });

      } catch (error) {
        toast.error("Import failed", {
          description:
            error instanceof Error ? error.message : "Invalid file format",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="fixed top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-900 shadow-sm">
        <TooltipProvider>
          {/* Home/Logo Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-slate-100"
                >
                  <Home className="w-4 h-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Back to Dashboard</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-6 bg-slate-200" />
          <div className="flex items-center gap-2 px-2">
            <h1 className="max-w-48 truncate text-sm font-semibold">
              {workflowName}
            </h1>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
              {executionBackend === "temporal" ? "Temporal" : "Local Demo"}
            </span>
          </div>
          <Separator orientation="vertical" className="h-6 bg-slate-200" />
          <Button
            data-testid="workflow-run-button"
            onClick={() => setRunInputOpen(true)}
            disabled={mode === "executing" || executeMutation.isPending}
            className="h-8 bg-emerald-600 px-3 text-white hover:bg-emerald-700"
          >
            {executeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="ml-1">Run</span>
          </Button>

          {/* Pause Button */}
          {mode === "executing" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  size="icon"
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                >
                  {pauseMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pause Execution</TooltipContent>
            </Tooltip>
          )}

          {/* Resume Button */}
          {mode === "paused" && executionBackend !== "local" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-green-500 hover:bg-green-600 text-white"
                  size="icon"
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                >
                  {resumeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume Execution</TooltipContent>
            </Tooltip>
          )}

          {/* Retry Button */}
          {mode === "failed" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                  size="icon"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry Workflow</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                size="icon"
                onClick={() => setMode("design")}
                disabled={mode === "design"}
              >
                <Square className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop Execution</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-6 bg-slate-200" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-slate-100"
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export Workflow</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-slate-100"
                onClick={() => document.getElementById("import-file")?.click()}
              >
                <Upload className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import Workflow</TooltipContent>
          </Tooltip>
          <input
            id="import-file"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-slate-100"
                onClick={() => {
                  if (confirm("Clear this canvas?")) {
                    setNodes([]);
                    setEdges([]);
                  }
                }}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset Canvas</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-6 bg-slate-200" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={leftSidebarOpen ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={toggleLeftSidebar}
              >
                <Sidebar className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Left Panel</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <RunInputModal
        open={runInputOpen}
        defaultValue={runDefaultInput}
        isDiligenceWorkflow={isDiligenceWorkflow}
        isRunning={executeMutation.isPending}
        onClose={() => setRunInputOpen(false)}
        onRun={handleRunWorkflow}
      />
    </>
  );
}
