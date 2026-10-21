import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_PAGE_DOCUMENT } from "../homepage/default-homepage-document";
import {
  comparePageVersionMetadata,
  createInitialHomepageDraft,
  getAdminDraftMetadata,
  getAuthorizedPageVersion,
  getPublishedPage,
  InMemoryTransactionalPersistenceAdapter,
  listPagePublishingEvents,
  listPageVersions,
  savePageDraft,
} from "../persistence/index";
import { publishPageDraft, restorePublishedVersion } from "../publishing/index";
import { findNodeById, updateNodeById } from "../utils/node-tree";

describe("Prompt 8 — Immutable Version History, Atomic Publishing & Rollback", () => {
  it("1. publishes atomic immutable versions, isolates subsequent draft edits, and enforces version immutability", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@store.local",
    });

    const draft1 = await createInitialHomepageDraft({ adapter });
    expect(draft1.ok).toBe(true);
    if (!draft1.ok) return;

    // Publish version 1
    let invalidatedSlug: string | null = null;
    const pub1 = await publishPageDraft(
      {
        pageId: draft1.page.id,
        expectedDraftRevision: 1,
        releaseNotes: "Release v1",
      },
      {
        adapter,
        onCacheInvalidate: ({ slug }) => {
          invalidatedSlug = slug;
        },
      },
    );
    expect(pub1.ok).toBe(true);
    if (!pub1.ok) return;
    expect(invalidatedSlug).toBe("/");
    expect(pub1.publishedVersion.versionNumber).toBe(1);
    expect(pub1.page.publishedRevision).toBe(1);
    expect(pub1.previousVersionId).toBeNull();

    // Saving a new draft revision (rev 2) must NOT alter the currently published page
    const draft2Doc = updateNodeById(draft1.draft.draftDocument, "home-featured-products", (n) => ({
      ...n,
      name: "Unpublished Draft v2 Header",
    }));
    const save2 = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Storefront Homepage",
        document: draft2Doc,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(save2.ok).toBe(true);

    const publicLive = await getPublishedPage("/", { adapter });
    expect(publicLive.source).toBe("database_published");
    expect(findNodeById(publicLive.document, "home-featured-products")?.name).toBe(
      "Featured Products Rail",
    );

    // Attempting to mutate historical version v1 in place is forbidden
    expect(() => adapter.attemptMutateHistoricalVersion(pub1.publishedVersion.id)).toThrow(
      /immutable/i,
    );

    // Publish version 2 from draft revision 2
    const pub2 = await publishPageDraft(
      {
        pageId: draft1.page.id,
        expectedDraftRevision: 2,
        expectedPublishedRevision: 1,
        releaseNotes: "Release v2",
      },
      { adapter },
    );
    expect(pub2.ok).toBe(true);
    if (!pub2.ok) return;
    expect(pub2.publishedVersion.versionNumber).toBe(2);
    expect(pub2.page.publishedRevision).toBe(2);
    expect(pub2.previousVersionId).toBe(pub1.publishedVersion.id);

    // Verify version history listing and metadata comparison
    const history = await listPageVersions({
      pageId: draft1.page.id,
      limit: 10,
      offset: 0,
      adapter,
    });
    expect(history.total).toBe(2);
    expect(history.items[0]?.versionNumber).toBe(2);
    expect(history.items[0]?.isCurrentPublished).toBe(true);
    expect(history.items[1]?.versionNumber).toBe(1);
    expect(history.items[1]?.isCurrentPublished).toBe(false);

    const comparison = await comparePageVersionMetadata(
      draft1.page.id,
      pub1.publishedVersion.id,
      pub2.publishedVersion.id,
      { adapter },
    );
    expect(comparison.versionDelta).toBe(1);
    expect(comparison.checksumChanged).toBe(true);
  });

  it("2. restores a historical version atomically without erasing history and rejects cross-page version IDs", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter();
    const draft1 = await createInitialHomepageDraft({ adapter });
    expect(draft1.ok).toBe(true);
    if (!draft1.ok) return;

    const pub1 = await publishPageDraft(
      {
        pageId: draft1.page.id,
        expectedDraftRevision: 1,
        releaseNotes: "v1 original",
      },
      { adapter },
    );
    expect(pub1.ok).toBe(true);
    if (!pub1.ok) return;

    const modifiedDoc = updateNodeById(
      draft1.draft.draftDocument,
      "home-featured-products",
      (n) => ({ ...n, name: "v2 Temporary Campaign" }),
    );
    await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Storefront Homepage",
        document: modifiedDoc,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    const pub2 = await publishPageDraft(
      {
        pageId: draft1.page.id,
        expectedDraftRevision: 2,
        releaseNotes: "v2 campaign",
      },
      { adapter },
    );
    expect(pub2.ok).toBe(true);
    if (!pub2.ok) return;

    // Restore v1 -> creates v3 referencing restoredFromVersionId = v1.id
    const restoreRes = await restorePublishedVersion(
      {
        pageId: draft1.page.id,
        targetVersionId: pub1.publishedVersion.id,
        expectedPublishedRevision: 2,
        syncDraftToRestoredVersion: true,
        releaseNotes: "Rollback to v1",
      },
      { adapter },
    );
    expect(restoreRes.ok).toBe(true);
    if (!restoreRes.ok) return;

    expect(restoreRes.publishedVersion.versionNumber).toBe(3);
    expect(restoreRes.restoredFromVersionId).toBe(pub1.publishedVersion.id);
    expect(restoreRes.previousVersionId).toBe(pub2.publishedVersion.id);
    expect(restoreRes.page.publishedRevision).toBe(3);

    // Public page now serves the restored v1 content
    const publicRead = await getPublishedPage("/", { adapter });
    expect(findNodeById(publicRead.document, "home-featured-products")?.name).toBe(
      "Featured Products Rail",
    );

    // Historical v1 and v2 are still intact in version history
    const v2Snapshot = await getAuthorizedPageVersion(draft1.page.id, pub2.publishedVersion.id, {
      adapter,
    });
    expect(
      v2Snapshot ? findNodeById(v2Snapshot.documentSnapshot, "home-featured-products")?.name : null,
    ).toBe("v2 Temporary Campaign");

    const events = await listPagePublishingEvents(draft1.page.id, 10, { adapter });
    expect(events).toHaveLength(3);
    expect(events[0]?.actionType).toBe("rollback");
    expect(events[1]?.actionType).toBe("publish");

    // Reject restoring a version from a different page
    const otherDraft = await savePageDraft(
      {
        pageKey: "landing-promo",
        pageType: "landing",
        slug: "/landing-promo",
        title: "Landing Promo",
        document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        expectedDraftRevision: 0,
      },
      { adapter },
    );
    expect(otherDraft.ok).toBe(true);
    if (!otherDraft.ok) return;

    const invalidCrossPageRestore = await restorePublishedVersion(
      {
        pageId: otherDraft.page.id,
        targetVersionId: pub1.publishedVersion.id,
      },
      { adapter },
    );
    expect(invalidCrossPageRestore.ok).toBe(false);
    if (!invalidCrossPageRestore.ok) {
      expect(invalidCrossPageRestore.error.code).toBe("INVALID_PAGE_VERSION_RELATIONSHIP");
    }
  });

  it("3. preserves the previous published version when publishing fails or when all homepage sections are hidden", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter();
    const draft1 = await createInitialHomepageDraft({ adapter });
    expect(draft1.ok).toBe(true);
    if (!draft1.ok) return;

    const pub1 = await publishPageDraft(
      {
        pageId: draft1.page.id,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(pub1.ok).toBe(true);
    if (!pub1.ok) return;

    // Hide all root nodes in draft revision 2
    const allHiddenDoc = {
      ...DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      root: DEFAULT_HOMEPAGE_PAGE_DOCUMENT.root.map((node) => ({
        ...node,
        hidden: true,
      })),
    };

    const save2 = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Homepage",
        document: allHiddenDoc,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(save2.ok).toBe(true);

    // Attempting to publish an all-hidden homepage draft must fail validation
    const failedPub = await publishPageDraft(
      {
        pageId: draft1.page.id,
        expectedDraftRevision: 2,
      },
      { adapter },
    );
    expect(failedPub.ok).toBe(false);
    if (!failedPub.ok) {
      expect(failedPub.error.code).toBe("VALIDATION_FAILED");
    }

    // Live published version remains v1
    const liveRead = await getPublishedPage("/", { adapter });
    expect(liveRead.publishedSnapshot?.versionId).toBe(pub1.publishedVersion.id);

    // Verify draft metadata staleness detection
    const draftMeta = await getAdminDraftMetadata(draft1.page.id, { adapter });
    expect(draftMeta?.draftRevision).toBe(2);
    expect(draftMeta?.currentPublishedRevision).toBe(1);
  });
});
