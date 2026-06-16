"use client";

import { motion } from "framer-motion";
import { nodeTemplates } from "@/lib/mock-data";
import { NodeType } from "@/types/workflow";
import {
  Bot,
  Globe,
  Target,
  CheckCircle2,
  Clock,
  Radio,
  Merge,
  CheckCheck,
  GitBranchPlus,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconComponents = {
  trigger: Zap,
  agent: Bot,
  api_call: Globe,
  approval: CheckCheck,
  conditional: GitBranchPlus,
  eval: Target,
  merge: Merge,
  timer: Clock,
  event: Radio,
  end: CheckCircle2,
};

const groups = [
  {
    title: "Core Nodes",
    types: ["trigger", "agent", "api_call", "conditional", "end"],
  },
  {
    title: "Trust Nodes",
    types: ["approval", "eval", "timer", "event", "merge"],
  },
];

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="h-full border-r border-slate-200 bg-white overflow-y-auto">
      <div className="p-4 border-b border-slate-200">
        <p className="text-[11px] font-semibold uppercase text-slate-500">
          Builder
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Workflow Library
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Drag nodes onto the canvas.
        </p>
      </div>

      <div className="space-y-5 p-3">
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase text-slate-500">
              {group.title}
            </h3>
            <div className="space-y-1">
              {nodeTemplates
                .filter((template) => group.types.includes(template.type))
                .map((template, index) => {
                  const IconComponent =
                    iconComponents[template.type as NodeType];

                  return (
                    <motion.div
                      key={template.type}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      draggable
                      onDragStart={(e) => onDragStart(e as any, template.type)}
                      className={cn(
                        "cursor-grab rounded-md border border-transparent px-2 py-2 active:cursor-grabbing",
                        "transition hover:border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "rounded-md p-1.5 text-white",
                            template.color
                          )}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800">
                            {template.label}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {template.description}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
