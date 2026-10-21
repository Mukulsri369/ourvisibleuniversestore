import {
  CURRENT_PAGE_SCHEMA_VERSION,
  SUPPORTED_PAGE_SCHEMA_VERSIONS,
  type PageDocument,
  type PageSchemaVersion,
} from "./page-document";

export interface SchemaMigrationStep {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate: (rawDocument: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Extensible migration registry. Initial schema version is 1.0.0; no fictional legacy versions are added.
 */
const MIGRATION_REGISTRY: SchemaMigrationStep[] = [];

export interface SchemaVersionCheckResult {
  compatible: boolean;
  version: string | null;
  requiresMigration: boolean;
  reason?: string;
}

export function checkSchemaVersionCompatibility(input: unknown): SchemaVersionCheckResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      compatible: false,
      version: null,
      requiresMigration: false,
      reason: "Document must be a non-null JSON object",
    };
  }

  const rawVersion = (input as Record<string, unknown>).schemaVersion;
  if (typeof rawVersion !== "string" || rawVersion.trim().length === 0) {
    return {
      compatible: false,
      version: null,
      requiresMigration: false,
      reason: "Missing or non-string schemaVersion field",
    };
  }

  if (rawVersion === CURRENT_PAGE_SCHEMA_VERSION) {
    return {
      compatible: true,
      version: rawVersion,
      requiresMigration: false,
    };
  }

  const hasMigrationPath = MIGRATION_REGISTRY.some((step) => step.fromVersion === rawVersion);
  if (hasMigrationPath) {
    return {
      compatible: true,
      version: rawVersion,
      requiresMigration: true,
    };
  }

  return {
    compatible: false,
    version: rawVersion,
    requiresMigration: false,
    reason: `Unsupported schemaVersion "${rawVersion}". Supported versions: ${SUPPORTED_PAGE_SCHEMA_VERSIONS.join(", ")}`,
  };
}

export function migratePageDocumentPayload(
  input: unknown,
):
  | { ok: true; payload: Record<string, unknown>; migratedFrom?: string }
  | { ok: false; error: string } {
  const check = checkSchemaVersionCompatibility(input);
  if (!check.compatible) {
    return { ok: false, error: check.reason ?? "Incompatible schema version" };
  }

  let current = { ...(input as Record<string, unknown>) };
  const originalVersion = check.version ?? undefined;

  if (!check.requiresMigration) {
    return { ok: true, payload: current };
  }

  let safetyCounter = 0;
  while (current.schemaVersion !== CURRENT_PAGE_SCHEMA_VERSION && safetyCounter < 10) {
    const step = MIGRATION_REGISTRY.find((s) => s.fromVersion === current.schemaVersion);
    if (!step) {
      return {
        ok: false,
        error: `No migration step found from version "${String(current.schemaVersion)}"`,
      };
    }
    current = step.migrate(current);
    safetyCounter += 1;
  }

  return { ok: true, payload: current, migratedFrom: originalVersion };
}

export function isCurrentSchemaVersion(doc: PageDocument): doc is PageDocument & {
  schemaVersion: PageSchemaVersion;
} {
  return doc.schemaVersion === CURRENT_PAGE_SCHEMA_VERSION;
}
