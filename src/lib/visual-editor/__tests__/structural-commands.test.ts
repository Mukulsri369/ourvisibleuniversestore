import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  createDefaultHomepageDocument,
} from "../homepage/default-homepage-document";
import { getDocumentNodeLookupIndex } from "../interactions/index";
import type { EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import {
  createCompatibleContainer,
  describeDeletionImpact,
  duplicateNode,
  executeStructuralCommand,
  removeLayerNode,
  renameLayerNode,
  reorderSiblingNode,
  setNodeLock,
  setNodeVisibility,
  unwrapContainer,
  wrapNodeInContainer,
} from "../structure/index";
import {
  updateStudioNodeAppearance,
  updateStudioNodeName,
  updateStudioNodeProp,
  updateStudioNodeSpacing,
  updateStudioNodeVisibility,
} from "../studio/studio-document";
import { collectAllNodeIds } from "../utils/ids";
import { findNodeById } from "../utils/node-tree";

function createSyntheticBenchmarkDocument(targetCount: number): PageDocument {
  const base = createDefaultHomepageDocument();
  const children: EditorNode[] = [];
  const remaining = Math.max(1, targetCount - base.root.length - 1);

  for (let i = 0; i < remaining; i++) {
    children.push({
      id: `bench-node-${i}`,
      type: i % 3 === 0 ? "Heading" : i % 3 === 1 ? "Text" : "Button",
      name: `Bench Item ${i}`,
      props: {
        title: `Heading ${i}`,
        text: `Copy ${i}`,
        label: `Action ${i}`,
      },
      style: {},
      children: [],
    });
  }

  const containerSection: EditorNode = {
    id: "bench-container-section",
    type: "Section",
    name: "Benchmark Section",
    props: { title: "Benchmark Section" },
    style: {},
    children,
  };

  return {
    ...base,
    root: [...base.root, containerSection],
  };
}

describe("Prompt 11 — Structural Commands Engine", () => {
  it("renames a layer cleanly, trims whitespace, rejects empty names, and preserves structural sharing", () => {
    const doc = createDefaultHomepageDocument();
    const untouchedBefore = findNodeById(doc, CANONICAL_HOMEPAGE_NODE_IDS.instagramSection);

    const renamed = renameLayerNode(
      doc,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "  Spotlight Collection  ",
    );
    expect(renamed.ok).toBe(true);
    expect(findNodeById(renamed.document, CANONICAL_HOMEPAGE_NODE_IDS.featuredRail)?.name).toBe(
      "Spotlight Collection",
    );
    // Unrelated sibling node reference is preserved (structural sharing)
    expect(findNodeById(renamed.document, CANONICAL_HOMEPAGE_NODE_IDS.instagramSection)).toBe(
      untouchedBefore,
    );

    const emptyAttempt = renameLayerNode(
      renamed.document,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "   ",
    );
    expect(emptyAttempt.ok).toBe(false);
    expect(emptyAttempt.code).toBe("SCHEMA_VALIDATION_FAILED");
  });

  it("reorders movable root sections while keeping CelestialScrollWorld and PlanetHero pinned at indices 0 and 1", () => {
    const doc = createDefaultHomepageDocument();
    expect(doc.root.map((n) => n.id).slice(0, 4)).toEqual([
      CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
      CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      CANONICAL_HOMEPAGE_NODE_IDS.festivalSection,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
    ]);

    // Attempting to move festivalSection UP into pinned PlanetHero slot is blocked
    const upAtBoundary = reorderSiblingNode(doc, CANONICAL_HOMEPAGE_NODE_IDS.festivalSection, "up");
    expect(upAtBoundary.ok).toBe(false);
    expect(upAtBoundary.code).toBe("PROTECTED_COMPONENT");

    // Moving featuredRail UP swaps it with festivalSection at index 2
    const movedUp = reorderSiblingNode(doc, CANONICAL_HOMEPAGE_NODE_IDS.featuredRail, "up");
    expect(movedUp.ok).toBe(true);
    expect(movedUp.document.root.map((n) => n.id).slice(0, 4)).toEqual([
      CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
      CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      CANONICAL_HOMEPAGE_NODE_IDS.festivalSection,
    ]);

    // Moving featuredRail DOWN restores original order
    const movedDown = reorderSiblingNode(
      movedUp.document,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "down",
    );
    expect(movedDown.ok).toBe(true);
    expect(movedDown.document.root.map((n) => n.id).slice(0, 4)).toEqual([
      CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
      CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      CANONICAL_HOMEPAGE_NODE_IDS.festivalSection,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
    ]);
  });

  it("duplicates a component subtree with fresh unique IDs, inserts immediately after the original, and selects the clone", () => {
    const doc = createDefaultHomepageDocument();
    const wrapRes = wrapNodeInContainer(doc, CANONICAL_HOMEPAGE_NODE_IDS.featuredRail, "Section");
    expect(wrapRes.ok).toBe(true);
    const wrapperId = wrapRes.selectedNodeId!;

    const dupRes = duplicateNode(wrapRes.document, wrapperId);
    expect(dupRes.ok).toBe(true);
    expect(dupRes.selectedNodeId).toBeTruthy();

    const wrapperIdx = dupRes.document.root.findIndex((n) => n.id === wrapperId);
    const cloneIdx = dupRes.document.root.findIndex((n) => n.id === dupRes.selectedNodeId);
    expect(cloneIdx).toBe(wrapperIdx + 1);

    const cloneNode = dupRes.document.root[cloneIdx]!;
    expect(cloneNode.name).toContain("(Copy)");
    expect(cloneNode.children).toHaveLength(1);
    // Child inside cloned container must also have a brand-new unique ID
    expect(cloneNode.children[0]!.id).not.toBe(CANONICAL_HOMEPAGE_NODE_IDS.featuredRail);
    expect(cloneNode.children[0]!.type).toBe("FeaturedCollection");

    // Verify all node IDs across the entire document are unique
    const index = getDocumentNodeLookupIndex(dupRes.document);
    const allIds = collectAllNodeIds(dupRes.document.root);
    const uniqueSet = new Set(allIds);
    expect(uniqueSet.size).toBe(allIds.length);
    expect(uniqueSet.size).toBe(index.nodeById.size);
  });

  it("toggles global and breakpoint-specific visibility while keeping hidden layers in the document tree", () => {
    const doc = createDefaultHomepageDocument();
    const targetId = CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection;

    const hideRes = setNodeVisibility(doc, targetId, false);
    expect(hideRes.ok).toBe(true);
    expect(findNodeById(hideRes.document, targetId)?.hidden).toBe(true);

    const showRes = setNodeVisibility(hideRes.document, targetId, true);
    expect(showRes.ok).toBe(true);
    expect(findNodeById(showRes.document, targetId)?.hidden).toBe(false);

    const mobileHideRes = setNodeVisibility(doc, targetId, false, { breakpoint: "mobile" });
    expect(mobileHideRes.ok).toBe(true);
    const nodeAfterMobileHide = findNodeById(mobileHideRes.document, targetId)!;
    expect(nodeAfterMobileHide.hidden).toBeFalsy();
    expect(nodeAfterMobileHide.responsive?.mobile?.visible).toBe(false);
  });

  it("enforces direct and ancestor lock inheritance across structural commands and Inspector edits", () => {
    const doc = createDefaultHomepageDocument();
    const childId = CANONICAL_HOMEPAGE_NODE_IDS.featuredRail;
    const wrapped = wrapNodeInContainer(doc, childId, "Section");
    expect(wrapped.ok).toBe(true);
    const parentSectionId = wrapped.selectedNodeId!;

    // Lock the parent Section
    const lockedDocRes = setNodeLock(wrapped.document, parentSectionId, true);
    expect(lockedDocRes.ok).toBe(true);
    const lockedDoc = lockedDocRes.document;

    // 1. Direct operations on locked parent fail
    expect(renameLayerNode(lockedDoc, parentSectionId, "New Name").code).toBe("LOCKED_NODE");
    expect(reorderSiblingNode(lockedDoc, parentSectionId, "down").code).toBe("LOCKED_NODE");

    // 2. Operations on descendant child fail with LOCKED_ANCESTOR
    expect(renameLayerNode(lockedDoc, childId, "Child Rename").code).toBe("LOCKED_ANCESTOR");
    expect(duplicateNode(lockedDoc, childId).code).toBe("LOCKED_ANCESTOR");
    expect(setNodeVisibility(lockedDoc, childId, false).code).toBe("LOCKED_ANCESTOR");
    expect(removeLayerNode(lockedDoc, childId).code).toBe("LOCKED_ANCESTOR");

    // 3. Studio Inspector property/style edits on descendant child also fail due to ancestor lock
    expect(updateStudioNodeName(lockedDoc, childId, "New").ok).toBe(false);
    expect(updateStudioNodeVisibility(lockedDoc, childId, false).ok).toBe(false);
    expect(updateStudioNodeProp(lockedDoc, childId, "title", "Edited").ok).toBe(false);
    expect(
      updateStudioNodeSpacing(lockedDoc, childId, "padding", {
        top: 16,
        right: 16,
        bottom: 16,
        left: 16,
        unit: "px",
      }).ok,
    ).toBe(false);
    expect(updateStudioNodeAppearance(lockedDoc, childId, { opacity: 0.8 }).ok).toBe(false);

    // 4. Unlocking parent restores child editability
    const unlockedDoc = setNodeLock(lockedDoc, parentSectionId, false).document;
    const childRenameAfterUnlock = renameLayerNode(unlockedDoc, childId, "Unlocked Featured");
    expect(childRenameAfterUnlock.ok).toBe(true);
  });

  it("wraps a node in a container, creates a child container, and unwraps a container cleanly", () => {
    const doc = createDefaultHomepageDocument();
    const interestId = CANONICAL_HOMEPAGE_NODE_IDS.interestSection;
    const originalIdx = doc.root.findIndex((n) => n.id === interestId);

    const wrapRes = wrapNodeInContainer(doc, interestId, "Section");
    expect(wrapRes.ok).toBe(true);
    const wrapperId = wrapRes.selectedNodeId!;
    expect(wrapRes.document.root[originalIdx]?.id).toBe(wrapperId);
    expect(wrapRes.document.root[originalIdx]?.children[0]?.id).toBe(interestId);

    // Create a child Container inside the wrapper Section
    const createChildRes = createCompatibleContainer(wrapRes.document, wrapperId, "Container");
    expect(createChildRes.ok).toBe(true);
    expect(findNodeById(createChildRes.document, wrapperId)?.children).toHaveLength(2);

    // Unwrap the wrapper Section back to root level
    const unwrapRes = unwrapContainer(wrapRes.document, wrapperId);
    expect(unwrapRes.ok).toBe(true);
    expect(unwrapRes.document.root[originalIdx]?.id).toBe(interestId);
    expect(findNodeById(unwrapRes.document, wrapperId)).toBeNull();
  });

  it("removes a removable section, computes deletion impact, selects nearest neighbor, and provides undoSnapshot", () => {
    const doc = createDefaultHomepageDocument();
    const benefitsId = CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection;
    const impact = describeDeletionImpact(doc, benefitsId);
    expect(impact).not.toBeNull();
    expect(impact?.canDelete).toBe(true);
    expect(impact?.kindLabel).toBe("page section");
    expect(impact?.nodeName).toContain("Why Shop With Us");

    const removeRes = removeLayerNode(doc, benefitsId, benefitsId);
    expect(removeRes.ok).toBe(true);
    expect(findNodeById(removeRes.document, benefitsId)).toBeNull();
    expect(removeRes.selectedNodeId).toBe(CANONICAL_HOMEPAGE_NODE_IDS.instagramSection);
    expect(removeRes.undoSnapshot?.previousDocument).toBe(doc);
  });

  it("meets performance targets across 25, 150, 500, and 1,000 node documents", () => {
    const sizes = [25, 150, 500, 1000] as const;

    for (const size of sizes) {
      const benchDoc = createSyntheticBenchmarkDocument(size);
      const targetId = "bench-node-0";

      const t0 = performance.now();
      const r1 = executeStructuralCommand(benchDoc, {
        type: "RenameNode",
        targetId,
        newName: "Renamed Node",
      });
      const r2 = executeStructuralCommand(r1.document, {
        type: "ReorderNode",
        targetId,
        direction: "down",
      });
      const r3 = executeStructuralCommand(r2.document, {
        type: "SetVisibility",
        targetId,
        visible: false,
      });
      const r4 = executeStructuralCommand(r3.document, {
        type: "SetLock",
        targetId,
        locked: true,
      });
      const r5 = executeStructuralCommand(r4.document, {
        type: "SetLock",
        targetId,
        locked: false,
      });
      const r6 = executeStructuralCommand(r5.document, {
        type: "DuplicateNode",
        targetId,
      });
      const r7 = executeStructuralCommand(
        r6.document,
        {
          type: "RemoveNode",
          targetId: r6.selectedNodeId!,
        },
        r6.selectedNodeId!,
      );
      const elapsedMs = performance.now() - t0;

      expect(r7.ok).toBe(true);
      expect(elapsedMs).toBeLessThan(150);
    }
  });
});
