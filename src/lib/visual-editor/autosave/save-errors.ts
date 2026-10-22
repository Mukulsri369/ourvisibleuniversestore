import {
  isPersistenceError,
  mapDatabaseErrorToPersistenceError,
  PersistenceError,
} from "../persistence/index";
import type { StudioAutosaveStatus } from "./autosave-state";

export type SaveFailureCategory = "conflict" | "auth" | "validation" | "transient_network";

export interface ClassifiedSaveFailure {
  readonly category: SaveFailureCategory;
  readonly targetStatus: StudioAutosaveStatus;
  readonly error: PersistenceError;
  readonly canAutoRetry: boolean;
  readonly isOfflineLikely: boolean;
}

/**
 * Classifies a persistence or network error into one of four distinct categories
 * so transient failures, validation errors, authorization errors, and revision conflicts
 * are never treated identically (Prompt 13, Part 13, Section 44 & Part 14, Sections 45–46).
 */
export function classifySaveFailure(
  rawError: unknown,
  options?: {
    readonly expectedDraftRevision?: number;
    readonly isBrowserOnline?: boolean;
  },
): ClassifiedSaveFailure {
  const isOnline = options?.isBrowserOnline ?? true;
  const mapped = isPersistenceError(rawError)
    ? rawError
    : mapDatabaseErrorToPersistenceError(rawError, {
        expectedDraftRevision: options?.expectedDraftRevision ?? null,
      });

  const message = `${mapped.publicMessage} ${mapped.diagnosticMessage}`.toLowerCase();
  const isNetworkPattern =
    !isOnline ||
    mapped.code === "DATABASE_UNAVAILABLE" ||
    mapped.code === "STORAGE_FAILURE" ||
    /network|offline|fetch|timeout|timed out|connection|econnreset|enotfound/i.test(message);

  // 1. Optimistic Concurrency Conflict — NEVER auto-retry
  if (
    mapped.code === "DRAFT_REVISION_CONFLICT" ||
    mapped.code === "PUBLISHED_REVISION_CONFLICT"
  ) {
    return {
      category: "conflict",
      targetStatus: "conflict",
      error: mapped,
      canAutoRetry: false,
      isOfflineLikely: false,
    };
  }

  // 2. Authorization / Authentication Failure — NEVER auto-retry
  if (mapped.code === "UNAUTHORIZED" || mapped.code === "FORBIDDEN") {
    return {
      category: "auth",
      targetStatus: "error",
      error: mapped,
      canAutoRetry: false,
      isOfflineLikely: false,
    };
  }

  // 3. Schema / Document / Migration Validation Failure — NEVER auto-retry
  if (
    mapped.code === "VALIDATION_FAILED" ||
    mapped.code === "UNSUPPORTED_SCHEMA" ||
    mapped.code === "DOCUMENT_TOO_LARGE" ||
    mapped.code === "INVALID_PAGE_VERSION_RELATIONSHIP" ||
    mapped.code === "MIGRATION_REQUIRED"
  ) {
    return {
      category: "validation",
      targetStatus: "error",
      error: mapped,
      canAutoRetry: false,
      isOfflineLikely: false,
    };
  }

  // 4. Transient Network or Storage Failure — eligible for bounded backoff retry
  return {
    category: "transient_network",
    targetStatus: !isOnline ? "offline" : "error",
    error: mapped,
    canAutoRetry: Boolean(mapped.retryable || isNetworkPattern),
    isOfflineLikely: !isOnline || /offline|failed to fetch|networkerror/i.test(message),
  };
}

/**
 * Computes bounded exponential backoff delay in milliseconds for transient save retries
 * (Prompt 13, Part 14, Section 46).
 */
export function computeRetryBackoffDelayMs(
  retryAttempt: number,
  baseDelayMs: number = 1500,
  maxDelayMs: number = 12_000,
): number {
  const exponent = Math.max(0, retryAttempt - 1);
  const raw = baseDelayMs * Math.pow(2, exponent);
  return Math.min(maxDelayMs, Math.round(raw));
}
