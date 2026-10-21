import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_PAGE_DOCUMENT } from "../homepage/default-homepage-document";
import {
  archivePageDraft,
  createInitialHomepageDraft,
  getAdminDraft,
  InMemoryTransactionalPersistenceAdapter,
  savePageDraft,
} from "../persistence/index";
import { findNodeById, updateNodeById } from "../utils/node-tree";

describe("Prompt 8 — Optimistic Concurrency & Editing Conflict Detection", () => {
  it("1. prevents stale multi-admin writes from overwriting newer draft revisions", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-a",
      email: "admin-a@store.local",
    });

    // Initial draft created at revision 1
    const created = await createInitialHomepageDraft({ adapter });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.draft.draftRevision).toBe(1);

    // Both Admin A and Admin B load draft revision 1
    const adminADoc = updateNodeById(
      created.draft.draftDocument,
      "home-featured-products",
      (n) => ({ ...n, name: "Admin A Featured Header" }),
    );
    const adminBDoc = updateNodeById(
      created.draft.draftDocument,
      "home-featured-products",
      (n) => ({ ...n, name: "Admin B Stale Overwrite" }),
    );

    // Admin A saves first with expectedDraftRevision: 1 -> succeeds as revision 2
    const saveA = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Storefront Homepage",
        document: adminADoc,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(saveA.ok).toBe(true);
    if (!saveA.ok) return;
    expect(saveA.draft.draftRevision).toBe(2);

    // Admin B attempts to save with stale expectedDraftRevision: 1 -> rejected with DRAFT_REVISION_CONFLICT
    adapter.setActor({
      role: "admin",
      userId: "admin-b",
      email: "admin-b@store.local",
    });
    const saveB = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Storefront Homepage",
        document: adminBDoc,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(saveB.ok).toBe(false);
    if (!saveB.ok) {
      expect(saveB.error.code).toBe("DRAFT_REVISION_CONFLICT");
      expect(saveB.error.conflict).toEqual({
        conflictKind: "draft_revision",
        expectedRevision: 1,
        actualRevision: 2,
      });
    }

    // Verify Admin A's work at revision 2 is completely preserved
    const currentDraft = await getAdminDraft(created.page.id, { adapter });
    expect(currentDraft?.draftRevision).toBe(2);
    const featuredNode = currentDraft
      ? findNodeById(currentDraft.draftDocument, "home-featured-products")
      : null;
    expect(featuredNode?.name).toBe("Admin A Featured Header");
  });

  it("2. rejects creating a draft with non-zero expectedDraftRevision when no draft exists", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter();
    const res = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Homepage",
        document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        expectedDraftRevision: 5,
      },
      { adapter },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("DRAFT_REVISION_CONFLICT");
      expect(res.error.conflict?.expectedRevision).toBe(5);
      expect(res.error.conflict?.actualRevision).toBe(0);
    }
  });

  it("3. rejects archiving a draft with a stale revision and recovers cleanly after transient network/storage errors", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter();
    const created = await createInitialHomepageDraft({ adapter });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(archivePageDraft(created.page.id, 99, { adapter })).rejects.toMatchObject({
      code: "DRAFT_REVISION_CONFLICT",
    });

    // Simulate transient commit failure during save -> revision remains 1, retry succeeds as revision 2
    adapter.setSimulateCommitFailure(true);
    const failedSave = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Homepage",
        document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(failedSave.ok).toBe(false);
    if (!failedSave.ok) {
      expect(failedSave.error.code).toBe("STORAGE_FAILURE");
      expect(failedSave.error.retryable).toBe(true);
    }

    adapter.setSimulateCommitFailure(false);
    const retriedSave = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Homepage",
        document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(retriedSave.ok).toBe(true);
    if (retriedSave.ok) {
      expect(retriedSave.draft.draftRevision).toBe(2);
    }
  });
});
