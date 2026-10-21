import React from "react";
import { AlertTriangle } from "lucide-react";
import type { DeletionImpactSummary } from "@/lib/visual-editor/structure";

export interface LayerDeleteConfirmDialogProps {
  impact: DeletionImpactSummary;
  onConfirmDelete: (nodeId: string) => void;
  onCancel: () => void;
}

export function LayerDeleteConfirmDialog({
  impact,
  onConfirmDelete,
  onCancel,
}: LayerDeleteConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="layer-delete-dialog-title"
      data-testid="studio-layer-delete-confirm-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-foreground shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="layer-delete-dialog-title"
              className="font-sans text-sm font-semibold text-foreground"
            >
              {impact.confirmationTitle}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {impact.confirmationMessage}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="studio-layer-delete-cancel-btn"
            onClick={onCancel}
            className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="studio-layer-delete-confirm-btn"
            onClick={() => onConfirmDelete(impact.nodeId)}
            className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            Remove Layer
          </button>
        </div>
      </div>
    </div>
  );
}
