import { DEFAULT_HOMEPAGE_PAGE_DOCUMENT } from "../homepage/default-homepage-document";
import {
  DEFAULT_STORE_SCOPE,
  type PersistenceDatabaseAdapter,
  type SavePageDraftInput,
  type SavePageDraftResult,
  type StorePageDraftMetadata,
  type StorePageDraftRecord,
} from "./persistence-types";
import { mapDatabaseErrorToPersistenceError, PersistenceError } from "./persistence-errors";
import {
  validateDocumentForPersistence,
  validatePageKeyAndSlug,
  validateStoreScope,
} from "./persistence-validation";
import { defaultPersistenceAdapter } from "./independent-persistence-adapter";

export interface DraftRepositoryOptions {
  adapter?: PersistenceDatabaseAdapter;
  storeScope?: string;
}

/**
 * Loads an authorized administrator's private draft for a given page ID.
 * Validates the stored PageDocument before returning it to the caller.
 */
export async function getAdminDraft(
  pageId: string,
  options: DraftRepositoryOptions = {},
): Promise<StorePageDraftRecord | null> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    const rawDraft = await adapter.getDraftByPageId(pageId, storeScope);
    if (!rawDraft) return null;
    const validated = validateDocumentForPersistence(rawDraft.draftDocument);
    return {
      ...rawDraft,
      draftDocument: validated.document,
    };
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}

/**
 * Loads draft metadata and detects whether the draft is based on an outdated
 * published revision (`isBasedOnOutdatedPublishedVersion`).
 */
export async function getAdminDraftMetadata(
  pageId: string,
  options: DraftRepositoryOptions = {},
): Promise<StorePageDraftMetadata | null> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    const [page, rawDraft] = await Promise.all([
      adapter.getPageById(pageId, storeScope),
      adapter.getDraftByPageId(pageId, storeScope),
    ]);
    if (!page || !rawDraft) return null;

    return {
      id: rawDraft.id,
      pageId: rawDraft.pageId,
      storeScope: rawDraft.storeScope,
      schemaVersion: rawDraft.schemaVersion,
      draftRevision: rawDraft.draftRevision,
      basePublishedVersionId: rawDraft.basePublishedVersionId,
      basePublishedRevision: rawDraft.basePublishedRevision,
      state: rawDraft.state,
      checksum: rawDraft.checksum,
      createdBy: rawDraft.createdBy,
      lastEditedBy: rawDraft.lastEditedBy,
      createdAt: rawDraft.createdAt,
      updatedAt: rawDraft.updatedAt,
      isBasedOnOutdatedPublishedVersion: rawDraft.basePublishedRevision < page.publishedRevision,
      currentPublishedRevision: page.publishedRevision,
    };
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}

/**
 * Saves or creates a page draft with full PageDocument validation and
 * optimistic concurrency revision checking.
 * Returns a structured `SavePageDraftResult` (`ok: true` or `ok: false` with `PersistenceError`).
 */
export async function savePageDraft(
  input: SavePageDraftInput,
  options: DraftRepositoryOptions = {},
): Promise<SavePageDraftResult> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  try {
    const storeScope = validateStoreScope(input.storeScope ?? options.storeScope);
    const { pageKey, slug } = validatePageKeyAndSlug(input.pageKey, input.slug);
    const title = input.title.trim();
    if (!title || title.length > 200) {
      throw new PersistenceError({
        code: "VALIDATION_FAILED",
        publicMessage: "Page title must be between 1 and 200 characters.",
      });
    }

    if (
      input.expectedDraftRevision !== null &&
      (!Number.isInteger(input.expectedDraftRevision) || input.expectedDraftRevision < 0)
    ) {
      throw new PersistenceError({
        code: "VALIDATION_FAILED",
        publicMessage: "expectedDraftRevision must be null or a non-negative integer.",
      });
    }

    const validated = validateDocumentForPersistence(input.document);

    const saved = await adapter.saveDraftAtomic({
      pageKey,
      pageType: input.pageType ?? "home",
      slug,
      title,
      schemaVersion: validated.document.schemaVersion,
      draftDocument: validated.document,
      checksum: validated.checksum,
      expectedDraftRevision: input.expectedDraftRevision,
      storeScope,
    });

    return {
      ok: true,
      draft: saved.draft,
      page: saved.page,
    };
  } catch (err) {
    return {
      ok: false,
      error: mapDatabaseErrorToPersistenceError(err, {
        expectedDraftRevision: input.expectedDraftRevision,
      }),
    };
  }
}

/**
 * Creates the initial homepage draft seeded from the canonical homepage PageDocument
 * (or custom initial document) with `expectedDraftRevision: 0`.
 */
export async function createInitialHomepageDraft(
  options: DraftRepositoryOptions & { document?: unknown } = {},
): Promise<SavePageDraftResult> {
  return savePageDraft(
    {
      pageKey: "home",
      pageType: "home",
      slug: "/",
      title: "Storefront Homepage",
      document: options.document ?? structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT),
      expectedDraftRevision: 0,
      storeScope: options.storeScope,
    },
    options,
  );
}

/**
 * Archives/discards a draft with optimistic concurrency checking.
 */
export async function archivePageDraft(
  pageId: string,
  expectedDraftRevision: number,
  options: DraftRepositoryOptions = {},
): Promise<StorePageDraftMetadata> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    return await adapter.archiveDraft(pageId, expectedDraftRevision, storeScope);
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err, {
      expectedDraftRevision,
    });
  }
}

/**
 * Restores a page's working draft to match the currently published version
 * (or the canonical default homepage document if the page has never been published).
 */
export async function resetDraftToPublishedVersion(
  pageId: string,
  expectedDraftRevision: number,
  options: DraftRepositoryOptions = {},
): Promise<SavePageDraftResult> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  try {
    const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
    const page = await adapter.getPageById(pageId, storeScope);
    if (!page) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Page not found.",
      });
    }

    let documentToRestore: unknown = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    if (page.publishedVersionId) {
      const publishedVersion = await adapter.getVersionById(
        page.id,
        page.publishedVersionId,
        storeScope,
      );
      if (!publishedVersion) {
        throw new PersistenceError({
          code: "NOT_FOUND",
          publicMessage: "Currently published version record could not be found.",
        });
      }
      documentToRestore = publishedVersion.documentSnapshot;
    }

    return await savePageDraft(
      {
        pageKey: page.pageKey,
        pageType: page.pageType,
        slug: page.slug,
        title: page.title,
        document: documentToRestore,
        expectedDraftRevision,
        storeScope,
      },
      options,
    );
  } catch (err) {
    return {
      ok: false,
      error: mapDatabaseErrorToPersistenceError(err, { expectedDraftRevision }),
    };
  }
}
