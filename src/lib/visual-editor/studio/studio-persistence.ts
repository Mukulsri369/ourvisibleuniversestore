import { DEFAULT_HOMEPAGE_PAGE_DOCUMENT } from "../homepage/default-homepage-document";
import {
  DEFAULT_STORE_SCOPE,
  getAdminDraft,
  getPublishedPage,
  getStorePageByKey,
  mapDatabaseErrorToPersistenceError,
  PersistenceError,
  savePageDraft,
  type DraftRepositoryOptions,
  type PersistenceDatabaseAdapter,
  type StorePageDraftRecord,
  type StorePageRecord,
} from "../persistence/index";
import type { PageDocument } from "../schema/page-document";

export type StudioDraftInitializationSource =
  | "loaded_existing_draft"
  | "initialized_from_published"
  | "initialized_from_canonical"
  | "fallback_on_error";

export interface StudioDraftLoadResult {
  readonly source: StudioDraftInitializationSource;
  readonly workingDocument: PageDocument;
  readonly persistedDocument: PageDocument;
  readonly draftRevision: number;
  readonly publishedRevision: number;
  readonly isPublishedLive: boolean;
  readonly pageRecord: StorePageRecord | null;
  readonly draftRecord: StorePageDraftRecord | null;
  readonly error: PersistenceError | null;
}

export interface StudioSaveDraftInput {
  readonly workingDocument: PageDocument;
  readonly expectedDraftRevision: number;
  readonly pageKey?: string;
  readonly slug?: string;
  readonly title?: string;
}

export interface StudioSaveDraftOutcome {
  readonly ok: boolean;
  readonly persistedDocument: PageDocument;
  readonly draftRevision: number;
  readonly publishedRevision: number;
  readonly savedAt: string | null;
  readonly pageRecord: StorePageRecord | null;
  readonly draftRecord: StorePageDraftRecord | null;
  readonly error: PersistenceError | null;
}

const SESSION_RECOVERY_KEY_PREFIX = "ovu-studio-unsaved-draft:";

export function saveLocalDraftRecoverySnapshot(pageKey: string, doc: PageDocument): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(`${SESSION_RECOVERY_KEY_PREFIX}${pageKey}`, JSON.stringify(doc));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearLocalDraftRecoverySnapshot(pageKey: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(`${SESSION_RECOVERY_KEY_PREFIX}${pageKey}`);
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Loads the authorized administrator's working draft for the Store Design Studio
 * using Prompt 8's persistence services (`getStorePageByKey`, `getAdminDraft`, `getPublishedPage`).
 *
 * Invariants:
 * - Never modifies the live published storefront merely by opening the studio.
 * - If an active draft exists, restores its validated `PageDocument` and `draftRevision`.
 * - If no draft exists yet, seeds the working state from the currently published document
 *   (if published) or `DEFAULT_HOMEPAGE_PAGE_DOCUMENT` with `draftRevision: 0`.
 * - If the database is unreachable or returns an error, surfaces a structured `PersistenceError`
 *   while providing `DEFAULT_HOMEPAGE_PAGE_DOCUMENT` so the studio canvas is never blank
 *   (except for `UNAUTHORIZED` / `FORBIDDEN`, where the caller blocks access).
 */
export async function loadStudioWorkspaceDraft(
  options: DraftRepositoryOptions & {
    pageKey?: string;
    pageSlug?: string;
    adapter?: PersistenceDatabaseAdapter;
  } = {},
): Promise<StudioDraftLoadResult> {
  const pageKey = options.pageKey ?? "home";
  const pageSlug = options.pageSlug ?? "/";
  const storeScope = options.storeScope ?? DEFAULT_STORE_SCOPE;

  try {
    const pageRecord = await getStorePageByKey(pageKey, {
      adapter: options.adapter,
      storeScope,
    });

    if (pageRecord) {
      const existingDraft = await getAdminDraft(pageRecord.id, {
        adapter: options.adapter,
        storeScope,
      });

      if (existingDraft) {
        const cloned = structuredClone(existingDraft.draftDocument);
        return {
          source: "loaded_existing_draft",
          workingDocument: cloned,
          persistedDocument: structuredClone(existingDraft.draftDocument),
          draftRevision: existingDraft.draftRevision,
          publishedRevision: pageRecord.publishedRevision,
          isPublishedLive:
            pageRecord.status === "published" && Boolean(pageRecord.publishedVersionId),
          pageRecord,
          draftRecord: existingDraft,
          error: null,
        };
      }

      if (pageRecord.publishedVersionId) {
        const publishedRead = await getPublishedPage(pageSlug, {
          adapter: options.adapter,
          storeScope,
        });
        const baseDoc = structuredClone(publishedRead.document);
        return {
          source: "initialized_from_published",
          workingDocument: baseDoc,
          persistedDocument: structuredClone(publishedRead.document),
          draftRevision: 0,
          publishedRevision: pageRecord.publishedRevision,
          isPublishedLive: true,
          pageRecord,
          draftRecord: null,
          error: null,
        };
      }
    }

    const canonicalDoc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    return {
      source: "initialized_from_canonical",
      workingDocument: canonicalDoc,
      persistedDocument: structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT),
      draftRevision: 0,
      publishedRevision: pageRecord?.publishedRevision ?? 0,
      isPublishedLive: false,
      pageRecord: pageRecord ?? null,
      draftRecord: null,
      error: null,
    };
  } catch (err) {
    const mappedError = mapDatabaseErrorToPersistenceError(err);
    const fallbackDoc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    return {
      source: "fallback_on_error",
      workingDocument: fallbackDoc,
      persistedDocument: structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT),
      draftRevision: 0,
      publishedRevision: 0,
      isPublishedLive: false,
      pageRecord: null,
      draftRecord: null,
      error: mappedError,
    };
  }
}

/**
 * Persists the administrator's working draft through Prompt 8's `savePageDraft` primitive.
 * - Validates the working `PageDocument` before writing.
 * - Enforces optimistic concurrency via `expectedDraftRevision`.
 * - Never alters the live published page (`published_version_id` remains untouched).
 * - Preserves the administrator's unsaved changes in memory if saving fails.
 */
export async function saveStudioWorkspaceDraft(
  input: StudioSaveDraftInput,
  options: DraftRepositoryOptions = {},
): Promise<StudioSaveDraftOutcome> {
  const pageKey = input.pageKey ?? "home";
  const slug = input.slug ?? "/";
  const title = (input.title ?? input.workingDocument.name ?? "Storefront Homepage").trim();

  const result = await savePageDraft(
    {
      pageKey,
      pageType: "home",
      slug,
      title: title || "Storefront Homepage",
      document: input.workingDocument,
      expectedDraftRevision: input.expectedDraftRevision,
      storeScope: options.storeScope ?? DEFAULT_STORE_SCOPE,
    },
    options,
  );

  if (result.ok) {
    clearLocalDraftRecoverySnapshot(pageKey);
    return {
      ok: true,
      persistedDocument: structuredClone(result.draft.draftDocument),
      draftRevision: result.draft.draftRevision,
      publishedRevision: result.page.publishedRevision,
      savedAt: result.draft.updatedAt,
      pageRecord: result.page,
      draftRecord: result.draft,
      error: null,
    };
  }

  return {
    ok: false,
    persistedDocument: input.workingDocument,
    draftRevision: input.expectedDraftRevision,
    publishedRevision: 0,
    savedAt: null,
    pageRecord: null,
    draftRecord: null,
    error: result.error,
  };
}
