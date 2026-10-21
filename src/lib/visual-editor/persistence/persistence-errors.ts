import type { ValidationIssueDetail } from "../schema/validation";

export type PersistenceErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UNSUPPORTED_SCHEMA"
  | "DRAFT_REVISION_CONFLICT"
  | "PUBLISHED_REVISION_CONFLICT"
  | "DATABASE_UNAVAILABLE"
  | "MIGRATION_REQUIRED"
  | "INVALID_PAGE_VERSION_RELATIONSHIP"
  | "DOCUMENT_TOO_LARGE"
  | "STORAGE_FAILURE"
  | "UNKNOWN_INTERNAL_ERROR";

export interface RevisionConflictMetadata {
  conflictKind: "draft_revision" | "published_revision";
  expectedRevision: number | null;
  actualRevision: number | null;
}

export interface PersistenceErrorOptions {
  code: PersistenceErrorCode;
  publicMessage: string;
  diagnosticMessage?: string;
  conflict?: RevisionConflictMetadata;
  validationIssues?: ValidationIssueDetail[];
  retryable?: boolean;
}

const DEFAULT_PUBLIC_MESSAGES: Record<PersistenceErrorCode, string> = {
  UNAUTHORIZED: "Authentication is required to access storefront design drafts.",
  FORBIDDEN: "Administrator privileges are required for this operation.",
  NOT_FOUND: "The requested page design record could not be found.",
  VALIDATION_FAILED: "The page design document failed validation.",
  UNSUPPORTED_SCHEMA: "The page design schema version is not supported.",
  DRAFT_REVISION_CONFLICT:
    "This draft was updated in another session. Reload the latest draft before saving.",
  PUBLISHED_REVISION_CONFLICT:
    "Another administrator published a newer version of this page. Refresh before publishing.",
  DATABASE_UNAVAILABLE: "The design database is temporarily unavailable.",
  MIGRATION_REQUIRED: "The page persistence database tables have not been migrated yet.",
  INVALID_PAGE_VERSION_RELATIONSHIP:
    "The specified version does not belong to the target storefront page.",
  DOCUMENT_TOO_LARGE: "The page design document exceeds the maximum allowed payload size.",
  STORAGE_FAILURE: "Failed to persist the page design record.",
  UNKNOWN_INTERNAL_ERROR: "An unexpected error occurred in the page persistence service.",
};

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly publicMessage: string;
  readonly diagnosticMessage: string;
  readonly conflict?: RevisionConflictMetadata;
  readonly validationIssues?: ValidationIssueDetail[];
  readonly retryable: boolean;

  constructor(options: PersistenceErrorOptions) {
    super(options.publicMessage || DEFAULT_PUBLIC_MESSAGES[options.code]);
    this.name = "PersistenceError";
    this.code = options.code;
    this.publicMessage = options.publicMessage || DEFAULT_PUBLIC_MESSAGES[options.code];
    this.diagnosticMessage = options.diagnosticMessage ?? this.publicMessage;
    this.conflict = options.conflict;
    this.validationIssues = options.validationIssues;
    this.retryable =
      options.retryable ??
      (options.code === "DATABASE_UNAVAILABLE" || options.code === "STORAGE_FAILURE");
  }

  toPublicJSON() {
    return {
      code: this.code,
      message: this.publicMessage,
      retryable: this.retryable,
      conflict: this.conflict,
      validationIssues: this.validationIssues,
    };
  }
}

export function isPersistenceError(err: unknown): err is PersistenceError {
  return err instanceof PersistenceError;
}

function parseRevisionFromDetail(detail: string | undefined, key: string): number | null {
  if (!detail) return null;
  const regex = new RegExp(`${key}=(-?\\d+)`);
  const match = detail.match(regex);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Safely maps raw PostgreSQL / Supabase / network errors into structured PersistenceError
 * instances without leaking internal SQL details or sensitive fields to callers.
 */
export function mapDatabaseErrorToPersistenceError(
  rawError: unknown,
  context?: { expectedDraftRevision?: number | null; expectedPublishedRevision?: number | null },
): PersistenceError {
  if (rawError instanceof PersistenceError) {
    return rawError;
  }

  const errObj =
    typeof rawError === "object" && rawError !== null ? (rawError as Record<string, unknown>) : {};
  const pgCode = typeof errObj.code === "string" ? errObj.code : "";
  const message =
    typeof errObj.message === "string"
      ? errObj.message
      : rawError instanceof Error
        ? rawError.message
        : String(rawError);
  const details = typeof errObj.details === "string" ? errObj.details : "";

  if (pgCode === "42501" || /unauthorized|permission denied|row-level security/i.test(message)) {
    return new PersistenceError({
      code: "FORBIDDEN",
      publicMessage: DEFAULT_PUBLIC_MESSAGES.FORBIDDEN,
      diagnosticMessage: message,
      retryable: false,
    });
  }

  if (pgCode === "40001" || /revision conflict/i.test(message)) {
    const isPublishedConflict =
      /published revision conflict/i.test(message) ||
      details.includes("actual_published_revision=");
    if (isPublishedConflict) {
      const actualRevision = parseRevisionFromDetail(details, "actual_published_revision");
      return new PersistenceError({
        code: "PUBLISHED_REVISION_CONFLICT",
        publicMessage: DEFAULT_PUBLIC_MESSAGES.PUBLISHED_REVISION_CONFLICT,
        diagnosticMessage: message,
        conflict: {
          conflictKind: "published_revision",
          expectedRevision: context?.expectedPublishedRevision ?? null,
          actualRevision,
        },
        retryable: false,
      });
    }

    const actualDraftRev =
      parseRevisionFromDetail(details, "actual_revision") ??
      parseRevisionFromDetail(details, "actual_draft_revision");
    return new PersistenceError({
      code: "DRAFT_REVISION_CONFLICT",
      publicMessage: DEFAULT_PUBLIC_MESSAGES.DRAFT_REVISION_CONFLICT,
      diagnosticMessage: message,
      conflict: {
        conflictKind: "draft_revision",
        expectedRevision: context?.expectedDraftRevision ?? null,
        actualRevision: actualDraftRev,
      },
      retryable: false,
    });
  }

  if (pgCode === "P0002" || /not found|no draft exists/i.test(message)) {
    return new PersistenceError({
      code: "NOT_FOUND",
      publicMessage: DEFAULT_PUBLIC_MESSAGES.NOT_FOUND,
      diagnosticMessage: message,
      retryable: false,
    });
  }

  if (pgCode === "23503" || /does not belong to page|same_page_fkey/i.test(message)) {
    return new PersistenceError({
      code: "INVALID_PAGE_VERSION_RELATIONSHIP",
      publicMessage: DEFAULT_PUBLIC_MESSAGES.INVALID_PAGE_VERSION_RELATIONSHIP,
      diagnosticMessage: message,
      retryable: false,
    });
  }

  if (pgCode === "55000" || /immutable/i.test(message)) {
    return new PersistenceError({
      code: "FORBIDDEN",
      publicMessage: "Historical page versions are immutable and cannot be modified.",
      diagnosticMessage: message,
      retryable: false,
    });
  }

  if (pgCode === "22023" || pgCode === "23514") {
    if (/unsupported.*schema_version/i.test(message)) {
      return new PersistenceError({
        code: "UNSUPPORTED_SCHEMA",
        publicMessage: DEFAULT_PUBLIC_MESSAGES.UNSUPPORTED_SCHEMA,
        diagnosticMessage: message,
        retryable: false,
      });
    }
    if (/size limit exceeded/i.test(message)) {
      return new PersistenceError({
        code: "DOCUMENT_TOO_LARGE",
        publicMessage: DEFAULT_PUBLIC_MESSAGES.DOCUMENT_TOO_LARGE,
        diagnosticMessage: message,
        retryable: false,
      });
    }
    return new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: DEFAULT_PUBLIC_MESSAGES.VALIDATION_FAILED,
      diagnosticMessage: message,
      retryable: false,
    });
  }

  if (
    pgCode === "42P01" ||
    pgCode === "42883" ||
    pgCode === "PGRST202" ||
    /relation .*store_page.* does not exist|function .*store_page.* does not exist/i.test(message)
  ) {
    return new PersistenceError({
      code: "MIGRATION_REQUIRED",
      publicMessage: DEFAULT_PUBLIC_MESSAGES.MIGRATION_REQUIRED,
      diagnosticMessage: message,
      retryable: false,
    });
  }

  if (
    /fetch failed|network|timeout|econnrefused|enotfound|503|502|504/i.test(message) ||
    pgCode === "08006" ||
    pgCode === "08001"
  ) {
    return new PersistenceError({
      code: "DATABASE_UNAVAILABLE",
      publicMessage: DEFAULT_PUBLIC_MESSAGES.DATABASE_UNAVAILABLE,
      diagnosticMessage: message,
      retryable: true,
    });
  }

  return new PersistenceError({
    code: "UNKNOWN_INTERNAL_ERROR",
    publicMessage: DEFAULT_PUBLIC_MESSAGES.UNKNOWN_INTERNAL_ERROR,
    diagnosticMessage: message,
    retryable: false,
  });
}
