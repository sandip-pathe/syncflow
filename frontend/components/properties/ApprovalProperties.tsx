"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalConfig } from "@/types/workflow";
import { AlertCircle } from "lucide-react";

interface ApprovalPropertiesProps {
  config: ApprovalConfig;
  onUpdate: (key: string, value: any) => void;
}

export function ApprovalProperties({
  config,
  onUpdate,
}: ApprovalPropertiesProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={config.name || ""}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="e.g., Reviewer Approval"
          className="border-slate-200 bg-white text-slate-950"
        />
        <p className="text-xs text-slate-500">Required approval step title</p>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={config.description || ""}
          onChange={(e) => onUpdate("description", e.target.value)}
          placeholder="Review the previous step output before continuing..."
          rows={4}
          className="border-slate-200 bg-white text-slate-950"
        />
        <p className="text-xs text-slate-500">
          Required instructions for the approver
        </p>
      </div>

      <div className="space-y-2">
        <Label>Approver</Label>
        <Input
          value={config.approver_email || ""}
          onChange={(e) => onUpdate("approver_email", e.target.value)}
          placeholder="reviewer@example.com"
          className="border-slate-200 bg-white text-slate-950"
        />
        <p className="text-xs text-slate-500">
          Required for validation and local approval routing
        </p>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
          <div className="space-y-1 text-xs text-amber-800">
            <p className="font-semibold">Approval flow</p>
            <p>
              Workflow pauses at this node until a reviewer approves or rejects
              through the UI or API.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs text-blue-800">
          Connect <strong>approve</strong> and <strong>reject</strong> handles
          to different nodes when the workflow needs separate paths.
        </p>
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-600">
          Previous node output is shown as context to the approver.
        </p>
      </div>
    </div>
  );
}
