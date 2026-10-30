import {
  DEFAULT_STORE_SCOPE,
  type PersistenceDatabaseAdapter,
  type PublishPageDraftInput,
  type PublishPageDraftResult,
} from "../persistence/persistence-types";
import {
  mapDatabaseErrorToPersistenceError,
  PersistenceError,
} from "../persistence/persistence-errors";
import { validateStoreScope } from "../persistence/persistence-validation";
import { defaultPersistenceAdapter } from "../persistence/independent-persistence-adapter";
import { validateDocumentForPublishing } from "./publish-validation";

export interface PublishPageOptions {
  adapter?: PersistenceDatabaseAdapter;
  onCacheInvalidate?: (info: { pageId: string; slug: string; storeScope: string }) => void;
}

/**
 * Trusted atomic publishing primitive:
 * 1. Verifies store scope and administrator authorization.
 * 2. Loads the target page and intended draft revision.
 * 3. Verifies expected draft revision and optional expected published revision.
 * 4. Validates the draft PageDocument through `validateDocumentForPublishing`.
 * 5. Executes atomic database publication (creates immutable version snapshot,
 *    switches published pointer, increments published_revision, records audit event).
 * 6. Invokes optional cache invalidation callback only after commit succeeds.
 */
export async function publishPageDraft(
  input: PublishPageDraftInput,
  options: PublishPageOptions = {},
): Promise<PublishPageDraftResult> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  try {
    const storeScope = validateStoreScope(input.storeScope ?? DEFAULT_STORE_SCOPE);
    if (!Number.isInteger(input.expectedDraftRevision) || input.expectedDraftRevision < 1) {
      throw new PersistenceError({
        code: "VALIDATION_FAILED",
        publicMessage: "expectedDraftRevision must be a positive integer.",
      });
    }

    const [page, rawDraft] = await Promise.all([
      adapter.getPageById(input.pageId, storeScope),
      adapter.getDraftByPageId(input.pageId, storeScope),
    ]);

    if (!page) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Page not found for publishing.",
      });
    }

    if (!rawDraft) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "No draft exists for this page.",
      });
    }

    if (rawDraft.draftRevision !== input.expectedDraftRevision) {
      throw new PersistenceError({
        code: "DRAFT_REVISION_CONFLICT",
        publicMessage:
          "This draft was updated in another session. Reload the latest draft before publishing.",
        conflict: {
          conflictKind: "draft_revision",
          expectedRevision: input.expectedDraftRevision,
          actualRevision: rawDraft.draftRevision,
        },
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
          "Another administrator published a newer version of this page. Refresh before publishing.",
        conflict: {
          conflictKind: "published_revision",
          expectedRevision: input.expectedPublishedRevision,
          actualRevision: page.publishedRevision,
        },
      });
    }

    // Trusted publishing boundary validation before committing
    validateDocumentForPublishing(rawDraft.draftDocument, page.pageType);

    const committed = await adapter.publishDraftAtomic({
      pageId: input.pageId,
      expectedDraftRevision: input.expectedDraftRevision,
      expectedPublishedRevision: input.expectedPublishedRevision ?? null,
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
      previousVersionId: committed.previousVersionId,
      event: committed.event,
    };
  } catch (err) {
    return {
      ok: false,
      error: mapDatabaseErrorToPersistenceError(err, {
        expectedDraftRevision: input.expectedDraftRevision,
        expectedPublishedRevision: input.expectedPublishedRevision,
      }),
    };
  }
}
