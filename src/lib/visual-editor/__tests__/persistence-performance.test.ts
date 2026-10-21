import { describe, expect, it } from "vitest";
import { buildSyntheticPageDocument } from "../utils/fixtures";
import {
  getPublishedPage,
  InMemoryTransactionalPersistenceAdapter,
  listPageVersions,
  savePageDraft,
  validateDocumentForPersistence,
} from "../persistence/index";
import { publishPageDraft } from "../publishing/index";

describe("Prompt 8 — Persistence & Validation Performance Benchmarks", () => {
  it("benchmarks validation, draft save, publish, version history listing, and public read across 25, 150, 500, and 1000 nodes", async () => {
    const sizes = [25, 150, 500, 1000] as const;

    for (const nodeCount of sizes) {
      const adapter = new InMemoryTransactionalPersistenceAdapter();
      const doc = buildSyntheticPageDocument(nodeCount);

      // 1. Cold validation + checksum
      const tValStart = performance.now();
      const validated = validateDocumentForPersistence(doc);
      const coldValidationMs = performance.now() - tValStart;

      // 2. Warm cached validation (WeakMap reference hit)
      const tWarmStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        validateDocumentForPersistence(validated.document);
      }
      const warm1000Ms = performance.now() - tWarmStart;

      // 3. Initial draft save
      const tSaveStart = performance.now();
      const saved = await savePageDraft(
        {
          pageKey: `bench-${nodeCount}`,
          pageType: "landing",
          slug: `/bench-${nodeCount}`,
          title: `Benchmark ${nodeCount}`,
          document: doc,
          expectedDraftRevision: 0,
        },
        { adapter },
      );
      const saveMs = performance.now() - tSaveStart;
      expect(saved.ok).toBe(true);
      if (!saved.ok) continue;

      // 4. Atomic publish
      const tPubStart = performance.now();
      const published = await publishPageDraft(
        {
          pageId: saved.page.id,
          expectedDraftRevision: 1,
          releaseNotes: `Benchmark ${nodeCount} nodes`,
        },
        { adapter },
      );
      const publishMs = performance.now() - tPubStart;
      expect(published.ok).toBe(true);

      // 5. Public read
      const tReadStart = performance.now();
      const publicRead = await getPublishedPage(`/bench-${nodeCount}`, { adapter });
      const publicReadMs = performance.now() - tReadStart;
      expect(publicRead.source).toBe("database_published");

      // 6. Version metadata listing
      const tListStart = performance.now();
      const history = await listPageVersions({
        pageId: saved.page.id,
        limit: 20,
        offset: 0,
        adapter,
      });
      const listMs = performance.now() - tListStart;
      expect(history.total).toBe(1);

      // Performance budgets
      expect(coldValidationMs).toBeLessThan(250);
      expect(warm1000Ms).toBeLessThan(15);
      expect(saveMs).toBeLessThan(250);
      expect(publishMs).toBeLessThan(250);
      expect(publicReadMs).toBeLessThan(150);
      expect(listMs).toBeLessThan(50);
    }
  });
});
