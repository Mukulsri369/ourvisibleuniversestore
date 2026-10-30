import {
  DEFAULT_STORE_SCOPE,
  type ListPageVersionsOptions,
  type ListPageVersionsResult,
  type PersistenceDatabaseAdapter,
  type StorePagePublishingEventRecord,
  type StorePageVersionRecord,
  type VersionComparisonSummary,
} from "./persistence-types";
import { mapDatabaseErrorToPersistenceError, PersistenceError } from "./persistence-errors";
import { validateDocumentForPersistence, validateStoreScope } from "./persistence-validation";
import { defaultPersistenceAdapter } from "./independent-persistence-adapter";

export interface VersionRepositoryOptions {
  adapter?: PersistenceDatabaseAdapter;
  storeScope?: string;
}

const DEFAULT_VERSION_LIST_LIMIT = 20;
const MAX_VERSION_LIST_LIMIT = 100;

/**
 * Lists immutable historical page versions with bounded pagination.
 * Intentionally excludes full JSON snapshots so version history drawers load quickly.
 */
export async function listPageVersions(
  options: ListPageVersionsOptions & { adapter?: PersistenceDatabaseAdapter },
): Promise<ListPageVersionsResult> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  const limit = Math.min(
    Math.max(1, options.limit ?? DEFAULT_VERSION_LIST_LIMIT),
    MAX_VERSION_LIST_LIMIT,
  );
  const offset = Math.max(0, options.offset ?? 0);

  try {
    return await adapter.listVersionMetadata({
      pageId: options.pageId,
      limit,
      offset,
      storeScope,
    });
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}

/**
 * Retrieves a single authorized historical version including its validated PageDocument snapshot.
 */
export async function getAuthorizedPageVersion(
  pageId: string,
  versionId: string,
  options: VersionRepositoryOptions = {},
): Promise<StorePageVersionRecord | null> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    const rawVersion = await adapter.getVersionById(pageId, versionId, storeScope);
    if (!rawVersion) return null;

    if (rawVersion.pageId !== pageId) {
      throw new PersistenceError({
        code: "INVALID_PAGE_VERSION_RELATIONSHIP",
        publicMessage: "The specified version does not belong to the target storefront page.",
      });
    }

    const validated = validateDocumentForPersistence(rawVersion.documentSnapshot);
    return {
      ...rawVersion,
      documentSnapshot: validated.document,
    };
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}

/**
 * Compares metadata between two versions of the same page without mutating state.
 */
export async function comparePageVersionMetadata(
  pageId: string,
  fromVersionId: string,
  toVersionId: string,
  options: VersionRepositoryOptions = {},
): Promise<VersionComparisonSummary> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    const [fromVer, toVer] = await Promise.all([
      adapter.getVersionById(pageId, fromVersionId, storeScope),
      adapter.getVersionById(pageId, toVersionId, storeScope),
    ]);

    if (!fromVer || !toVer) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "One or both page versions could not be found for comparison.",
      });
    }

    const { documentSnapshot: _a, ...fromMeta } = fromVer;
    const { documentSnapshot: _b, ...toMeta } = toVer;

    return {
      pageId,
      fromVersion: fromMeta,
      toVersion: toMeta,
      versionDelta: toMeta.versionNumber - fromMeta.versionNumber,
      checksumChanged: fromMeta.checksum !== toMeta.checksum,
      schemaVersionChanged: fromMeta.schemaVersion !== toMeta.schemaVersion,
    };
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}

/**
 * Lists recent publishing and rollback events for a page.
 */
export async function listPagePublishingEvents(
  pageId: string,
  limit: number = 25,
  options: VersionRepositoryOptions = {},
): Promise<StorePagePublishingEventRecord[]> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    return await adapter.listPublishingEvents(pageId, limit, storeScope);
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}
