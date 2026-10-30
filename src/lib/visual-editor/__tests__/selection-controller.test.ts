import { describe, expect, it } from "vitest";
import type { Category, ProductCardData } from "@/lib/store";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "../homepage/default-homepage-document";
import {
  buildSelectionBreadcrumbChain,
  buildVirtualCategoryCardInstanceId,
  buildVirtualCategoryNodeId,
  buildVirtualProductInstanceId,
  clearStudioSelection,
  createInitialSelectionControllerState,
  getDocumentNodeLookupIndex,
  GLOBAL_CHROME_FOOTER_ID,
  GLOBAL_CHROME_HEADER_ID,
  hoverStudioTarget,
  isEditableInputTarget,
  isTargetValidInDocument,
  parseStudioNodeIdentity,
  resolveFirstChildTargetId,
  resolveParentTargetId,
  resolveStudioKeyboardSelectionAction,
  restorePreviousStudioSelection,
  selectFirstChildStudioTarget,
  selectParentStudioTarget,
  selectStudioTarget,
  syncSelectionWithDocument,
} from "../interactions/index";
import type { EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";

const TEST_CATEGORIES: Category[] = [
  {
    id: "cat-optics",
    name: "Telescopes & Optics",
    slug: "telescopes-optics",
    description: "Deep sky instruments",
    image_url: null,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00Z",
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "cat-lighting",
    name: "Cosmic Lighting",
    slug: "cosmic-lighting",
    description: "Nebula lamps",
    image_url: null,
    sort_order: 2,
    created_at: "2026-01-01T00:00:00Z",
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const TEST_PRODUCTS: ProductCardData[] = [
  {
    id: "prod-alpha",
    name: "Orion Nebula Projector",
    slug: "orion-nebula-projector",
    short_description: "Laser starfield projector",
    price: 129,
    currency: "USD",
    affiliate_url: "https://example.com/buy/orion",
    featured: true,
    category_id: "cat-lighting",
    category_ids: ["cat-lighting"],
    category: { name: "Cosmic Lighting", slug: "cosmic-lighting" },
    image: "/img/orion.jpg",
    imageAlt: "Orion Nebula Projector",
    images: [],
    created_at: "2026-01-01T00:00:00Z",
  },
];

function createSyntheticDocumentWithNodeCount(targetCount: number): PageDocument {
  const baseDoc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
  const containerChildren: EditorNode[] = [];

  for (let i = 0; i < targetCount; i++) {
    containerChildren.push({
      id: `synthetic-node-${i}`,
      type: i % 2 === 0 ? "Heading" : "Text",
      name: `Synthetic Block ${i}`,
      props: { text: `Block ${i}` },
      style: {},
      children: [],
    });
  }

  baseDoc.root.push({
    id: "synthetic-parent-section",
    type: "Section",
    name: "Synthetic Large Section",
    props: {},
    style: {},
    children: containerChildren,
  });

  return baseDoc;
}

describe("Prompt 10 — Central Selection Controller, Runtime Identity, Hierarchy & Scale Benchmarks", () => {
  it("parses document nodes, global chrome, virtual category sections, and runtime product/category-card instances in O(1) time", () => {
    const docIdentity = parseStudioNodeIdentity(CANONICAL_HOMEPAGE_NODE_IDS.planetHero);
    expect(docIdentity).toEqual({
      rawId: CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      kind: "document_node",
      documentNodeId: CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      isRuntimeInstance: false,
    });

    const headerIdentity = parseStudioNodeIdentity(GLOBAL_CHROME_HEADER_ID);
    expect(headerIdentity?.kind).toBe("global_chrome");
    expect(headerIdentity?.globalChromeType).toBe("StoreHeader");

    const catSectionId = buildVirtualCategoryNodeId(
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      "cat-optics",
    );
    const catIdentity = parseStudioNodeIdentity(catSectionId);
    expect(catIdentity).toEqual({
      rawId: catSectionId,
      kind: "virtual_category",
      documentNodeId: CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      isRuntimeInstance: true,
      virtualCategoryId: "cat-optics",
    });

    const nestedProductId = buildVirtualProductInstanceId(catSectionId, "prod-alpha");
    const nestedProdIdentity = parseStudioNodeIdentity(nestedProductId);
    expect(nestedProdIdentity).toEqual({
      rawId: nestedProductId,
      kind: "virtual_product",
      documentNodeId: CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      isRuntimeInstance: true,
      virtualCategoryId: "cat-optics",
      virtualProductId: "prod-alpha",
    });

    const catCardId = buildVirtualCategoryCardInstanceId("node-category-grid", "cat-lighting");
    const catCardIdentity = parseStudioNodeIdentity(catCardId);
    expect(catCardIdentity).toEqual({
      rawId: catCardId,
      kind: "virtual_category_card",
      documentNodeId: "node-category-grid",
      isRuntimeInstance: true,
      virtualCategoryId: "cat-lighting",
    });
  });

  it("handles selecting registered nodes, nested nodes, parents, children, clearing, and restoring across render modes", () => {
    const doc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    let state = createInitialSelectionControllerState(CANONICAL_HOMEPAGE_NODE_IDS.planetHero);

    // 1. Select a registered node
    state = selectStudioTarget(
      state,
      doc,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "canvas_click",
      "editor",
    );
    expect(state.selectedNodeId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.featuredRail);
    expect(state.previousSelectedNodeId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.planetHero);
    expect(state.selectionSource).toBe("canvas_click");

    // 2. Select a nested runtime product instance inside a dynamic category section
    const catSectionId = buildVirtualCategoryNodeId(
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      "cat-optics",
    );
    const prodInstanceId = buildVirtualProductInstanceId(catSectionId, "prod-alpha");

    state = selectStudioTarget(state, doc, prodInstanceId, "canvas_click", "editor");
    expect(state.selectedNodeId).toBe(prodInstanceId);

    // 3. Navigate up to parent (from ProductCard instance -> virtual category section -> parent Section template)
    expect(resolveParentTargetId(doc, prodInstanceId)).toBe(catSectionId);
    state = selectParentStudioTarget(state, doc, "keyboard", "editor");
    expect(state.selectedNodeId).toBe(catSectionId);

    expect(resolveParentTargetId(doc, catSectionId)).toBe(
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
    );
    state = selectParentStudioTarget(state, doc, "breadcrumb", "editor");
    expect(state.selectedNodeId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories);
    expect(state.selectionSource).toBe("breadcrumb");

    // 4. Navigate down to first child virtual category instance
    expect(
      resolveFirstChildTargetId(
        doc,
        CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
        TEST_CATEGORIES,
      ),
    ).toBe(catSectionId);
    state = selectFirstChildStudioTarget(state, doc, TEST_CATEGORIES, "keyboard", "editor");
    expect(state.selectedNodeId).toBe(catSectionId);

    // 5. Clear selection and restore previous selection
    state = clearStudioSelection(state, "keyboard");
    expect(state.selectedNodeId).toBeNull();
    expect(state.previousSelectedNodeId).toBe(catSectionId);

    state = restorePreviousStudioSelection(state, doc);
    expect(state.selectedNodeId).toBe(catSectionId);
    expect(state.selectionSource).toBe("mode_restore");

    // 6. Rejects unknown/missing node IDs without corrupting active selection
    const unchanged = selectStudioTarget(state, doc, "non-existent-node-999", "canvas_click");
    expect(unchanged.selectedNodeId).toBe(catSectionId);
    expect(isTargetValidInDocument(doc, "non-existent-node-999")).toBe(false);
    expect(isTargetValidInDocument(doc, GLOBAL_CHROME_FOOTER_ID)).toBe(true);

    // 7. Switching to preview mode disables hover & new canvas selection
    state = hoverStudioTarget(state, doc, CANONICAL_HOMEPAGE_NODE_IDS.planetHero, "editor");
    expect(state.hoveredNodeId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.planetHero);

    state = syncSelectionWithDocument(state, doc, "preview");
    expect(state.hoveredNodeId).toBeNull();
    expect(state.interactionMode).toBe("previewing");

    const blockedInPreview = selectStudioTarget(
      state,
      doc,
      CANONICAL_HOMEPAGE_NODE_IDS.instagramSection,
      "canvas_click",
      "preview",
    );
    expect(blockedInPreview.selectedNodeId).toBe(catSectionId);
  });

  it("builds complete parent-to-child breadcrumb chains for nested document nodes and runtime instances", () => {
    const doc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    const catSectionId = buildVirtualCategoryNodeId(
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      "cat-lighting",
    );
    const prodInstanceId = buildVirtualProductInstanceId(catSectionId, "prod-alpha");

    const breadcrumbs = buildSelectionBreadcrumbChain(
      doc,
      prodInstanceId,
      TEST_CATEGORIES,
      TEST_PRODUCTS,
    );

    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[0].id).toBe(CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories);
    expect(breadcrumbs[1].id).toBe(catSectionId);
    expect(breadcrumbs[1].label).toBe("Cosmic Lighting Sector");
    expect(breadcrumbs[2].id).toBe(prodInstanceId);
    expect(breadcrumbs[2].label).toBe("Product Card (Orion Nebula Projector)");
  });

  it("resolves keyboard selection shortcuts while suppressing shortcuts inside text inputs", () => {
    const doc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    const catSectionId = buildVirtualCategoryNodeId(
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      "cat-optics",
    );

    const inputEl = document.createElement("input");
    const divEl = document.createElement("div");

    expect(isEditableInputTarget(inputEl)).toBe(true);
    expect(isEditableInputTarget(divEl)).toBe(false);

    // Escape inside an input is ignored by the canvas selection controller
    expect(
      resolveStudioKeyboardSelectionAction(
        { key: "Escape", target: inputEl },
        doc,
        catSectionId,
        TEST_CATEGORIES,
      ),
    ).toEqual({ type: "none" });

    // Escape outside an input clears selection
    expect(
      resolveStudioKeyboardSelectionAction(
        { key: "Escape", target: divEl },
        doc,
        catSectionId,
        TEST_CATEGORIES,
      ),
    ).toEqual({ type: "clear_selection" });

    // `[` or `Alt+ArrowUp` selects parent
    expect(
      resolveStudioKeyboardSelectionAction(
        { key: "[", target: divEl },
        doc,
        catSectionId,
        TEST_CATEGORIES,
      ),
    ).toEqual({
      type: "select_target",
      targetId: CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      scrollIntoView: true,
    });

    // `]` or `Alt+ArrowDown` selects first child
    expect(
      resolveStudioKeyboardSelectionAction(
        { key: "]", target: divEl },
        doc,
        CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
        TEST_CATEGORIES,
      ),
    ).toEqual({
      type: "select_target",
      targetId: catSectionId,
      scrollIntoView: true,
    });
  });

  it("benchmarks O(1) node lookup and selection updates across 25, 150, 500, and 1,000 nodes", () => {
    for (const scale of [25, 150, 500, 1000]) {
      const largeDoc = createSyntheticDocumentWithNodeCount(scale);
      const t0 = performance.now();
      const index = getDocumentNodeLookupIndex(largeDoc);
      const buildMs = performance.now() - t0;

      // Second call hits WeakMap cache in O(1)
      const tCache0 = performance.now();
      const cachedIndex = getDocumentNodeLookupIndex(largeDoc);
      const cacheHitMs = performance.now() - tCache0;

      expect(cachedIndex).toBe(index);
      expect(index.nodeById.size).toBeGreaterThanOrEqual(scale);
      expect(buildMs).toBeLessThan(50);
      expect(cacheHitMs).toBeLessThan(1);

      const targetId = `synthetic-node-${scale - 1}`;
      let state = createInitialSelectionControllerState();
      const tSelect0 = performance.now();
      state = selectStudioTarget(state, largeDoc, targetId, "canvas_click", "editor");
      state = hoverStudioTarget(state, largeDoc, targetId, "editor");
      const selectAndHoverMs = performance.now() - tSelect0;

      expect(state.selectedNodeId).toBe(targetId);
      expect(selectAndHoverMs).toBeLessThan(5);
    }
  });
});
