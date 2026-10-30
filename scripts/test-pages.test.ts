import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { database, closeDatabase } from "../src/backend/db.server";
import { MariaDbPageAdapter } from "../src/backend/pages.server";
import { createDefaultHomepageDocument } from "../src/lib/visual-editor/homepage/default-homepage-document";
import { updateNodeById } from "../src/lib/visual-editor/utils/node-tree";
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert.equal(process.env.DB_PORT, "3307");
assert.equal(process.env.DB_NAME, "ovu_store");
test("MariaDB editor isolates drafts, locks revisions, authorizes publishing and restores immutable versions atomically", async () => {
  const id = randomUUID(),
    key = "qa-" + randomUUID(),
    key2 = "qa-" + randomUUID();
  const actor = { id, email: id + "@example.test", emailVerified: true },
    adapter = new MariaDbPageAdapter(actor),
    guest = new MariaDbPageAdapter();
  const pageIds: string[] = [];
  try {
    await database().execute(
      "INSERT INTO auth_user(id,name,email,emailVerified) VALUES(?,?,?,true)",
      [id, "Synthetic editor fixture", actor.email],
    );
    await assert.rejects(() => adapter.getPageByKey(key));
    await database().execute("INSERT INTO app_roles(user_id,role) VALUES(?,'admin')", [id]);
    const canonical = createDefaultHomepageDocument();
    const document = {
      ...canonical,
      metadata: { ...canonical.metadata, authorEmail: actor.email },
    };
    const input = {
      pageKey: key,
      pageType: "home" as const,
      slug: "/" + key,
      title: "Synthetic draft",
      schemaVersion: document.schemaVersion,
      draftDocument: document,
      checksum: "ignored-client-checksum",
      expectedDraftRevision: 0,
      storeScope: "default",
    };
    const saved = await adapter.saveDraftAtomic(input);
    pageIds.push(saved.page.id);
    assert.equal(saved.draft.draftRevision, 1);
    assert.notEqual(saved.draft.checksum, input.checksum);
    assert.equal(await guest.getPublishedPageBySlug(input.slug), null);
    await assert.rejects(() => guest.getDraftByPageId(saved.page.id));
    await assert.rejects(
      () => adapter.saveDraftAtomic(input),
      (e: any) => e.code === "DRAFT_REVISION_CONFLICT",
    );
    const publish = {
      pageId: saved.page.id,
      expectedDraftRevision: 1,
      expectedPublishedRevision: 0,
      releaseNotes: "Synthetic release",
      storeScope: "default",
    };
    const outcomes = await Promise.allSettled([
      adapter.publishDraftAtomic(publish),
      adapter.publishDraftAtomic(publish),
    ]);
    assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
    const released = outcomes.find((r) => r.status === "fulfilled")!;
    assert.equal(released.status, "fulfilled");
    if (released.status !== "fulfilled") throw Error("No release");
    const first = released.value;
    const visible = await guest.getPublishedPageBySlug(input.slug);
    assert.ok(visible);
    assert.equal(visible.versionId, first.publishedVersion.id);
    assert.equal("createdBy" in visible, false);
    assert.equal("releaseNotes" in visible, false);
    assert.equal("authorEmail" in visible.documentSnapshot.metadata, false);
    assert.equal(
      (await adapter.getVersionById(saved.page.id, first.publishedVersion.id))!.documentSnapshot
        .metadata.authorEmail,
      actor.email,
    );
    const edited = updateNodeById(document, "home-planet-hero", (n) => ({
      ...n,
      name: "Synthetic edited hero",
    }));
    assert.notDeepEqual(edited, document);
    const secondDraft = await adapter.saveDraftAtomic({
      ...input,
      expectedDraftRevision: 1,
      draftDocument: edited,
    });
    assert.equal(secondDraft.draft.draftRevision, 2);
    assert.equal(
      (await guest.getPublishedPageBySlug(input.slug))!.versionId,
      first.publishedVersion.id,
    );
    const second = await adapter.publishDraftAtomic({
      ...publish,
      expectedDraftRevision: 2,
      expectedPublishedRevision: 1,
    });
    assert.equal(second.page.publishedRevision, 2);
    const restored = await adapter.restoreVersionAtomic({
      pageId: saved.page.id,
      targetVersionId: first.publishedVersion.id,
      expectedPublishedRevision: 2,
      syncDraft: true,
      releaseNotes: null,
      storeScope: "default",
    });
    assert.equal(restored.page.publishedRevision, 3);
    assert.notEqual(restored.publishedVersion.id, first.publishedVersion.id);
    assert.deepEqual(
      restored.publishedVersion.documentSnapshot,
      first.publishedVersion.documentSnapshot,
    );
    assert.equal((await adapter.getDraftByPageId(saved.page.id))!.draftRevision, 3);
    assert.equal(
      (
        await adapter.listVersionMetadata({
          pageId: saved.page.id,
          limit: 20,
          offset: 0,
          storeScope: "default",
        })
      ).total,
      3,
    );
    assert.equal((await adapter.listPublishingEvents(saved.page.id)).length, 3);
    const other = await adapter.saveDraftAtomic({ ...input, pageKey: key2, slug: "/" + key2 });
    pageIds.push(other.page.id);
    await assert.rejects(
      () =>
        adapter.restoreVersionAtomic({
          pageId: other.page.id,
          targetVersionId: first.publishedVersion.id,
          expectedPublishedRevision: 0,
          syncDraft: false,
          releaseNotes: null,
          storeScope: "default",
        }),
      (e: any) => e.code === "INVALID_PAGE_VERSION_RELATIONSHIP",
    );
    await assert.rejects(() =>
      adapter.saveDraftAtomic({
        ...input,
        expectedDraftRevision: 3,
        draftDocument: { ...document, root: null },
      }),
    );
    assert.equal((await adapter.getDraftByPageId(saved.page.id))!.draftRevision, 3);
    await database().execute("DELETE FROM app_roles WHERE user_id=?", [id]);
    await assert.rejects(() =>
      adapter.publishDraftAtomic({
        ...publish,
        expectedDraftRevision: 3,
        expectedPublishedRevision: 3,
      }),
    );
    await assert.rejects(() => adapter.getVersionById(saved.page.id, first.publishedVersion.id));
    assert.equal((await guest.getPublishedPageBySlug(input.slug))!.publishedRevision, 3);
  } finally {
    for (const pageId of pageIds) {
      await database().execute("UPDATE store_pages SET published_version_id=NULL WHERE id=?", [
        pageId,
      ]);
      await database().execute("DELETE FROM store_page_publishing_events WHERE page_id=?", [
        pageId,
      ]);
      await database().execute("DELETE FROM store_page_drafts WHERE page_id=?", [pageId]);
      await database().execute("DELETE FROM store_page_versions WHERE page_id=?", [pageId]);
      await database().execute("DELETE FROM store_pages WHERE id=?", [pageId]);
    }
    await database().execute("DELETE FROM auth_user WHERE id=?", [id]);
    await closeDatabase();
  }
});
