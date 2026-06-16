"use client";

import { useEffect, useRef } from "react";
import { useWorkflowStore } from "@/lib/store";
import { toast } from "sonner";
import { wsUrl } from "@/lib/api";
import {
  isApprovalRequestedEvent,
  normalizeBackendEvent,
} from "@/lib/workflow-events";

interface WebSocketMessageStructure {
  event_type: string;
  data: string | Record<string, any>;
  timestamp: string;
}

export function useWorkflowWebSocket(
  executionId: string | null,
  enabled: boolean = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const { applyExecutionEvent, setWsConnected } = useWorkflowStore();

  useEffect(() => {
    if (!executionId || !enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWsConnected(false);
      }
      return;
    }

    const url = wsUrl(`api/events/ws/executions/${executionId}`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setWsConnected(true);
      toast.info("Real-time connection established.");
    };

    ws.onmessage = (event) => {
      try {
        const outerMessage: WebSocketMessageStructure = JSON.parse(event.data);
        const executionEvent = normalizeBackendEvent(outerMessage);
        applyExecutionEvent(executionEvent);

        if (executionEvent.eventType === "workflow.completed") {
          toast.success("Workflow completed successfully.");
          ws.close();
        } else if (executionEvent.eventType === "workflow.failed") {
          toast.error("Workflow failed", {
            description: executionEvent.error || "Unknown error",
          });
          ws.close();
        } else if (isApprovalRequestedEvent(executionEvent.eventType)) {
          toast.info("Approval required before the workflow continues.");
        }
      } catch {
        toast.error("Failed to process workflow event.");
      }
    };

    ws.onerror = () => {
      toast.error("WebSocket connection error.");
      setWsConnected(false);
    };

    ws.onclose = (closeEvent) => {
      setWsConnected(false);
      if (closeEvent.code !== 1000 && closeEvent.code !== 1005) {
        toast.warning("WebSocket connection closed unexpectedly.");
      }
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
        setWsConnected(false);
      }
    };
  }, [executionId, enabled, applyExecutionEvent, setWsConnected]);
}
