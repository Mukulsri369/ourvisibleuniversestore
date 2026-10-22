import React from "react";
import { AlertTriangle, History, RotateCcw, Trash2 } from "lucide-react";
import type { DraftRecoveryEvaluationResult } from "@/lib/visual-editor/studio";

export interface RecoveryDialogProps {
  evaluation: Extract<
    DraftRecoveryEvaluationResult,
    { status: "recoverable" | "stale_against_server" }
  >;
  onRestoreCheckpoint: () => void;
  onDiscardCheckpoint: () => void;
}

/**
 * Explicit recovery decision modal when an unsaved local recovery checkpoint is detected
 * (Prompt 13, Part 15, Section 50).
 *
 * Never silently overwrites a newer server draft; clearly distinguishes up-to-date
 * recoverable checkpoints from checkpoints whose base revision is older than the server draft.
 */
export function RecoveryDialog({
  evaluation,
  onRestoreCheckpoint,
  onDiscardCheckpoint,
}: RecoveryDialogProps) {
  const { checkpoint, serverDraftRevision, status } = evaluation;
  const isStaleAgainstServer = status === "stale_against_server";
  const formattedTime = new Date(checkpoint.savedAtMs).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-recovery-dialog-title"
      data-testid="studio-recovery-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 text-primary">
            {isStaleAgainstServer ? (
              <AlertTriangle className="size-4 text-amber-400" />
            ) : (
              <History className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="studio-recovery-dialog-title"
              className="font-sans text-base font-semibold text-foreground"
            >
              {isStaleAgainstServer
                ? "Older Unsaved Checkpoint Detected"
                : "Recover Unsaved Draft Changes?"}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {isStaleAgainstServer
                ? `A local recovery checkpoint from ${formattedTime} was based on Draft Rev ${checkpoint.baseDraftRevision}, but the server draft is now at Rev ${serverDraftRevision}. Keeping the newer server draft is recommended.`
                : `Unsaved local changes from ${formattedTime} were found in your current browser session before they were confirmed saved to the server.`}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/70 bg-secondary/30 px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>Checkpoint Base Revision</span>
            <span className="text-foreground">Rev {checkpoint.baseDraftRevision}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Current Server Revision</span>
            <span className="text-foreground">Rev {serverDraftRevision}</span>
          </div>
          {checkpoint.lastTransactionLabel && (
            <div className="flex items-center justify-between gap-2">
              <span>Last Local Action</span>
              <span className="truncate text-foreground">{checkpoint.lastTransactionLabel}</span>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDiscardCheckpoint}
            data-testid="studio-recovery-discard-btn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Trash2 className="size-3.5" />
            <span>Discard Local Checkpoint</span>
          </button>

          <button
            type="button"
            onClick={onRestoreCheckpoint}
            data-testid="studio-recovery-restore-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RotateCcw className="size-3.5" />
            <span>
              {isStaleAgainstServer ? "Restore Local Anyway" : "Restore Unsaved Work"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
