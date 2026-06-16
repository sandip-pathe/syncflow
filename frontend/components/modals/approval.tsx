"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ApprovalRequest } from "@/types/workflow";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ApprovalModalProps {
  approval: ApprovalRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove: (comment: string) => Promise<void> | void;
  onReject: (comment: string) => Promise<void> | void;
}

export function ApprovalModal({
  approval,
  open,
  onClose,
  onApprove,
  onReject,
}: ApprovalModalProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!approval) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(comment);
      setComment("");
      onClose();
    } catch {
      // The parent mutation owns the user-facing error toast.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject(comment);
      setComment("");
      onClose();
    } catch {
      // The parent mutation owns the user-facing error toast.
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                {approval.title || "Approval Required"}
              </DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {approval.description}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="ml-4">
              <Clock className="w-3 h-3 mr-1" />
              {formatDate(approval.requestedAt)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-xs text-gray-600">Execution ID</Label>
              <p className="font-mono text-sm mt-1">{approval.executionId}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Node ID</Label>
              <p className="font-mono text-sm mt-1">{approval.nodeId}</p>
            </div>
          </div>

          {/* Context from Previous Nodes */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">
              Context from Previous Nodes
            </Label>
            <ScrollArea className="h-[200px] w-full rounded-lg border border-gray-200 bg-gray-50">
              <div className="p-4">
                {approval.context ? (
                  <div className="space-y-3">
                    {Object.entries(approval.context).map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        {renderContextValue(key, value)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No context available</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* High Risk Items Highlight */}
          {approval.context?.highRiskItems && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-900 mb-2">
                    High Risk Items Detected
                  </h4>
                  <ul className="space-y-1">
                    {approval.context.highRiskItems.map(
                      (item: string, idx: number) => (
                        <li key={idx} className="text-sm text-red-800">
                          - {item}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Comment Input */}
          <div>
            <Label
              htmlFor="comment"
              className="text-sm font-semibold mb-2 block"
            >
              Comment (Optional)
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your review comments here..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              This comment will be logged in the audit trail
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isSubmitting}
            className="gap-2"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </Button>
          <Button
            data-testid="approval-approve-button"
            onClick={handleApprove}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderContextValue(key: string, value: any) {
  if (value === null || value === undefined || value === "") {
    return <p className="text-sm text-gray-500">None</p>;
  }

  if (Array.isArray(value)) {
    if (key === "claims") {
      return (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={`${key}-${index}`}
              className="rounded-md border border-blue-100 bg-blue-50 p-3"
            >
              <p className="text-sm font-medium text-blue-950">
                {item?.claim || String(item)}
              </p>
              {item?.source && (
                <p className="mt-1 text-xs text-blue-700">
                  Source: {item.source}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (key === "risks") {
      return (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={`${key}-${index}`}
              className="rounded-md border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-950">
                  {item?.risk || String(item)}
                </p>
                {item?.severity && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium uppercase text-amber-800">
                    {item.severity}
                  </span>
                )}
              </div>
              {item?.rationale && (
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  {item.rationale}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-900">
        {value.map((item, index) => (
          <li key={`${key}-${index}`}>
            {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    return (
      <pre className="text-sm font-mono bg-white p-3 rounded border border-gray-200 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <p className="text-sm text-gray-900">{String(value)}</p>;
}
