import { DEFAULT_STORE_SCOPE } from "../persistence/index";

export const RECOVERY_STORAGE_KEY_PREFIX = "ovu-studio-unsaved-draft-v2:";
export const LEGACY_RECOVERY_KEY_PREFIX = "ovu-studio-unsaved-draft:";

/**
 * Maximum age of a temporary session-scoped recovery checkpoint (24 hours).
 */
export const MAX_RECOVERY_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum serialized JSON payload size for a local recovery checkpoint (512 KB).
 */
export const MAX_RECOVERY_PAYLOAD_BYTES = 512 * 1024;

const FORBIDDEN_CREDENTIAL_KEY_PATTERN =
  /^(access_token|refresh_token|id_token|apiKey|secret|password|authorization|supabaseKey|service_role)$/i;

export interface RecoveryScopeDescriptor {
  readonly storeScope?: string;
  readonly pageKey: string;
  readonly userScope?: string;
}

/**
 * Builds a deterministic, scope-isolated storage key for a draft recovery checkpoint
 * (Prompt 13, Part 15, Section 49).
 */
export function buildRecoveryStorageKey(scope: RecoveryScopeDescriptor): string {
  const storeScope = (scope.storeScope ?? DEFAULT_STORE_SCOPE).trim() || DEFAULT_STORE_SCOPE;
  const pageKey = scope.pageKey.trim() || "home";
  const userScope = (scope.userScope ?? "admin").trim() || "admin";
  return `${RECOVERY_STORAGE_KEY_PREFIX}${storeScope}:${pageKey}:${userScope}`;
}

/**
 * Verifies that a candidate recovery object contains no credential/token fields
 * and respects retention and payload bounds (Prompt 13, Part 15, Section 49 & Part 20, Section 65).
 */
export function containsForbiddenRecoveryCredentials(value: unknown, depth: number = 0): boolean {
  if (depth > 20 || value === null || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenRecoveryCredentials(item, depth + 1));
  }

  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(k)) {
      return true;
    }
    if (typeof v === "string" && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)) {
      // Reject embedded JWT tokens
      return true;
    }
    if (containsForbiddenRecoveryCredentials(v, depth + 1)) {
      return true;
    }
  }

  return false;
}

export function isRecoveryCheckpointExpired(
  savedAtMs: number,
  nowMs: number = Date.now(),
  maxRetentionMs: number = MAX_RECOVERY_RETENTION_MS,
): boolean {
  if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return true;
  const age = nowMs - savedAtMs;
  return age < -60_000 || age > maxRetentionMs;
}
