// frontend/hooks/useWorkflow.ts
import { useQuery } from "@tanstack/react-query";
import { useWorkflowStore } from "@/lib/store";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { resetWorkflowNodeRuntime } from "@/lib/workflow-events";

async function fetchWorkflow(workflowId: string) {
  return api.workflows.get(workflowId);
}

export function useWorkflow(workflowId: string) {
  const hydratedWorkflowIdRef = useRef<string | null>(null);
  const {
    setWorkflowId,
    setWorkflowName,
    setNodes,
    setEdges,
    clearEvents,
    setCurrentApproval,
    setExecutionBackend,
    setExecutionId,
    setMode,
    setOutput,
  } = useWorkflowStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => fetchWorkflow(workflowId),
    enabled: !!workflowId, // Only run the query if workflowId is not null
  });

  useEffect(() => {
    if (data) {
      if (hydratedWorkflowIdRef.current === data.id) {
        return;
      }
      hydratedWorkflowIdRef.current = data.id;
      setWorkflowId(data.id);
      setWorkflowName(data.name);
      // Changed to extract nodes and edges from data.definition
      const definition = data.definition || {};
      setNodes(resetWorkflowNodeRuntime(definition.nodes || []));
      setEdges(definition.edges || []);
      clearEvents();
      setCurrentApproval(null);
      setExecutionBackend(null);
      setExecutionId(null);
      setOutput(null);
      setMode("design");
    }
  }, [
    data,
    setWorkflowId,
    setWorkflowName,
    setNodes,
    setEdges,
    clearEvents,
    setCurrentApproval,
    setExecutionBackend,
    setExecutionId,
    setMode,
    setOutput,
  ]);

  return { workflow: data, isLoading, error };
}
