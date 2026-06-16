import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  WorkflowNode,
  WorkflowEdge,
  WorkflowMode,
  ExecutionEvent,
  LayoutType,
  ApprovalRequest,
} from "@/types/workflow";
import {
  approvalFromEvent,
  getNodeStatusForEvent,
  isApprovalRequestedEvent,
} from "@/lib/workflow-events";

interface WorkflowState {
  // Core workflow data
  workflowId: string | null;
  workflowName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  mode: WorkflowMode;
  layoutType: LayoutType;

  // Selection
  selectedNodeId: string | null;

  // Execution data
  executionId: string | null; // <-- ADDED
  executionBackend: "local" | "temporal" | null;
  events: ExecutionEvent[];

  // UI state
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  bottomPanelOpen: boolean;

  // WebSocket
  wsConnected: boolean;
  currentApproval: ApprovalRequest | null;
  setCurrentApproval: (approval: ApprovalRequest | null) => void;

  output: { status: string; result: any } | null;
  setOutput: (output: { status: string; result: any } | null) => void;

  // Actions
  setWorkflowId: (id: string) => void; // <-- ADDED
  setWorkflowName: (name: string) => void; // <-- ADDED
  setExecutionId: (id: string | null) => void; // <-- ADDED
  setExecutionBackend: (backend: "local" | "temporal" | null) => void;
  setMode: (mode: WorkflowMode) => void;
  setLayoutType: (type: LayoutType) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, updates: Partial<WorkflowNode>) => void;
  deleteNode: (id: string) => void;
  updateNodeStatus: (
    id: string,
    status: WorkflowNode["data"]["status"]
  ) => void;
  setSelectedNode: (id: string | null) => void;
  addEvent: (event: ExecutionEvent) => void;
  applyExecutionEvent: (event: ExecutionEvent) => void;
  clearEvents: () => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleBottomPanel: () => void;
  setWsConnected: (connected: boolean) => void;
  resetWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  devtools((set, get) => ({
    // Initial state
    workflowId: null,
    workflowName: "Untitled Workflow",
    nodes: [],
    edges: [],
    mode: "design",
    layoutType: "dag",
    selectedNodeId: null,
    executionId: null,
    executionBackend: null,
    events: [],
    leftSidebarOpen: true,
    rightSidebarOpen: true,
    bottomPanelOpen: false,
    wsConnected: false,
    currentApproval: null,
    output: null,

    // Actions
    setCurrentApproval: (approval) => set({ currentApproval: approval }),
    setWorkflowId: (id) => set({ workflowId: id }),
    setWorkflowName: (name) => set({ workflowName: name }),
    setExecutionId: (id) => set({ executionId: id }),
    setExecutionBackend: (backend) => set({ executionBackend: backend }),

    setMode: (mode) => {
      set({ mode });
      if (mode === "executing") {
        set({
          leftSidebarOpen: true,
          rightSidebarOpen: true,
          bottomPanelOpen: true,
        });
      } else if (mode === "design") {
        set({
          leftSidebarOpen: true,
          rightSidebarOpen: true,
          bottomPanelOpen: false,
        });
      }
    },

    setLayoutType: (type) => set({ layoutType: type }),

    setNodes: (nodes) => set({ nodes }),

    setEdges: (edges) => set({ edges }),

    addNode: (node) =>
      set((state) => ({
        nodes: [...state.nodes, node],
      })),

    updateNode: (id, updates) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id
            ? { ...n, ...updates, data: { ...n.data, ...updates.data } }
            : n
        ),
      })),

    deleteNode: (id) =>
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
        selectedNodeId:
          state.selectedNodeId === id ? null : state.selectedNodeId,
      })),

    updateNodeStatus: (id, status) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, status } } : n
        ),
      })),

    setSelectedNode: (id) => set({ selectedNodeId: id }),

    addEvent: (event) =>
      set((state) => {
        // Prevent duplicate events based on timestamp + nodeId + eventType
        const eventKey = `${event.timestamp}-${event.nodeId}-${event.eventType}`;
        const isDuplicate = state.events.some(
          (e) => `${e.timestamp}-${e.nodeId}-${e.eventType}` === eventKey
        );

        if (isDuplicate) return state;

        return {
          events: [event, ...state.events], // Prepend for chronological order in UI
        };
      }),

    applyExecutionEvent: (event) => {
      get().addEvent(event);

      const status = getNodeStatusForEvent(event);
      if (event.nodeId && status) {
        get().updateNodeStatus(event.nodeId, status);
      }

      if (event.nodeId && event.eventType === "node.completed") {
        const result = event.data;
        const cost =
          result && typeof result === "object" && "cost" in result
            ? Number(result.cost)
            : undefined;
        const executionTime =
          result && typeof result === "object" && "latency_ms" in result
            ? Number(result.latency_ms) / 1000
            : undefined;
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === event.nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    lastResult: result,
                    ...(cost !== undefined ? { cost } : {}),
                    ...(executionTime !== undefined ? { executionTime } : {}),
                  },
                }
              : node
          ),
        }));
      }

      if (isApprovalRequestedEvent(event.eventType)) {
        const approval = approvalFromEvent(event);
        if (approval) {
          set({ currentApproval: approval, mode: "paused" });
        }
      }

      if (event.eventType === "workflow.completed") {
        set({
          mode: "completed",
          output: { status: "completed", result: event.data },
          currentApproval: null,
        });
      } else if (event.eventType === "workflow.failed") {
        set({
          mode: "failed",
          output: { status: "failed", result: event.error || event.data },
        });
      }
    },

    clearEvents: () => set({ events: [] }),

    toggleLeftSidebar: () =>
      set((state) => ({
        leftSidebarOpen: !state.leftSidebarOpen,
      })),

    toggleRightSidebar: () =>
      set((state) => ({
        rightSidebarOpen: !state.rightSidebarOpen,
      })),

    toggleBottomPanel: () =>
      set((state) => ({
        bottomPanelOpen: !state.bottomPanelOpen,
      })),

    setWsConnected: (connected) => set({ wsConnected: connected }),
    setOutput: (output) => set({ output }),

    resetWorkflow: () =>
      set({
        nodes: [],
        edges: [],
        mode: "design",
        selectedNodeId: null,
        executionId: null,
        executionBackend: null,
        events: [],
        layoutType: "dag",
        output: null,
      }),
  }))
);
