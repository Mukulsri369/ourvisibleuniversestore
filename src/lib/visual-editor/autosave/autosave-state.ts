import type { PersistenceError } from "../persistence/index";

/**
 * Explicit persistence & autosave state machine (Prompt 13, Part 11, Sections 35–36).
 */
export type StudioAutosaveStatus =
  | "loading"
  | "saved"
  | "unsaved"
  | "saving"
  | "offline"
  | "error"
  | "conflict"
  | "validation_error"
  | "recovery_available";

export interface AutosaveStatusPresentation {
  readonly status: StudioAutosaveStatus;
  readonly badgeLabel: string;
  readonly detailText: string;
  readonly tone: "neutral" | "success" | "warning" | "danger" | "info";
  readonly showRetryButton: boolean;
  readonly showConflictAction: boolean;
  readonly showRecoveryAction: boolean;
}

/**
 * Computes consistent, accessible toolbar and status-bar copy for every state in the
 * persistence state machine (Prompt 13, Part 11, Section 36 & Part 26, Sections 89–91).
 */
export function resolveAutosaveStatusPresentation(params: {
  readonly status: StudioAutosaveStatus;
  readonly isDirty: boolean;
  readonly draftRevision: number;
  readonly isOnline?: boolean;
  readonly retryAttempt?: number;
  readonly maxRetries?: number;
  readonly error?: PersistenceError | null;
  readonly validationError?: string | null;
  readonly hasRecoveryCheckpoint?: boolean;
}): AutosaveStatusPresentation {
  const {
    status,
    isDirty,
    draftRevision,
    isOnline = true,
    retryAttempt = 0,
    maxRetries = 3,
    error,
    validationError,
    hasRecoveryCheckpoint = false,
  } = params;

  if (status === "loading") {
    return {
      status: "loading",
      badgeLabel: "Loading…",
      detailText: "Loading draft…",
      tone: "neutral",
      showRetryButton: false,
      showConflictAction: false,
      showRecoveryAction: false,
    };
  }

  if (status === "conflict" || error?.code === "DRAFT_REVISION_CONFLICT") {
    const actualRev = error?.conflict?.actualRevision;
    return {
      status: "conflict",
      badgeLabel: "A newer draft exists",
      detailText:
        actualRev !== null && actualRev !== undefined
          ? `Revision conflict · Server is at Rev ${actualRev}`
          : "Revision conflict · A newer draft exists on server",
      tone: "danger",
      showRetryButton: false,
      showConflictAction: true,
      showRecoveryAction: false,
    };
  }

  if (status === "validation_error" || Boolean(validationError)) {
    return {
      status: "validation_error",
      badgeLabel: "Validation error",
      detailText: validationError ?? "Invalid design property value",
      tone: "danger",
      showRetryButton: false,
      showConflictAction: false,
      showRecoveryAction: false,
    };
  }

  if (status === "offline" || (!isOnline && isDirty)) {
    return {
      status: "offline",
      badgeLabel: "Offline — changes not synced",
      detailText: "Offline — changes preserved locally and will sync when reconnected",
      tone: "warning",
      showRetryButton: true,
      showConflictAction: false,
      showRecoveryAction: false,
    };
  }

  if (status === "error" || Boolean(error)) {
    const retrySuffix =
      retryAttempt > 0 ? ` (Retry ${Math.min(retryAttempt, maxRetries)}/${maxRetries})` : "";
    return {
      status: "error",
      badgeLabel: "Save failed",
      detailText: `Save failed · Unsaved changes preserved${retrySuffix}`,
      tone: "danger",
      showRetryButton: true,
      showConflictAction: false,
      showRecoveryAction: false,
    };
  }

  if (status === "saving") {
    return {
      status: "saving",
      badgeLabel: "Saving…",
      detailText: "Saving draft…",
      tone: "info",
      showRetryButton: false,
      showConflictAction: false,
      showRecoveryAction: false,
    };
  }

  if (status === "recovery_available" || hasRecoveryCheckpoint) {
    return {
      status: "recovery_available",
      badgeLabel: "Recovery available",
      detailText: "Unsaved local changes from a previous session can be restored",
      tone: "warning",
      showRetryButton: false,
      showConflictAction: false,
      showRecoveryAction: true,
    };
  }

  if (isDirty || status === "unsaved") {
    return {
      status: "unsaved",
      badgeLabel: "Unsaved changes",
      detailText:
        draftRevision > 0
          ? `Unsaved changes · Base Rev ${draftRevision}`
          : "Unsaved changes · New Draft",
      tone: "warning",
      showRetryButton: false,
      showConflictAction: false,
      showRecoveryAction: false,
    };
  }

  return {
    status: "saved",
    badgeLabel: draftRevision > 0 ? "All changes saved" : "Saved",
    detailText:
      draftRevision > 0 ? `Draft Saved · Rev ${draftRevision}` : "Canonical Baseline · Unmodified",
    tone: "success",
    showRetryButton: false,
    showConflictAction: false,
    showRecoveryAction: false,
  };
}
