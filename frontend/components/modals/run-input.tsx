"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Play, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RunInputModalProps {
  open: boolean;
  defaultValue: string;
  isDiligenceWorkflow?: boolean;
  isRunning?: boolean;
  onClose: () => void;
  onRun: (inputData: { input_text: string; source_name?: string }) => void;
}

export function RunInputModal({
  open,
  defaultValue,
  isDiligenceWorkflow = false,
  isRunning = false,
  onClose,
  onRun,
}: RunInputModalProps) {
  const [documentText, setDocumentText] = useState(defaultValue);
  const [sourceName, setSourceName] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canRun = useMemo(() => documentText.trim().length > 0, [documentText]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDocumentText(defaultValue);
      setSourceName(undefined);
      return;
    }
    onClose();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setDocumentText(String(reader.result || ""));
      setSourceName(file.name);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleRun = () => {
    if (!canRun) return;
    onRun({
      input_text: documentText.trim(),
      ...(sourceName ? { source_name: sourceName } : {}),
    });
  };

  const copy = isDiligenceWorkflow
    ? {
        title: "Run Diligence Review",
        description:
          "Upload a text file or paste a memo, notes, or diligence excerpt to analyze.",
        label: "Source material",
        inputId: "diligence-input",
        placeholder: "Paste investment memo or diligence notes...",
        button: "Run Review",
      }
    : {
        title: "Run Workflow",
        description:
          "Upload a text file or paste source input for this workflow.",
        label: "Source input",
        inputId: "workflow-input",
        placeholder: "Paste input text, JSON, notes, or instructions...",
        button: "Run Workflow",
      };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-700" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={copy.inputId}>{copy.label}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload text file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.markdown,.json,.csv"
              onChange={handleFile}
            />
          </div>

          {sourceName && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              Loaded {sourceName}
            </div>
          )}
          <p className="text-xs text-slate-500">
            Supported uploads: TXT, Markdown, JSON, and CSV. Paste extracted text
            from PDF or DOCX files for this local demo.
          </p>

          <Textarea
            id={copy.inputId}
            value={documentText}
            onChange={(event) => setDocumentText(event.target.value)}
            rows={12}
            className="resize-none border-slate-200 bg-white font-mono text-sm leading-6 text-slate-900"
            placeholder={copy.placeholder}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRunning}>
            Cancel
          </Button>
          <Button
            data-testid="run-review-button"
            onClick={handleRun}
            disabled={!canRun || isRunning}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {copy.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
