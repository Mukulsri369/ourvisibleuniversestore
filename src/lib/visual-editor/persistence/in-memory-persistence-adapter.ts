import type { PageDocument } from "../schema/page-document";
import {
  DEFAULT_STORE_SCOPE,
  type ListPageVersionsResult,
  type PersistenceActorContext,
  type PersistenceDatabaseAdapter,
  type PublishingActionType,
  type StorePageDraftMetadata,
  type StorePageDraftRecord,
  type StorePageDraftState,
  type StorePagePublishingEventRecord,
  type StorePageRecord,
  type StorePageType,
  type StorePageVersionMetadata,
  type StorePageVersionRecord,
} from "./persistence-types";
import { mapDatabaseErrorToPersistenceError, PersistenceError } from "./persistence-errors";
import { validateDocumentForPersistence, validateStoreScope } from "./persistence-validation";

/** Deterministic test simulator. Production uses independent server functions and MariaDB. */
export class InMemoryTransactionalPersistenceAdapter implements PersistenceDatabaseAdapter {
  private pages = new Map<string, StorePageRecord>();
  private drafts = new Map<string, StorePageDraftRecord & { rawDocument: unknown }>();
  private versions = new Map<string, StorePageVersionRecord & { rawDocument: unknown }>();
  private events = new Map<string, StorePagePublishingEventRecord>();
  private actor: PersistenceActorContext;
  private simulateDatabaseDown = false;
  private simulateCommitFailure = false;
  private idCounter = 1;

  constructor(
    actor: PersistenceActorContext = {
      role: "admin",
      userId: "admin-1",
      email: "admin@store.local",
    },
  ) {
    this.actor = actor;
  }

  setActor(actor: PersistenceActorContext) {
    this.actor = actor;
  }

  getActor(): PersistenceActorContext {
    return this.actor;
  }

  setSimulateDatabaseDown(down: boolean) {
    this.simulateDatabaseDown = down;
  }

  setSimulateCommitFailure(fail: boolean) {
    this.simulateCommitFailure = fail;
  }

  /**
   * Seeds a corrupted raw version or draft for testing recovery/fallback boundaries.
   */
  seedRawCorruptedPublishedPage(params: {
    pageId: string;
    pageKey: string;
    slug: string;
    schemaVersion: string;
    corruptedDocument: unknown;
  }) {
    const now = new Date().toISOString();
    const versionId = `ver-corrupt-${this.idCounter++}`;
    this.pages.set(params.pageId, {
      id: params.pageId,
      storeScope: DEFAULT_STORE_SCOPE,
      pageKey: params.pageKey,
      pageType: "home",
      slug: params.slug,
      title: "Corrupted Home",
      publishedVersionId: versionId,
      publishedRevision: 1,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    this.versions.set(versionId, {
      id: versionId,
      pageId: params.pageId,
      storeScope: DEFAULT_STORE_SCOPE,
      versionNumber: 1,
      schemaVersion: params.schemaVersion,
      documentSnapshot: params.corruptedDocument as PageDocument,
      rawDocument: params.corruptedDocument,
      checksum: "corrupt-checksum",
      sourceDraftRevision: 1,
      restoredFromVersionId: null,
      releaseNotes: null,
      createdBy: "admin@store.local",
      createdAt: now,
      isCurrentPublished: true,
    });
  }

  /**
   * Simulates attempting a direct SQL UPDATE or DELETE on `store_page_versions`
   * to test the `prevent_immutable_page_version_mutation` trigger.
   */
  attemptMutateHistoricalVersion(versionId: string): never {
    this.ensureHealthy();
    this.requireAdmin();
    if (!this.versions.has(versionId)) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Version not found.",
      });
    }
    throw mapDatabaseErrorToPersistenceError({
      code: "55000",
      message:
        "Historical page versions and publishing events are immutable and cannot be modified or deleted.",
    });
  }

  private nextId(prefix: string): string {
    const n = this.idCounter++;
    return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
  }

  private ensureHealthy() {
    if (this.simulateDatabaseDown) {
      throw new PersistenceError({
        code: "DATABASE_UNAVAILABLE",
        publicMessage: "The design database is temporarily unavailable.",
        diagnosticMessage: "Simulated connection timeout (08006)",
        retryable: true,
      });
    }
  }

  private requireAdmin() {
    if (this.actor.role === "anonymous") {
      throw new PersistenceError({
        code: "UNAUTHORIZED",
        publicMessage: "Authentication is required to access storefront design drafts.",
        diagnosticMessage: "RLS policy rejection: anonymous role has no grants on admin tables",
      });
    }
    if (this.actor.role !== "admin") {
      throw new PersistenceError({
        code: "FORBIDDEN",
        publicMessage: "Administrator privileges are required for this operation.",
        diagnosticMessage: "RLS policy rejection: public.is_admin() returned false",
      });
    }
  }

  async getPublishedPageBySlug(slug: string, storeScope: string = DEFAULT_STORE_SCOPE) {
    this.ensureHealthy();
    validateStoreScope(storeScope);
    const normalizedSlug = slug.trim();

    for (const page of this.pages.values()) {
      if (
        page.storeScope === DEFAULT_STORE_SCOPE &&
        page.slug === normalizedSlug &&
        page.publishedVersionId
      ) {
        const version = this.versions.get(page.publishedVersionId);
        if (version && version.pageId === page.id) {
          return {
            pageId: page.id,
            pageKey: page.pageKey,
            pageType: page.pageType,
            slug: page.slug,
            storeScope: page.storeScope,
            versionId: version.id,
            versionNumber: version.versionNumber,
            publishedRevision: page.publishedRevision,
            schemaVersion: version.schemaVersion,
            documentSnapshot: structuredClone(version.rawDocument),
            checksum: version.checksum,
            publishedAt: page.publishedAt,
          };
        }
      }
    }
    return null;
  }

  async getPageByKey(
    pageKey: string,
    storeScope: string = DEFAULT_STORE_SCOPE,
  ): Promise<StorePageRecord | null> {
    this.ensureHealthy();
    validateStoreScope(storeScope);
    this.requireAdmin();
    for (const page of this.pages.values()) {
      if (page.storeScope === storeScope && page.pageKey === pageKey.trim()) {
        return structuredClone(page);
      }
    }
    return null;
  }

  async getPageById(
    pageId: string,
    storeScope: string = DEFAULT_STORE_SCOPE,
  ): Promise<StorePageRecord | null> {
    this.ensureHealthy();
    validateStoreScope(storeScope);
    this.requireAdmin();
    const page = this.pages.get(pageId);
    if (!page || page.storeScope !== storeScope) return null;
    return structuredClone(page);
  }

  async getDraftByPageId(pageId: string, storeScope: string = DEFAULT_STORE_SCOPE) {
    this.ensureHealthy();
    validateStoreScope(storeScope);
    this.requireAdmin();
    for (const draft of this.drafts.values()) {
      if (draft.pageId === pageId && draft.storeScope === storeScope) {
        return {
          id: draft.id,
          pageId: draft.pageId,
          storeScope: draft.storeScope,
          schemaVersion: draft.schemaVersion,
          draftDocument: structuredClone(draft.rawDocument),
          draftRevision: draft.draftRevision,
          basePublishedVersionId: draft.basePublishedVersionId,
          basePublishedRevision: draft.basePublishedRevision,
          state: draft.state,
          checksum: draft.checksum,
          createdBy: draft.createdBy,
          lastEditedBy: draft.lastEditedBy,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        };
      }
    }
    return null;
  }

  async saveDraftAtomic(params: {
    pageKey: string;
    pageType: StorePageType;
    slug: string;
    title: string;
    schemaVersion: string;
    draftDocument: PageDocument;
    checksum: string;
    expectedDraftRevision: number | null;
    storeScope: string;
  }): Promise<{ draft: StorePageDraftRecord; page: StorePageRecord }> {
    this.ensureHealthy();
    validateStoreScope(params.storeScope);
    this.requireAdmin();

    if (this.simulateCommitFailure) {
      throw new PersistenceError({
        code: "STORAGE_FAILURE",
        publicMessage: "Simulated storage commit failure; transaction rolled back.",
        retryable: true,
      });
    }

    const now = new Date().toISOString();
    let existingPage: StorePageRecord | undefined;
    for (const p of this.pages.values()) {
      if (p.storeScope === params.storeScope && p.pageKey === params.pageKey) {
        existingPage = p;
        break;
      }
    }

    let page: StorePageRecord;
    if (!existingPage) {
      page = {
        id: this.nextId("page0000"),
        storeScope: params.storeScope,
        pageKey: params.pageKey,
        pageType: params.pageType,
        slug: params.slug,
        title: params.title,
        publishedVersionId: null,
        publishedRevision: 0,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      page = {
        ...existingPage,
        title: params.title,
        updatedAt: now,
      };
    }

    let existingDraft: (StorePageDraftRecord & { rawDocument: unknown }) | undefined;
    for (const d of this.drafts.values()) {
      if (d.pageId === page.id) {
        existingDraft = d;
        break;
      }
    }

    let savedDraft: StorePageDraftRecord & { rawDocument: unknown };
    if (!existingDraft) {
      if (params.expectedDraftRevision !== null && params.expectedDraftRevision !== 0) {
        throw new PersistenceError({
          code: "DRAFT_REVISION_CONFLICT",
          publicMessage:
            "This draft was updated in another session. Reload the latest draft before saving.",
          conflict: {
            conflictKind: "draft_revision",
            expectedRevision: params.expectedDraftRevision,
            actualRevision: 0,
          },
        });
      }
      const clonedDoc = structuredClone(params.draftDocument);
      savedDraft = {
        id: this.nextId("drft0000"),
        pageId: page.id,
        storeScope: params.storeScope,
        schemaVersion: params.schemaVersion,
        draftDocument: clonedDoc,
        rawDocument: clonedDoc,
        draftRevision: 1,
        basePublishedVersionId: page.publishedVersionId,
        basePublishedRevision: page.publishedRevision,
        state: "active",
        checksum: params.checksum,
        createdBy: this.actor.email ?? null,
        lastEditedBy: this.actor.email ?? null,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      if (
        params.expectedDraftRevision === null ||
        existingDraft.draftRevision !== params.expectedDraftRevision
      ) {
        throw new PersistenceError({
          code: "DRAFT_REVISION_CONFLICT",
          publicMessage:
            "This draft was updated in another session. Reload the latest draft before saving.",
          conflict: {
            conflictKind: "draft_revision",
            expectedRevision: params.expectedDraftRevision,
            actualRevision: existingDraft.draftRevision,
          },
        });
      }
      const clonedDoc = structuredClone(params.draftDocument);
      savedDraft = {
        ...existingDraft,
        schemaVersion: params.schemaVersion,
        draftDocument: clonedDoc,
        rawDocument: clonedDoc,
        draftRevision: existingDraft.draftRevision + 1,
        state: "active",
        checksum: params.checksum,
        lastEditedBy: this.actor.email ?? existingDraft.lastEditedBy,
        updatedAt: now,
      };
    }

    this.pages.set(page.id, page);
    this.drafts.set(savedDraft.id, savedDraft);

    const { rawDocument: _, ...cleanDraft } = savedDraft;
    return {
      page: structuredClone(page),
      draft: structuredClone(cleanDraft),
    };
  }

  async archiveDraft(
    pageId: string,
    expectedDraftRevision: number,
    storeScope: string = DEFAULT_STORE_SCOPE,
  ): Promise<StorePageDraftMetadata> {
    this.ensureHealthy();
    validateStoreScope(storeScope);
    this.requireAdmin();

    const page = this.pages.get(pageId);
    if (!page || page.storeScope !== storeScope) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Page not found.",
      });
    }

    let draft: (StorePageDraftRecord & { rawDocument: unknown }) | undefined;
    for (const d of this.drafts.values()) {
      if (d.pageId === pageId && d.storeScope === storeScope) {
        draft = d;
        break;
      }
    }
    if (!draft) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Draft not found.",
      });
    }

    if (draft.draftRevision !== expectedDraftRevision) {
      throw new PersistenceError({
        code: "DRAFT_REVISION_CONFLICT",
        publicMessage: "Draft revision conflict while archiving.",
        conflict: {
          conflictKind: "draft_revision",
          expectedRevision: expectedDraftRevision,
          actualRevision: draft.draftRevision,
        },
      });
    }

    const updated = {
      ...draft,
      state: "archived" as const,
      draftRevision: draft.draftRevision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.drafts.set(updated.id, updated);

    return {
      id: updated.id,
      pageId: updated.pageId,
      storeScope: updated.storeScope,
      schemaVersion: updated.schemaVersion,
      draftRevision: updated.draftRevision,
      basePublishedVersionId: updated.basePublishedVersionId,
      basePublishedRevision: updated.basePublishedRevision,
      state: updated.state,
      checksum: updated.checksum,
      createdBy: updated.createdBy,
      lastEditedBy: updated.lastEditedBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      isBasedOnOutdatedPublishedVersion: updated.basePublishedRevision < page.publishedRevision,
      currentPublishedRevision: page.publishedRevision,
    };
  }

  async listVersionMetadata(options: {
    pageId: string;
    limit: number;
    offset: number;
    storeScope: string;
  }): Promise<ListPageVersionsResult> {
    this.ensureHealthy();
    validateStoreScope(options.storeScope);
    this.requireAdmin();

    const page = this.pages.get(options.pageId);
    if (!page || page.storeScope !== options.storeScope) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Page not found.",
      });
    }

    const allVersions = Array.from(this.versions.values())
      .filter((v) => v.pageId === options.pageId && v.storeScope === options.storeScope)
      .sort((a, b) => b.versionNumber - a.versionNumber);

    const sliced = allVersions.slice(options.offset, options.offset + options.limit);
    const items: StorePageVersionMetadata[] = sliced.map((v) => ({
      id: v.id,
      pageId: v.pageId,
      storeScope: v.storeScope,
      versionNumber: v.versionNumber,
      schemaVersion: v.schemaVersion,
      checksum: v.checksum,
      sourceDraftRevision: v.sourceDraftRevision,
      restoredFromVersionId: v.restoredFromVersionId,
      releaseNotes: v.releaseNotes,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
      isCurrentPublished: v.id === page.publishedVersionId,
    }));

    return {
      items,
      total: allVersions.length,
      currentPublishedVersionId: page.publishedVersionId,
      currentPublishedRevision: page.publishedRevision,
    };
  }

  async getVersionById(
    pageId: string,
    versionId: string,
    storeScope: string = DEFAULT_STORE_SCOPE,
  ) {
    this.ensureHealthy();
    validateStoreScope(storeScope);
    this.requireAdmin();

    const page = this.pages.get(pageId);
    if (!page || page.storeScope !== storeScope) return null;

    const version = this.versions.get(versionId);
    if (!version || version.pageId !== pageId || version.storeScope !== storeScope) {
      return null;
    }

    return {
      id: version.id,
      pageId: version.pageId,
      storeScope: version.storeScope,
      versionNumber: version.versionNumber,
      schemaVersion: version.schemaVersion,
      documentSnapshot: structuredClone(version.rawDocument),
      checksum: version.checksum,
      sourceDraftRevision: version.sourceDraftRevision,
      restoredFromVersionId: version.restoredFromVersionId,
      releaseNotes: version.releaseNotes,
      createdBy: version.createdBy,
      createdAt: version.createdAt,
      isCurrentPublished: version.id === page.publishedVersionId,
    };
  }

  async publishDraftAtomic(params: {
    pageId: string;
    expectedDraftRevision: number;
    expectedPublishedRevision: number | null;
    releaseNotes: string | null;
    storeScope: string;
  }) {
    this.ensureHealthy();
    validateStoreScope(params.storeScope);
    this.requireAdmin();

    const page = this.pages.get(params.pageId);
    if (!page || page.storeScope !== params.storeScope) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Page not found for publishing.",
      });
    }

    if (
      params.expectedPublishedRevision !== null &&
      page.publishedRevision !== params.expectedPublishedRevision
    ) {
      throw new PersistenceError({
        code: "PUBLISHED_REVISION_CONFLICT",
        publicMessage:
          "Another administrator published a newer version of this page. Refresh before publishing.",
        conflict: {
          conflictKind: "published_revision",
          expectedRevision: params.expectedPublishedRevision,
          actualRevision: page.publishedRevision,
        },
      });
    }

    let draft: (StorePageDraftRecord & { rawDocument: unknown }) | undefined;
    for (const d of this.drafts.values()) {
      if (d.pageId === page.id && d.storeScope === params.storeScope) {
        draft = d;
        break;
      }
    }

    if (!draft) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "No draft exists for this page.",
      });
    }

    if (draft.draftRevision !== params.expectedDraftRevision) {
      throw new PersistenceError({
        code: "DRAFT_REVISION_CONFLICT",
        publicMessage:
          "This draft was updated in another session. Reload the latest draft before publishing.",
        conflict: {
          conflictKind: "draft_revision",
          expectedRevision: params.expectedDraftRevision,
          actualRevision: draft.draftRevision,
        },
      });
    }

    // Validate draft document at trusted publish boundary before committing any changes
    const validated = validateDocumentForPersistence(draft.rawDocument);

    if (this.simulateCommitFailure) {
      throw new PersistenceError({
        code: "STORAGE_FAILURE",
        publicMessage: "Simulated publish transaction failure; previous published page preserved.",
        retryable: true,
      });
    }

    const existingPageVersions = Array.from(this.versions.values()).filter(
      (v) => v.pageId === page.id,
    );
    const nextVersionNumber =
      existingPageVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;

    const now = new Date().toISOString();
    const prevVersionId = page.publishedVersionId;
    const snapshotClone = structuredClone(validated.document);

    const newVersion: StorePageVersionRecord & { rawDocument: unknown } = {
      id: this.nextId("ver00000"),
      pageId: page.id,
      storeScope: params.storeScope,
      versionNumber: nextVersionNumber,
      schemaVersion: validated.document.schemaVersion,
      documentSnapshot: snapshotClone,
      rawDocument: snapshotClone,
      checksum: validated.checksum,
      sourceDraftRevision: draft.draftRevision,
      restoredFromVersionId: null,
      releaseNotes: params.releaseNotes?.trim() || null,
      createdBy: this.actor.email ?? null,
      createdAt: now,
      isCurrentPublished: true,
    };

    const nextPublishedRevision = page.publishedRevision + 1;
    const updatedPage: StorePageRecord = {
      ...page,
      publishedVersionId: newVersion.id,
      publishedRevision: nextPublishedRevision,
      publishedAt: now,
      updatedAt: now,
    };

    const updatedDraft = {
      ...draft,
      basePublishedVersionId: newVersion.id,
      basePublishedRevision: nextPublishedRevision,
    };

    const event: StorePagePublishingEventRecord = {
      id: this.nextId("evt00000"),
      pageId: page.id,
      storeScope: params.storeScope,
      actionType: "publish",
      publishedVersionId: newVersion.id,
      previousVersionId: prevVersionId,
      publishedRevision: nextPublishedRevision,
      draftRevision: draft.draftRevision,
      notes: params.releaseNotes?.trim() || null,
      actorId: this.actor.userId ?? null,
      createdAt: now,
    };

    // Atomic commit across versions, pages, drafts, and events
    this.versions.set(newVersion.id, newVersion);
    this.pages.set(updatedPage.id, updatedPage);
    this.drafts.set(updatedDraft.id, updatedDraft);
    this.events.set(event.id, event);

    const { rawDocument: _, ...cleanVersion } = newVersion;
    return {
      page: structuredClone(updatedPage),
      publishedVersion: structuredClone(cleanVersion),
      previousVersionId: prevVersionId,
      event: structuredClone(event),
    };
  }

  async restoreVersionAtomic(params: {
    pageId: string;
    targetVersionId: string;
    expectedPublishedRevision: number | null;
    syncDraft: boolean;
    releaseNotes: string | null;
    storeScope: string;
  }) {
    this.ensureHealthy();
    validateStoreScope(params.storeScope);
    this.requireAdmin();

    const page = this.pages.get(params.pageId);
    if (!page || page.storeScope !== params.storeScope) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Page not found for version restore.",
      });
    }

    if (
      params.expectedPublishedRevision !== null &&
      page.publishedRevision !== params.expectedPublishedRevision
    ) {
      throw new PersistenceError({
        code: "PUBLISHED_REVISION_CONFLICT",
        publicMessage:
          "Another administrator published a newer version of this page. Refresh before restoring.",
        conflict: {
          conflictKind: "published_revision",
          expectedRevision: params.expectedPublishedRevision,
          actualRevision: page.publishedRevision,
        },
      });
    }

    const targetVersion = this.versions.get(params.targetVersionId);
    if (!targetVersion || targetVersion.storeScope !== params.storeScope) {
      throw new PersistenceError({
        code: "NOT_FOUND",
        publicMessage: "Target historical version not found.",
      });
    }

    if (targetVersion.pageId !== page.id) {
      throw new PersistenceError({
        code: "INVALID_PAGE_VERSION_RELATIONSHIP",
        publicMessage: "The specified version does not belong to the target storefront page.",
      });
    }

    // Validate target version snapshot against current schema & registry before switching live pointer
    const validated = validateDocumentForPersistence(targetVersion.rawDocument);

    if (this.simulateCommitFailure) {
      throw new PersistenceError({
        code: "STORAGE_FAILURE",
        publicMessage:
          "Simulated rollback transaction failure; active published version preserved.",
        retryable: true,
      });
    }

    const existingPageVersions = Array.from(this.versions.values()).filter(
      (v) => v.pageId === page.id,
    );
    const nextVersionNumber =
      existingPageVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;

    const now = new Date().toISOString();
    const prevVersionId = page.publishedVersionId;
    const snapshotClone = structuredClone(validated.document);
    const notes =
      params.releaseNotes?.trim() || `Restored from version #${targetVersion.versionNumber}`;

    const restoredVersion: StorePageVersionRecord & { rawDocument: unknown } = {
      id: this.nextId("ver00000"),
      pageId: page.id,
      storeScope: params.storeScope,
      versionNumber: nextVersionNumber,
      schemaVersion: validated.document.schemaVersion,
      documentSnapshot: snapshotClone,
      rawDocument: snapshotClone,
      checksum: validated.checksum,
      sourceDraftRevision: null,
      restoredFromVersionId: targetVersion.id,
      releaseNotes: notes,
      createdBy: this.actor.email ?? null,
      createdAt: now,
      isCurrentPublished: true,
    };

    const nextPublishedRevision = page.publishedRevision + 1;
    const updatedPage: StorePageRecord = {
      ...page,
      publishedVersionId: restoredVersion.id,
      publishedRevision: nextPublishedRevision,
      publishedAt: now,
      updatedAt: now,
    };

    if (params.syncDraft) {
      for (const d of this.drafts.values()) {
        if (d.pageId === page.id && d.storeScope === params.storeScope) {
          const draftClone = structuredClone(validated.document);
          this.drafts.set(d.id, {
            ...d,
            schemaVersion: validated.document.schemaVersion,
            draftDocument: draftClone,
            rawDocument: draftClone,
            draftRevision: d.draftRevision + 1,
            basePublishedVersionId: restoredVersion.id,
            basePublishedRevision: nextPublishedRevision,
            checksum: validated.checksum,
            lastEditedBy: this.actor.email ?? d.lastEditedBy,
            updatedAt: now,
          });
          break;
        }
      }
    }

    const event: StorePagePublishingEventRecord = {
      id: this.nextId("evt00000"),
      pageId: page.id,
      storeScope: params.storeScope,
      actionType: "rollback",
      publishedVersionId: restoredVersion.id,
      previousVersionId: prevVersionId,
      publishedRevision: nextPublishedRevision,
      draftRevision: null,
      notes,
      actorId: this.actor.userId ?? null,
      createdAt: now,
    };

    this.versions.set(restoredVersion.id, restoredVersion);
    this.pages.set(updatedPage.id, updatedPage);
    this.events.set(event.id, event);

    const { rawDocument: _, ...cleanVersion } = restoredVersion;
    return {
      page: structuredClone(updatedPage),
      publishedVersion: structuredClone(cleanVersion),
      restoredFromVersionId: targetVersion.id,
      previousVersionId: prevVersionId,
      event: structuredClone(event),
    };
  }

  async listPublishingEvents(
    pageId: string,
    limit: number = 25,
    storeScope: string = DEFAULT_STORE_SCOPE,
  ): Promise<StorePagePublishingEventRecord[]> {
    this.ensureHealthy();
    validateStoreScope(storeScope);
    this.requireAdmin();

    const boundedLimit = Math.min(Math.max(1, limit), 100);
    return Array.from(this.events.values())
      .filter((e) => e.pageId === pageId && e.storeScope === storeScope)
      .sort((a, b) => b.publishedRevision - a.publishedRevision)
      .slice(0, boundedLimit)
      .map((e) => structuredClone(e));
  }
}
