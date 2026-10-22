import React from "react";
import { AlertTriangle, Check, CloudOff, History, Loader2, RefreshCw } from "lucide-react";
import {
  resolveAutosaveStatusPresentation,
  type PersistenceError,
  type StudioAutosaveStatus,
} from "@/lib/visual-editor/studio";
import { cn } from "@/lib/utils";

export interface SaveStatusProps {
  status: StudioAutosaveStatus;
  isDirty: boolean;
  draftRevision: number;
  isPublishedLive: boolean;
  isOnline?: boolean;
  retryAttempt?: number;
  error?: PersistenceError | null;
  validationError?: string | null;
  hasRecoveryCheckpoint?: boolean;
  onRetrySave?: () => void;
  onOpenRecovery?: () => void;
}

/**
 * Toolbar save status indicator and actionable Retry / Recovery controls
 * (Prompt 13, Part 11, Section 36, Part 14, Section 47 & Part 26, Sections 89–90).
 */
export function SaveStatus({
  status,
  isDirty,
  draftRevision,
  isPublishedLive,
  isOnline = true,
  retryAttempt = 0,
  error = null,
  validationError = null,
  hasRecoveryCheckpoint = false,
  onRetrySave,
  onOpenRecovery,
}: SaveStatusProps) {
  const presentation = resolveAutosaveStatusPresentation({
    status,
    isDirty,
    draftRevision,
    isOnline,
    retryAttempt,
    error,
    validationError,
    hasRecoveryCheckpoint,
  });

  const toneTextClass =
    presentation.tone === "danger"
      ? "text-destructive"
      : presentation.tone === "warning"
        ? "text-amber-400"
        : presentation.tone === "info"
          ? "text-primary"
          : "text-muted-foreground";

  return (
    <div
      aria-live="polite"
      data-testid="studio-persistence-summary"
      className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums text-muted-foreground"
    >
      <span
        data-testid="studio-save-status-badge"
        className={cn("inline-flex items-center gap-1 font-medium", toneTextClass)}
      >
        {presentation.status === "saving" && <Loader2 className="size-3 animate-spin" />}
        {presentation.status === "saved" && !isDirty && draftRevision > 0 && (
          <Check className="size-3 text-emerald-400" />
        )}
        {presentation.status === "offline" && <CloudOff className="size-3" />}
        {(presentation.status === "error" || presentation.status === "conflict") && (
          <AlertTriangle className="size-3" />
        )}
        {presentation.status === "recovery_available" && <History className="size-3" />}
        <span>{presentation.detailText}</span>
      </span>

      {presentation.showRetryButton && onRetrySave && (
        <>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onRetrySave}
            data-testid="studio-retry-save-btn"
            className="inline-flex items-center gap-1 rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <RefreshCw className="size-2.5" />
            <span>Retry Save</span>
          </button>
        </>
      )}

      {presentation.showRecoveryAction && onOpenRecovery && (
        <>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onOpenRecovery}
            data-testid="studio-open-recovery-btn"
            className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <History className="size-2.5" />
            <span>Review Recovery</span>
          </button>
        </>
      )}

      <span aria-hidden="true">·</span>
      <span>{isPublishedLive ? "Live Store Published" : "Canonical Storefront Live"}</span>
    </div>
  );
}
