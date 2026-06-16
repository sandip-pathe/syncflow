"use client";

import { useWorkflowStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, Trash2, AlertTriangle } from "lucide-react";
import { WorkflowNode, SpecificNodeConfig } from "@/types/workflow";
import {
  TriggerProperties,
  AgentProperties,
  ApiCallProperties,
  ConditionalProperties,
  EndProperties,
  ApprovalProperties,
  EvalProperties,
  MergeProperties,
  EventProperties,
  TimerProperties,
} from "@/components/properties";

export function PropertiesPanel() {
  const { nodes, selectedNodeId, updateNode, deleteNode, setSelectedNode } =
    useWorkflowStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-4 text-center text-slate-500">
        Select a node to view its properties.
      </div>
    );
  }

  // Generic config update function
  const handleConfigUpdate = (key: string, value: any) => {
    if (!selectedNode) return;
    const currentConfig = selectedNode.data.config || {};
    const newConfig = { ...currentConfig, [key]: value };

    updateNode(selectedNode.id, {
      data: { ...selectedNode.data, config: newConfig as SpecificNodeConfig },
    });
  };

  const handleLabelUpdate = (label: string) => {
    if (!selectedNode) return;
    updateNode(selectedNode.id, {
      data: { ...selectedNode.data, label },
    });
  };

  const handleDelete = () => {
    if (!selectedNodeId) return;
    if (confirm("Are you sure you want to delete this node?")) {
      deleteNode(selectedNodeId);
      setSelectedNode(null);
    }
  };

  // Render specific property component based on node type
  const renderNodeProperties = (node: WorkflowNode) => {
    const config = node.data.config || {};

    switch (node.type) {
      case "trigger":
        return (
          <TriggerProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "agent":
        return (
          <AgentProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "api_call":
        return (
          <ApiCallProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "conditional":
        return (
          <ConditionalProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "end":
        return (
          <EndProperties config={config as any} onUpdate={handleConfigUpdate} />
        );
      case "approval":
        return (
          <ApprovalProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "eval":
        return (
          <EvalProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "merge":
        return (
          <MergeProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "event":
        return (
          <EventProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      case "timer":
        return (
          <TimerProperties
            config={config as any}
            onUpdate={handleConfigUpdate}
          />
        );
      default:
        const _exhaustiveCheck: never = node.type;
        console.warn(
          "Unhandled node type in properties panel:",
          _exhaustiveCheck as string
        );
        return (
          <div className="text-sm text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Configuration UI not implemented for node type: {node.type}
          </div>
        );
    }
  };

  // Get node type display name
  const getNodeTypeDisplay = (type: string): string => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div
      className="h-full overflow-y-auto bg-white text-slate-950"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Header */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-950">
            {getNodeTypeDisplay(selectedNode.type)} Node
          </h2>
        </div>
      </div>

      {/* Panel Content */}
      <div className="p-4 space-y-4">
        {/* Label */}
        <div className="space-y-2">
          <Label htmlFor={`node-label-${selectedNodeId}`}>Node Label</Label>
          <Input
            id={`node-label-${selectedNodeId}`}
            value={selectedNode.data.label || ""}
            onChange={(e) => handleLabelUpdate(e.target.value)}
            placeholder="Node label"
            className="border-slate-200 bg-white text-slate-950"
          />
          <p className="text-xs text-slate-500">Display name in the canvas</p>
        </div>

        <Separator className="bg-slate-200" />

        {/* Configuration Section */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-700">
            Configuration
          </h3>
          {renderNodeProperties(selectedNode)}
        </div>

        <Separator className="bg-slate-200" />

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="destructive"
            className="w-full bg-red-900/80 hover:bg-red-900 text-white"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Node
          </Button>
        </div>
      </div>
    </div>
  );
}
