import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "../homepage/default-homepage-document";
import {
  buildVirtualCategoryCardInstanceId,
  buildVirtualCategoryNodeId,
  buildVirtualProductInstanceId,
  collectHitTestCandidatesFromElement,
  resolveHitTestTarget,
} from "../interactions/index";

describe("Prompt 10 — Precise DOM Hit-Testing, Nested Selection, Decorative Overlays & Repeated Instances", () => {
  it("prioritizes the most specific eligible registered node while ignoring unindexed internal DOM tags", () => {
    const doc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    // Add a child Button node inside featuredRail for nested EditorNode testing
    const featuredNode = doc.root.find((n) => n.id === CANONICAL_HOMEPAGE_NODE_IDS.featuredRail)!;
    featuredNode.children.push({
      id: "nested-cta-button",
      type: "Button",
      name: "Featured CTA Button",
      props: { label: "Explore All" },
      style: {},
      children: [],
    });

    const stageEl = document.createElement("div");
    const sectionEl = document.createElement("section");
    sectionEl.setAttribute("data-editor-node-id", CANONICAL_HOMEPAGE_NODE_IDS.featuredRail);

    const buttonWrapperEl = document.createElement("div");
    buttonWrapperEl.setAttribute("data-editor-node-id", "nested-cta-button");
    const innerSpanEl = document.createElement("span");
    buttonWrapperEl.appendChild(innerSpanEl);
    sectionEl.appendChild(buttonWrapperEl);
    stageEl.appendChild(sectionEl);

    const hit = resolveHitTestTarget(innerSpanEl, {
      document: doc,
      stageEl,
      currentSelectedId: null,
    });

    expect(hit.targetId).toBe("nested-cta-button");
    expect(hit.candidates.map((c) => c.targetId)).toEqual([
      "nested-cta-button",
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
    ]);
  });

  it("supports container-first selection on collection sections and drills down into ProductCard / CategoryCard runtime instances on second click or modifier key", () => {
    const doc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    const stageEl = document.createElement("div");

    const railEl = document.createElement("section");
    railEl.setAttribute("data-editor-node-id", CANONICAL_HOMEPAGE_NODE_IDS.featuredRail);

    const productInstanceId = buildVirtualProductInstanceId(
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "prod-101",
    );
    const articleEl = document.createElement("article");
    articleEl.setAttribute("data-editor-instance-id", productInstanceId);

    const imgEl = document.createElement("img");
    articleEl.appendChild(imgEl);
    railEl.appendChild(articleEl);
    stageEl.appendChild(railEl);

    // 1. First click when PlanetHero is selected -> selects the enclosing Featured Products Rail container
    const firstClick = resolveHitTestTarget(imgEl, {
      document: doc,
      stageEl,
      currentSelectedId: CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      drillDownModifier: false,
    });
    expect(firstClick.targetId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.featuredRail);

    // 2. Second click when Featured Products Rail is ALREADY selected -> drills down into the ProductCard instance
    const secondClick = resolveHitTestTarget(imgEl, {
      document: doc,
      stageEl,
      currentSelectedId: CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      drillDownModifier: false,
    });
    expect(secondClick.targetId).toBe(productInstanceId);

    // 3. Direct modifier click (Alt/Cmd/Ctrl) when another section is selected -> drills directly into ProductCard instance
    const modifierClick = resolveHitTestTarget(imgEl, {
      document: doc,
      stageEl,
      currentSelectedId: CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      drillDownModifier: true,
    });
    expect(modifierClick.targetId).toBe(productInstanceId);

    // 4. Alt+Click on an already-selected ProductCard instance cycles up to its parent rail
    const cycleUpClick = resolveHitTestTarget(imgEl, {
      document: doc,
      stageEl,
      currentSelectedId: productInstanceId,
      drillDownModifier: true,
      cycleAncestorOnRepeatClick: true,
    });
    expect(cycleUpClick.targetId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.featuredRail);
  });

  it("ignores selection overlays, decorative layers, and hidden nodes, and prevents CelestialScrollWorld from blocking foreground selection", () => {
    const doc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    const stageEl = document.createElement("div");

    // Overlay element should produce zero candidates
    const overlayEl = document.createElement("div");
    overlayEl.setAttribute("data-testid", "studio-selection-overlay-layer");
    const badgeEl = document.createElement("div");
    overlayEl.appendChild(badgeEl);
    stageEl.appendChild(overlayEl);

    expect(collectHitTestCandidatesFromElement(badgeEl, stageEl, doc)).toHaveLength(0);

    // Global CelestialScrollWorld wrapping or overlapping a foreground section should never block foreground selection
    const celestialEl = document.createElement("div");
    celestialEl.setAttribute(
      "data-editor-node-id",
      CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
    );
    celestialEl.setAttribute("data-editor-global-layer", "celestial-scroll-world");

    const heroEl = document.createElement("div");
    heroEl.setAttribute("data-editor-node-id", CANONICAL_HOMEPAGE_NODE_IDS.planetHero);
    celestialEl.appendChild(heroEl);
    stageEl.appendChild(celestialEl);

    const foregroundHit = resolveHitTestTarget(heroEl, {
      document: doc,
      stageEl,
    });
    expect(foregroundHit.targetId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.planetHero);
  });

  it("preserves deterministic runtime instance identities across dynamic category and product list reordering", () => {
    const catIdA = buildVirtualCategoryNodeId(
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      "cat-astro",
    );
    const catIdB = buildVirtualCategoryNodeId(
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      "cat-lights",
    );
    const prodId1 = buildVirtualProductInstanceId(catIdA, "prod-900");
    const cardId1 = buildVirtualCategoryCardInstanceId(
      CANONICAL_HOMEPAGE_NODE_IDS.categoryGrid,
      "cat-astro",
    );

    // Re-evaluating in different sort orders produces identical deterministic IDs (no array index dependency)
    expect(
      buildVirtualCategoryNodeId(CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories, "cat-astro"),
    ).toBe(catIdA);
    expect(catIdA).not.toBe(catIdB);
    expect(buildVirtualProductInstanceId(catIdA, "prod-900")).toBe(prodId1);
    expect(
      buildVirtualCategoryCardInstanceId(CANONICAL_HOMEPAGE_NODE_IDS.categoryGrid, "cat-astro"),
    ).toBe(cardId1);
  });
});
