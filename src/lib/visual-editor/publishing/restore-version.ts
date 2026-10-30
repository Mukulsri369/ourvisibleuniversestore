import {
  DEFAULT_STORE_SCOPE,
  type PersistenceDatabaseAdapter,
  type RestorePublishedVersionInput,
  type RestorePublishedVersionResult,
} from "../persistence/persistence-types";
import {
  mapDatabaseErrorToPersistenceError,
  PersistenceError,
} from "../persistence/persistence-errors";
import { validateStoreScope } from "../persistence/persistence-validation";
import { defaultPersistenceAdapter } from "../persistence/independent-persistence-adapter";
import { validateDocumentForPublishing } from "./publish-validation";

export interface RestoreVersionOptions {
  adapter?: PersistenceDatabaseAdapter;
  onCacheInvalidate?: (info: { pageId: string; slug: string; storeScope: string }) => void;
}

/**
 * Trusted atomic rollback / version restoration primitive:
 * 1. Verifies store scope and administrator authorization.
 * 2. Verifies target historical version exists and belongs to the target page.
 * 3. Validates the historical document snapshot against current schema & publishing rules.
 * 4. Atomically creates a new immutable version snapshot referencing `restoredFromVersionId`,
 *    switches `published_version_id`, increments `published_revision`, and records a `rollback` event.
 * 5. Never modifies or deletes historical version records.
 */
export async function restorePublishedVersion(
  input: RestorePublishedVersionInput,
  options: RestoreVersionOptions = {},
): Promise<RestorePublishedVersionResult> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  try {
    const storeScope = validateStoreScope(input.storeScope ?? DEFAULT_STORE_SCOPE);
    const page = await adapter.getPageById(input.pageId, storeScope);
    if (!page) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Page not found for version restore.",
      });
    }

    if (
      input.expectedPublishedRevision !== undefined &&
      input.expectedPublishedRevision !== null &&
      page.publishedRevision !== input.expectedPublishedRevision
    ) {
      throw new PersistenceError({
        code: "PUBLISHED_REVISION_CONFLICT",
        publicMessage:
          "Another administrator published a newer version of this page. Refresh before restoring.",
        conflict: {
          conflictKind: "published_revision",
          expectedRevision: input.expectedPublishedRevision,
          actualRevision: page.publishedRevision,
        },
      });
    }

    const targetVersion = await adapter.getVersionById(
      input.pageId,
      input.targetVersionId,
      storeScope,
    );

    if (!targetVersion) {
      throw new PersistenceError({
        code: "INVALID_PAGE_VERSION_RELATIONSHIP",
        publicMessage: "The specified version does not exist or does not belong to this page.",
      });
    }

    // Validate restored snapshot before switching active published pointer
    validateDocumentForPublishing(targetVersion.documentSnapshot, page.pageType);

    const committed = await adapter.restoreVersionAtomic({
      pageId: input.pageId,
      targetVersionId: input.targetVersionId,
      expectedPublishedRevision: input.expectedPublishedRevision ?? null,
      syncDraft: input.syncDraftToRestoredVersion ?? true,
      releaseNotes: input.releaseNotes ?? null,
      storeScope,
    });

    options.onCacheInvalidate?.({
      pageId: committed.page.id,
      slug: committed.page.slug,
      storeScope: committed.page.storeScope,
    });

    return {
      ok: true,
      page: committed.page,
      publishedVersion: committed.publishedVersion,
      restoredFromVersionId: committed.restoredFromVersionId,
      previousVersionId: committed.previousVersionId,
      event: committed.event,
    };
  } catch (err) {
    return {
      ok: false,
      error: mapDatabaseErrorToPersistenceError(err, {
        expectedPublishedRevision: input.expectedPublishedRevision,
      }),
    };
  }
}
