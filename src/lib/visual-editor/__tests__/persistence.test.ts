import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_PAGE_DOCUMENT } from "../homepage/default-homepage-document";
import {
  archivePageDraft,
  createInitialHomepageDraft,
  getAdminDraft,
  getAdminDraftMetadata,
  getPublishedHomepageDocument,
  getPublishedPage,
  getStorePageByKey,
  InMemoryTransactionalPersistenceAdapter,
  resetDraftToPublishedVersion,
  savePageDraft,
} from "../persistence/index";
import { publishPageDraft } from "../publishing/index";
import { findNodeById, updateNodeById } from "../utils/node-tree";

describe("Prompt 8 — Database Migration & Draft Persistence Foundation", () => {
  it("1. verifies 0010_storefront_page_persistence.sql migration structure, composite FKs, RLS policies, and journal metadata", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "drizzle/migrations/0010_storefront_page_persistence.sql",
    );
    const journalPath = path.resolve(process.cwd(), "drizzle/migrations/meta/_journal.json");
    const snapshotPath = path.resolve(process.cwd(), "drizzle/migrations/meta/0010_snapshot.json");

    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(journalPath)).toBe(true);
    expect(fs.existsSync(snapshotPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf8");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

    // Verify journal registration
    const entry10 = journal.entries.find((e: { idx: number }) => e.idx === 10);
    expect(entry10).toBeDefined();
    expect(entry10.tag).toBe("0010_storefront_page_persistence");
    expect(snapshot.prevId).toBe("7b8ad64f-641a-4d11-aeed-93069ed3184c");

    // Verify all 4 normalized tables exist
    expect(sql).toContain("CREATE TABLE public.store_pages");
    expect(sql).toContain("CREATE TABLE public.store_page_versions");
    expect(sql).toContain("CREATE TABLE public.store_page_drafts");
    expect(sql).toContain("CREATE TABLE public.store_page_publishing_events");

    // Verify composite foreign key guaranteeing published_version_id belongs to the same page
    expect(sql).toContain("CONSTRAINT store_pages_published_version_same_page_fkey");
    expect(sql).toContain("FOREIGN KEY (published_version_id, id)");
    expect(sql).toContain("REFERENCES public.store_page_versions(id, page_id)");

    // Verify immutability triggers on versions and publishing events
    expect(sql).toContain("CREATE TRIGGER store_page_versions_immutable");
    expect(sql).toContain("CREATE TRIGGER store_page_publishing_events_immutable");

    // Verify strict REVOKE from PUBLIC and anon on base tables + RLS enablement
    expect(sql).toContain("REVOKE ALL ON public.store_pages FROM PUBLIC, anon;");
    expect(sql).toContain("REVOKE ALL ON public.store_page_drafts FROM PUBLIC, anon;");
    expect(sql).toContain("REVOKE ALL ON public.store_page_versions FROM PUBLIC, anon;");
    expect(sql).toContain("REVOKE ALL ON public.store_page_publishing_events FROM PUBLIC, anon;");
    expect(sql).toContain("ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.store_page_drafts ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.store_page_versions ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain(
      "ALTER TABLE public.store_page_publishing_events ENABLE ROW LEVEL SECURITY;",
    );

    // Verify controlled public read RPC and admin-only mutation RPCs
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_published_store_page");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.save_store_page_draft");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.publish_store_page_draft");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.restore_store_page_version");
  });

  it("2. creates, loads, updates, archives, and resets drafts with lossless schema serialization", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-uuid-1",
      email: "admin@ourvisibleuniverse.com",
    });

    // Create initial homepage draft
    const initialResult = await createInitialHomepageDraft({ adapter });
    expect(initialResult.ok).toBe(true);
    if (!initialResult.ok) return;

    expect(initialResult.draft.draftRevision).toBe(1);
    expect(initialResult.draft.state).toBe("active");
    expect(initialResult.draft.schemaVersion).toBe("1.0.0");
    expect(initialResult.page.slug).toBe("/");
    expect(initialResult.page.publishedVersionId).toBeNull();
    expect(initialResult.page.publishedRevision).toBe(0);

    // Modify responsive override & shape properties and save revision 2
    const updatedDoc = updateNodeById(
      initialResult.draft.draftDocument,
      "home-featured-products",
      (node) => ({
        ...node,
        name: "Curated Cosmic Picks",
        style: {
          ...node.style,
          shape: {
            shapeType: "rounded-rectangle",
            cornerRadius: { mode: "uniform", unit: "px", uniform: 24 },
          },
        },
        responsive: {
          ...node.responsive,
          mobile: {
            ...node.responsive?.mobile,
            geometry: {
              padding: { top: 16, right: 16, bottom: 16, left: 16, unit: "px" },
            },
          },
        },
      }),
    );

    const saveRev2 = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Storefront Homepage",
        document: updatedDoc,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(saveRev2.ok).toBe(true);
    if (!saveRev2.ok) return;
    expect(saveRev2.draft.draftRevision).toBe(2);

    // Load draft and verify lossless round-trip of responsive overrides, shape, and bindings
    const loadedDraft = await getAdminDraft(saveRev2.page.id, { adapter });
    expect(loadedDraft).not.toBeNull();
    expect(loadedDraft?.draftRevision).toBe(2);
    const featuredNode = loadedDraft
      ? findNodeById(loadedDraft.draftDocument, "home-featured-products")
      : null;
    expect(featuredNode?.name).toBe("Curated Cosmic Picks");
    expect(featuredNode?.style.shape?.cornerRadius?.uniform).toBe(24);
    expect(featuredNode?.responsive?.mobile?.geometry?.padding?.top).toBe(16);
    expect(featuredNode?.binding?.kind).toBe("product_collection");

    // Archive draft
    const archivedMeta = await archivePageDraft(saveRev2.page.id, 2, { adapter });
    expect(archivedMeta.state).toBe("archived");
    expect(archivedMeta.draftRevision).toBe(3);

    // Reset draft to canonical / published state
    const resetResult = await resetDraftToPublishedVersion(saveRev2.page.id, 3, {
      adapter,
    });
    expect(resetResult.ok).toBe(true);
    if (!resetResult.ok) return;
    expect(resetResult.draft.draftRevision).toBe(4);
    expect(resetResult.draft.state).toBe("active");
    const restoredFeatured = findNodeById(
      resetResult.draft.draftDocument,
      "home-featured-products",
    );
    expect(restoredFeatured?.name).toBe("Featured Products Rail");
  });

  it("3. preserves safe canonical homepage fallback when no page is persisted, unpublished, offline, or corrupted", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@store.local",
    });

    // Case A: Empty database -> falls back to DEFAULT_HOMEPAGE_PAGE_DOCUMENT
    const emptyRead = await getPublishedPage("/", { adapter });
    expect(emptyRead.source).toBe("canonical_fallback");
    expect(emptyRead.fallbackReason).toBe("not_published");
    expect(emptyRead.document).toBe(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);

    // Case B: Draft exists, but never published -> public still gets canonical fallback, never the draft
    const draftRes = await createInitialHomepageDraft({ adapter });
    expect(draftRes.ok).toBe(true);
    const unpublishedRead = await getPublishedPage("/", { adapter });
    expect(unpublishedRead.source).toBe("canonical_fallback");
    expect(unpublishedRead.fallbackReason).toBe("not_published");
    expect(unpublishedRead.publishedSnapshot).toBeNull();

    // Case C: Publish draft -> public now receives published snapshot without private fields
    if (draftRes.ok) {
      const pubRes = await publishPageDraft(
        {
          pageId: draftRes.page.id,
          expectedDraftRevision: draftRes.draft.draftRevision,
          releaseNotes: "Initial homepage release",
        },
        { adapter },
      );
      expect(pubRes.ok).toBe(true);
    }

    const publishedRead = await getPublishedPage("/", { adapter });
    expect(publishedRead.source).toBe("database_published");
    expect(publishedRead.publishedSnapshot?.versionNumber).toBe(1);
    expect(publishedRead.publishedSnapshot?.publishedRevision).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(publishedRead.publishedSnapshot, "createdBy")).toBe(
      false,
    );
    expect(
      Object.prototype.hasOwnProperty.call(publishedRead.publishedSnapshot, "releaseNotes"),
    ).toBe(false);

    // Case D: Database temporarily unavailable -> falls back to DEFAULT_HOMEPAGE_PAGE_DOCUMENT
    adapter.setSimulateDatabaseDown(true);
    const offlineRead = await getPublishedPage("/", { adapter });
    expect(offlineRead.source).toBe("canonical_fallback");
    expect(offlineRead.fallbackReason).toBe("database_unavailable");
    expect(offlineRead.document).toBe(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    adapter.setSimulateDatabaseDown(false);

    // Case E: Corrupted / unsupported published document -> falls back to DEFAULT_HOMEPAGE_PAGE_DOCUMENT
    const corruptAdapter = new InMemoryTransactionalPersistenceAdapter();
    corruptAdapter.seedRawCorruptedPublishedPage({
      pageId: "page-corrupt-1",
      pageKey: "home",
      slug: "/",
      schemaVersion: "9.9.9",
      corruptedDocument: { schemaVersion: "9.9.9", invalid: true },
    });
    const corruptRead = await getPublishedPage("/", { adapter: corruptAdapter });
    expect(corruptRead.source).toBe("canonical_fallback");
    expect(corruptRead.fallbackReason).toBe("incompatible_schema");
    const safeDoc = await getPublishedHomepageDocument({ adapter: corruptAdapter });
    expect(safeDoc).toBe(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);

    // Verify getStorePageByKey & getAdminDraftMetadata
    const pageRecord = await getStorePageByKey("home", { adapter });
    expect(pageRecord?.publishedRevision).toBe(1);
    if (pageRecord) {
      const meta = await getAdminDraftMetadata(pageRecord.id, { adapter });
      expect(meta?.currentPublishedRevision).toBe(1);
      expect(meta?.isBasedOnOutdatedPublishedVersion).toBe(false);
    }
  });
});
