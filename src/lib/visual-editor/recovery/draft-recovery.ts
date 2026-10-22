import {
  computeDocumentContentFingerprint,
  validateHistoryDocumentState,
} from "../history/history-transactions";
import { DEFAULT_STORE_SCOPE } from "../persistence/index";
import type { PageDocument } from "../schema/page-document";
import {
  buildRecoveryStorageKey,
  containsForbiddenRecoveryCredentials,
  isRecoveryCheckpointExpired,
  LEGACY_RECOVERY_KEY_PREFIX,
  MAX_RECOVERY_PAYLOAD_BYTES,
  MAX_RECOVERY_RETENTION_MS,
  type RecoveryScopeDescriptor,
} from "./recovery-policy";

export interface DraftRecoveryCheckpoint {
  readonly version: 1;
  readonly storeScope: string;
  readonly pageKey: string;
  readonly userScope: string;
  readonly baseDraftRevision: number;
  readonly savedAtMs: number;
  readonly documentChecksum: string;
  readonly lastTransactionLabel: string | null;
  readonly document: PageDocument;
}

export type DraftRecoveryEvaluationResult =
  | {
      readonly status: "none";
      readonly reason?: string;
    }
  | {
      readonly status: "recoverable";
      readonly checkpoint: DraftRecoveryCheckpoint;
      readonly serverDraftRevision: number;
    }
  | {
      readonly status: "stale_against_server";
      readonly checkpoint: DraftRecoveryCheckpoint;
      readonly serverDraftRevision: number;
    };

export interface RecoveryStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultSessionStorage(): RecoveryStorageLike | null {
  if (typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
}

/**
 * Writes a validated, scope-isolated unsaved recovery checkpoint to `sessionStorage`
 * (or custom storage in tests) (Prompt 13, Part 15, Sections 49–50).
 *
 * Security invariants:
 * - Never writes invalid `PageDocument` trees or objects containing credentials/JWTs.
 * - Enforces `MAX_RECOVERY_PAYLOAD_BYTES`.
 * - Scoped to `(storeScope, pageKey, userScope)` and records `baseDraftRevision`.
 */
export function writeLocalDraftRecoveryCheckpoint(params: {
  readonly pageKey: string;
  readonly storeScope?: string;
  readonly userScope?: string;
  readonly baseDraftRevision: number;
  readonly document: PageDocument;
  readonly lastTransactionLabel?: string | null;
  readonly nowMs?: number;
  readonly storage?: RecoveryStorageLike | null;
}): boolean {
  const storage = params.storage !== undefined ? params.storage : getDefaultSessionStorage();
  if (!storage) return false;

  const validated = validateHistoryDocumentState(params.document);
  if (!validated.valid || !validated.document) {
    return false;
  }

  if (containsForbiddenRecoveryCredentials(validated.document)) {
    return false;
  }

  const storeScope = (params.storeScope ?? DEFAULT_STORE_SCOPE).trim() || DEFAULT_STORE_SCOPE;
  const pageKey = params.pageKey.trim() || "home";
  const userScope = (params.userScope ?? "admin").trim() || "admin";

  const checkpoint: DraftRecoveryCheckpoint = {
    version: 1,
    storeScope,
    pageKey,
    userScope,
    baseDraftRevision: Math.max(0, Math.floor(params.baseDraftRevision)),
    savedAtMs: params.nowMs ?? Date.now(),
    documentChecksum: computeDocumentContentFingerprint(validated.document),
    lastTransactionLabel: params.lastTransactionLabel ?? null,
    document: validated.document,
  };

  try {
    const serialized = JSON.stringify(checkpoint);
    if (serialized.length > MAX_RECOVERY_PAYLOAD_BYTES) {
      return false;
    }
    const key = buildRecoveryStorageKey({ storeScope, pageKey, userScope });
    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears any stored recovery checkpoint for the given scope.
 */
export function clearLocalDraftRecoveryCheckpoint(
  scope: RecoveryScopeDescriptor,
  storage?: RecoveryStorageLike | null,
): void {
  const targetStorage = storage !== undefined ? storage : getDefaultSessionStorage();
  if (!targetStorage) return;

  try {
    const key = buildRecoveryStorageKey(scope);
    targetStorage.removeItem(key);
    targetStorage.removeItem(`${LEGACY_RECOVERY_KEY_PREFIX}${scope.pageKey}`);
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Reads and validates a stored recovery checkpoint for the given scope.
 * Automatically purges expired, malformed, or scope-mismatched checkpoints.
 */
export function readLocalDraftRecoveryCheckpoint(
  scope: RecoveryScopeDescriptor,
  options?: {
    readonly nowMs?: number;
    readonly maxRetentionMs?: number;
    readonly storage?: RecoveryStorageLike | null;
  },
): DraftRecoveryCheckpoint | null {
  const targetStorage =
    options?.storage !== undefined ? options.storage : getDefaultSessionStorage();
  if (!targetStorage) return null;

  const storeScope = (scope.storeScope ?? DEFAULT_STORE_SCOPE).trim() || DEFAULT_STORE_SCOPE;
  const pageKey = scope.pageKey.trim() || "home";
  const userScope = (scope.userScope ?? "admin").trim() || "admin";
  const key = buildRecoveryStorageKey({ storeScope, pageKey, userScope });

  let raw: string | null = null;
  try {
    raw = targetStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) return null;
  if (raw.length > MAX_RECOVERY_PAYLOAD_BYTES) {
    clearLocalDraftRecoveryCheckpoint(scope, targetStorage);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DraftRecoveryCheckpoint>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      parsed.storeScope !== storeScope ||
      parsed.pageKey !== pageKey ||
      parsed.userScope !== userScope ||
      typeof parsed.baseDraftRevision !== "number" ||
      typeof parsed.savedAtMs !== "number" ||
      !parsed.document
    ) {
      clearLocalDraftRecoveryCheckpoint(scope, targetStorage);
      return null;
    }

    if (
      isRecoveryCheckpointExpired(
        parsed.savedAtMs,
        options?.nowMs ?? Date.now(),
        options?.maxRetentionMs ?? MAX_RECOVERY_RETENTION_MS,
      )
    ) {
      clearLocalDraftRecoveryCheckpoint(scope, targetStorage);
      return null;
    }

    if (containsForbiddenRecoveryCredentials(parsed)) {
      clearLocalDraftRecoveryCheckpoint(scope, targetStorage);
      return null;
    }

    const validatedDoc = validateHistoryDocumentState(parsed.document);
    if (!validatedDoc.valid || !validatedDoc.document) {
      clearLocalDraftRecoveryCheckpoint(scope, targetStorage);
      return null;
    }

    const actualChecksum = computeDocumentContentFingerprint(validatedDoc.document);
    return {
      version: 1,
      storeScope,
      pageKey,
      userScope,
      baseDraftRevision: parsed.baseDraftRevision,
      savedAtMs: parsed.savedAtMs,
      documentChecksum: actualChecksum,
      lastTransactionLabel:
        typeof parsed.lastTransactionLabel === "string" ? parsed.lastTransactionLabel : null,
      document: validatedDoc.document,
    };
  } catch {
    clearLocalDraftRecoveryCheckpoint(scope, targetStorage);
    return null;
  }
}

/**
 * Evaluates a local recovery checkpoint against the authoritative server draft revision
 * and document (Prompt 13, Part 15, Section 50).
 *
 * Rules enforced:
 * 1. If no valid checkpoint exists -> `{ status: "none" }`.
 * 2. If the checkpoint content matches the server document -> clears redundant checkpoint and returns `{ status: "none" }`.
 * 3. If `checkpoint.baseDraftRevision < serverDraftRevision` -> returns `{ status: "stale_against_server" }`
 *    so an older local checkpoint NEVER silently overwrites a newer server draft.
 * 4. If `checkpoint.baseDraftRevision >= serverDraftRevision` and content differs -> returns
 *    `{ status: "recoverable" }` so the UI can present an explicit recovery choice.
 */
export function evaluateDraftRecoveryCandidate(params: {
  readonly scope: RecoveryScopeDescriptor;
  readonly serverDraftRevision: number;
  readonly serverDocument: PageDocument;
  readonly nowMs?: number;
  readonly maxRetentionMs?: number;
  readonly storage?: RecoveryStorageLike | null;
}): DraftRecoveryEvaluationResult {
  const checkpoint = readLocalDraftRecoveryCheckpoint(params.scope, {
    nowMs: params.nowMs,
    maxRetentionMs: params.maxRetentionMs,
    storage: params.storage,
  });

  if (!checkpoint) {
    return { status: "none" };
  }

  const serverChecksum = computeDocumentContentFingerprint(params.serverDocument);
  if (checkpoint.documentChecksum === serverChecksum) {
    clearLocalDraftRecoveryCheckpoint(params.scope, params.storage);
    return { status: "none", reason: "identical_to_server" };
  }

  if (checkpoint.baseDraftRevision < params.serverDraftRevision) {
    return {
      status: "stale_against_server",
      checkpoint,
      serverDraftRevision: params.serverDraftRevision,
    };
  }

  return {
    status: "recoverable",
    checkpoint,
    serverDraftRevision: params.serverDraftRevision,
  };
}
