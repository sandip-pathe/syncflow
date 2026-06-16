"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  useReactFlow,
  Panel,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomNode } from "./nodes/custom";
import { useWorkflowStore } from "@/lib/store";
import { EventHubNode } from "./nodes/event-hub-node";

import {
  WorkflowNode,
  NodeType,
  WorkflowEdge,
  TriggerConfig,
  AgentConfig,
  ApiCallConfig,
  ApprovalConfig,
  ConditionalConfig,
  EvalConfig,
  TimerConfig,
  EventConfig,
  MergeConfig,
  EndConfig,
  SpecificNodeConfig,
} from "@/types/workflow";

const nodeTypes: NodeTypes = {
  trigger: CustomNode,
  agent: CustomNode,
  api_call: CustomNode,
  approval: CustomNode,
  conditional: CustomNode,
  eval: CustomNode,
  merge: CustomNode,
  timer: CustomNode,
  event: EventHubNode,
  end: CustomNode,
};

const snapGrid: [number, number] = [15, 15];

const getDefaultConfig = (type: NodeType): SpecificNodeConfig => {
  switch (type) {
    case "trigger":
      return {
        name: "New Trigger",
        type: "manual",
        input_text: "",
      } as TriggerConfig;
    case "agent":
      return {
        name: "New Agent",
        system_instructions: "",
        temperature: 0.7,
        expected_output_format: "text",
      } as AgentConfig;
    case "api_call":
      return {
        name: "New API Call",
        url: "",
        method: "POST",
        headers: {},
        body: {},
      } as ApiCallConfig;
    case "approval":
      return {
        name: "New Approval",
        description: "Please review and approve",
        approver_email: "approvals@syncflow.local",
      } as ApprovalConfig;
    case "conditional":
      return {
        name: "New Conditional",
        condition_expression: "",
      } as ConditionalConfig;
    case "eval":
      return {
        name: "New Evaluation",
        eval_type: "schema",
        config: {},
        on_failure: "block",
      } as EvalConfig;
    case "timer":
      return {
        name: "New Timer",
        duration_seconds: 30,
      } as TimerConfig;
    case "event":
      return {
        name: "New Event",
        operation: "publish",
        channel: "",
      } as EventConfig;
    case "merge":
      return {
        name: "New Merge",
        merge_strategy: "combine",
      };
    case "end":
      return {
        name: "End Node",
        capture_output: true,
        show_output: true,
      };
    default:
      const _exhaustive: never = type;
      return {
        name: "Unknown Node",
      } as any;
  }
};

function WorkflowCanvasInner() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    addNode,
    setSelectedNode,
    layoutType,
    setLayoutType,
    mode,
    leftSidebarOpen,
    selectedNodeId,
    output,
  } = useWorkflowStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges as Edge[]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const hasSelectedNode = Boolean(selectedNodeId);
  const hasOutput = Boolean(output);

  useEffect(() => {
    setNodes(storeNodes);
  }, [storeNodes, setNodes]);

  useEffect(() => {
    setEdges(storeEdges as Edge[]);
  }, [storeEdges, setEdges]);

  useEffect(() => {
    if (storeNodes.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      fitView({ padding: 0.18, duration: 250 });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [
    fitView,
    hasOutput,
    hasSelectedNode,
    leftSidebarOpen,
    mode,
    storeNodes.length,
  ]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        ...connection,
        id: `e${connection.source}-${connection.target}`,
        type: "smoothstep",
        animated: mode === "executing",
      };
      setStoreEdges(addEdge(edge, storeEdges) as WorkflowEdge[]);
    },
    [storeEdges, setStoreEdges, mode]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as NodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const defaultConfig = getDefaultConfig(type);

      const newNode: WorkflowNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `New ${
            type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")
          }`, // Improved label
          type,
          status: "idle",
          config: defaultConfig,
          error: undefined,
          lastResult: undefined,
        },
      };
      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const handleLayoutToggle = useCallback(() => {
    setLayoutType(layoutType === "dag" ? "event-hub" : "dag");
  }, [layoutType, setLayoutType]);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        snapToGrid={false}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: mode === "executing",
          style: { strokeWidth: 2 },
        }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={4}
        className="bg-[#f8fafc]"
      >
        <Background color="#d8e2ee" gap={20} size={1} />
        <Controls
          className="rounded-md border border-slate-200 bg-white p-1 shadow-sm [&>button]:border-0 [&>button]:bg-white [&>button]:text-slate-600 [&>button:hover]:bg-slate-50"
          orientation="horizontal"
          position="bottom-center"
        />

        <MiniMap
          className="rounded-md border border-slate-200 bg-white shadow-sm"
          style={{ width: 180, height: 118 }}
          maskColor="rgba(15, 23, 42, 0.06)"
          nodeStrokeColor={() => "#64748b"}
          nodeBorderRadius={8}
          nodeStrokeWidth={2}
          pannable
          zoomable
          nodeColor={(node) => {
            const colors = {
              trigger: "#059669",
              agent: "#0f766e",
              api_call: "#0284c7",
              approval: "#d97706",
              conditional: "#2563eb",
              eval: "#1d4ed8",
              merge: "#475569",
              timer: "#0891b2",
              event: "#0d9488",
              end: "#0f172a",
            };
            return colors[node.type as NodeType] || "#64748b";
          }}
        />

        {/* Layout Toggle Panel */}
        <Panel position="top-right" className="flex gap-2">
          <Button
            variant={layoutType === "dag" ? "default" : "outline"}
            size="sm"
            onClick={handleLayoutToggle}
            className="select-none border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Layers className="w-4 h-4 mr-2" />
            {layoutType === "dag" ? "DAG Mode" : "Event Hub Mode"}
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
