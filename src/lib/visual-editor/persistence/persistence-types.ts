import type { PageDocument } from "../schema/page-document";
import type { PersistenceError } from "./persistence-errors";

export const DEFAULT_STORE_SCOPE = "default" as const;

export type StorePageType = "home" | "category" | "landing" | "custom";
export type StorePageDraftState = "active" | "archived";
export type PublishingActionType = "publish" | "rollback";

export type PersistenceActorRole = "anonymous" | "authenticated_non_admin" | "admin";

export interface PersistenceActorContext {
  role: PersistenceActorRole;
  userId?: string | null;
  email?: string | null;
}

export interface StorePageRecord {
  id: string;
  storeScope: string;
  pageKey: string;
  pageType: StorePageType;
  slug: string;
  title: string;
  publishedVersionId: string | null;
  publishedRevision: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorePageDraftRecord {
  id: string;
  pageId: string;
  storeScope: string;
  schemaVersion: string;
  draftDocument: PageDocument;
  draftRevision: number;
  basePublishedVersionId: string | null;
  basePublishedRevision: number;
  state: StorePageDraftState;
  checksum: string;
  createdBy: string | null;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorePageDraftMetadata {
  id: string;
  pageId: string;
  storeScope: string;
  schemaVersion: string;
  draftRevision: number;
  basePublishedVersionId: string | null;
  basePublishedRevision: number;
  state: StorePageDraftState;
  checksum: string;
  createdBy: string | null;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
  isBasedOnOutdatedPublishedVersion: boolean;
  currentPublishedRevision: number;
}

export interface StorePageVersionMetadata {
  id: string;
  pageId: string;
  storeScope: string;
  versionNumber: number;
  schemaVersion: string;
  checksum: string;
  sourceDraftRevision: number | null;
  restoredFromVersionId: string | null;
  releaseNotes: string | null;
  createdBy: string | null;
  createdAt: string;
  isCurrentPublished: boolean;
}

export interface StorePageVersionRecord extends StorePageVersionMetadata {
  documentSnapshot: PageDocument;
}

export interface StorePagePublishingEventRecord {
  id: string;
  pageId: string;
  storeScope: string;
  actionType: PublishingActionType;
  publishedVersionId: string;
  previousVersionId: string | null;
  publishedRevision: number;
  draftRevision: number | null;
  notes: string | null;
  actorId: string | null;
  createdAt: string;
}

/**
 * Public-safe published page projection.
 * Never includes draft documents, admin emails, actor IDs, or private release notes.
 */
export interface PublishedStorePageSnapshot {
  pageId: string;
  pageKey: string;
  pageType: StorePageType;
  slug: string;
  storeScope: string;
  versionId: string;
  versionNumber: number;
  publishedRevision: number;
  schemaVersion: string;
  document: PageDocument;
  checksum: string;
  publishedAt: string | null;
}

export interface PublicPageReadResult {
  source: "database_published" | "canonical_fallback";
  document: PageDocument;
  publishedSnapshot: PublishedStorePageSnapshot | null;
  fallbackReason?:
    | "not_persisted"
    | "not_published"
    | "database_unavailable"
    | "validation_failed"
    | "incompatible_schema";
}

export interface SavePageDraftInput {
  pageKey: string;
  pageType?: StorePageType;
  slug: string;
  title: string;
  document: unknown;
  /**
   * Optimistic concurrency revision:
   * - Pass `null` or `0` when creating the very first draft for a page.
   * - Pass the currently loaded `draftRevision` (>= 1) when saving updates.
   */
  expectedDraftRevision: number | null;
  storeScope?: string;
}

export type SavePageDraftResult =
  | {
      ok: true;
      draft: StorePageDraftRecord;
      page: StorePageRecord;
    }
  | {
      ok: false;
      error: PersistenceError;
    };

export interface ListPageVersionsOptions {
  pageId: string;
  limit?: number;
  offset?: number;
  storeScope?: string;
}

export interface ListPageVersionsResult {
  items: StorePageVersionMetadata[];
  total: number;
  currentPublishedVersionId: string | null;
  currentPublishedRevision: number;
}

export interface VersionComparisonSummary {
  pageId: string;
  fromVersion: StorePageVersionMetadata;
  toVersion: StorePageVersionMetadata;
  versionDelta: number;
  checksumChanged: boolean;
  schemaVersionChanged: boolean;
}

export interface PublishPageDraftInput {
  pageId: string;
  expectedDraftRevision: number;
  expectedPublishedRevision?: number | null;
  releaseNotes?: string | null;
  storeScope?: string;
}

export type PublishPageDraftResult =
  | {
      ok: true;
      page: StorePageRecord;
      publishedVersion: StorePageVersionRecord;
      previousVersionId: string | null;
      event: StorePagePublishingEventRecord;
    }
  | {
      ok: false;
      error: PersistenceError;
    };

export interface RestorePublishedVersionInput {
  pageId: string;
  targetVersionId: string;
  expectedPublishedRevision?: number | null;
  syncDraftToRestoredVersion?: boolean;
  releaseNotes?: string | null;
  storeScope?: string;
}

export type RestorePublishedVersionResult =
  | {
      ok: true;
      page: StorePageRecord;
      publishedVersion: StorePageVersionRecord;
      restoredFromVersionId: string;
      previousVersionId: string | null;
      event: StorePagePublishingEventRecord;
    }
  | {
      ok: false;
      error: PersistenceError;
    };

/**
 * Low-level database adapter contract used by the repositories and publishing primitives.
 * Allows switching between the live Supabase client adapter and the deterministic
 * transactional SQL-invariant/RLS simulator in automated tests.
 */
export interface PersistenceDatabaseAdapter {
  getPublishedPageBySlug(
    slug: string,
    storeScope?: string,
  ): Promise<{
    pageId: string;
    pageKey: string;
    pageType: StorePageType;
    slug: string;
    storeScope: string;
    versionId: string;
    versionNumber: number;
    publishedRevision: number;
    schemaVersion: string;
    documentSnapshot: unknown;
    checksum: string;
    publishedAt: string | null;
  } | null>;

  getPageByKey(pageKey: string, storeScope?: string): Promise<StorePageRecord | null>;
  getPageById(pageId: string, storeScope?: string): Promise<StorePageRecord | null>;

  getDraftByPageId(
    pageId: string,
    storeScope?: string,
  ): Promise<{
    id: string;
    pageId: string;
    storeScope: string;
    schemaVersion: string;
    draftDocument: unknown;
    draftRevision: number;
    basePublishedVersionId: string | null;
    basePublishedRevision: number;
    state: StorePageDraftState;
    checksum: string;
    createdBy: string | null;
    lastEditedBy: string | null;
    createdAt: string;
    updatedAt: string;
  } | null>;

  saveDraftAtomic(params: {
    pageKey: string;
    pageType: StorePageType;
    slug: string;
    title: string;
    schemaVersion: string;
    draftDocument: PageDocument;
    checksum: string;
    expectedDraftRevision: number | null;
    storeScope: string;
  }): Promise<{
    draft: StorePageDraftRecord;
    page: StorePageRecord;
  }>;

  archiveDraft(
    pageId: string,
    expectedDraftRevision: number,
    storeScope?: string,
  ): Promise<StorePageDraftMetadata>;

  listVersionMetadata(options: {
    pageId: string;
    limit: number;
    offset: number;
    storeScope: string;
  }): Promise<ListPageVersionsResult>;

  getVersionById(
    pageId: string,
    versionId: string,
    storeScope?: string,
  ): Promise<{
    id: string;
    pageId: string;
    storeScope: string;
    versionNumber: number;
    schemaVersion: string;
    documentSnapshot: unknown;
    checksum: string;
    sourceDraftRevision: number | null;
    restoredFromVersionId: string | null;
    releaseNotes: string | null;
    createdBy: string | null;
    createdAt: string;
    isCurrentPublished: boolean;
  } | null>;

  publishDraftAtomic(params: {
    pageId: string;
    expectedDraftRevision: number;
    expectedPublishedRevision: number | null;
    releaseNotes: string | null;
    storeScope: string;
  }): Promise<{
    page: StorePageRecord;
    publishedVersion: StorePageVersionRecord;
    previousVersionId: string | null;
    event: StorePagePublishingEventRecord;
  }>;

  restoreVersionAtomic(params: {
    pageId: string;
    targetVersionId: string;
    expectedPublishedRevision: number | null;
    syncDraft: boolean;
    releaseNotes: string | null;
    storeScope: string;
  }): Promise<{
    page: StorePageRecord;
    publishedVersion: StorePageVersionRecord;
    restoredFromVersionId: string;
    previousVersionId: string | null;
    event: StorePagePublishingEventRecord;
  }>;

  listPublishingEvents(
    pageId: string,
    limit?: number,
    storeScope?: string,
  ): Promise<StorePagePublishingEventRecord[]>;
}
