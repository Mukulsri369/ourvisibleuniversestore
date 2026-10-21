import { describe, expect, it } from "vitest";
import {
  BASIC_SECTION_DOCUMENT_FIXTURE,
  buildSyntheticPageDocument,
  cloneSubtreeWithFreshIds,
  collectAllNodeIds,
  countNodes,
  findDuplicateNodeIds,
  findNodeById,
  findNodeLocation,
  findParentNode,
  getMaxTreeDepth,
  insertChildNode,
  removeNodeById,
  reorderChildNodes,
  resolveResponsiveStyle,
  safeParsePageDocument,
  serializePageDocument,
  updateNodeById,
  updateNodeStyle,
} from "../index";

describe("Tree Utilities, Structural Sharing & Performance Benchmarks", () => {
  it("finds nodes, parents, ancestor paths, counts, and max depth accurately", () => {
    expect(countNodes(BASIC_SECTION_DOCUMENT_FIXTURE)).toBe(6);
    expect(getMaxTreeDepth(BASIC_SECTION_DOCUMENT_FIXTURE)).toBe(3);

    const loc = findNodeLocation(BASIC_SECTION_DOCUMENT_FIXTURE, "heading-intro-1");
    expect(loc).not.toBeNull();
    expect(loc?.depth).toBe(3);
    expect(loc?.path).toEqual(["section-intro-1", "container-intro-1", "heading-intro-1"]);

    const parent = findParentNode(BASIC_SECTION_DOCUMENT_FIXTURE, "heading-intro-1");
    expect(parent?.id).toBe("container-intro-1");
  });

  it("preserves reference equality (structural sharing) on untouched subtrees during immutable updates", () => {
    const doc = buildSyntheticPageDocument(150);
    const firstSectionBefore = doc.root[0];
    const lastSectionBefore = doc.root[doc.root.length - 1];
    const targetCardId = lastSectionBefore.children[0].children[0].id;

    const updatedDoc = updateNodeStyle(
      doc,
      targetCardId,
      {
        geometry: {
          width: { unit: "px", value: 220 },
        },
      },
      "desktop",
    );

    expect(updatedDoc).not.toBe(doc);
    // First section was not on the ancestor path of targetCardId, so it MUST be strictly ===
    expect(updatedDoc.root[0]).toBe(firstSectionBefore);
    // Last section was on the path, so it is a new reference with updated child
    expect(updatedDoc.root[updatedDoc.root.length - 1]).not.toBe(lastSectionBefore);

    const updatedCard = findNodeById(updatedDoc, targetCardId);
    expect(updatedCard?.style.geometry?.width).toEqual({ unit: "px", value: 220 });
  });

  it("supports inserting, reordering, removing, and cloning subtrees with fresh unique IDs", () => {
    const baseDoc = BASIC_SECTION_DOCUMENT_FIXTURE;
    const reordered = reorderChildNodes(baseDoc, "container-intro-1", 0, 2);
    const containerAfterReorder = findNodeById(reordered, "container-intro-1");
    expect(containerAfterReorder?.children.map((c) => c.id)).toEqual([
      "text-intro-1",
      "image-intro-1",
      "heading-intro-1",
      "button-intro-1",
    ]);

    const existingIds = new Set(collectAllNodeIds(baseDoc.root));
    const buttonNode = findNodeById(baseDoc, "button-intro-1")!;
    const clonedButton = cloneSubtreeWithFreshIds(buttonNode, existingIds);
    expect(clonedButton.id).not.toBe(buttonNode.id);
    expect(existingIds.has(clonedButton.id)).toBe(false);

    const withInserted = insertChildNode(baseDoc, "container-intro-1", clonedButton, 1);
    expect(countNodes(withInserted)).toBe(7);
    expect(findDuplicateNodeIds(withInserted)).toEqual([]);

    const withRemoved = removeNodeById(withInserted, clonedButton.id);
    expect(countNodes(withRemoved)).toBe(6);
  });

  it("benchmarks parsing, validation, traversal, immutable update, and serialization across 25, 150, 500, and 1,000 nodes", () => {
    const sizes = [25, 150, 500, 1000] as const;

    for (const size of sizes) {
      const syntheticDoc = buildSyntheticPageDocument(size);
      expect(countNodes(syntheticDoc)).toBe(size);

      const startValidate = performance.now();
      const validation = safeParsePageDocument(syntheticDoc);
      const validateMs = performance.now() - startValidate;
      expect(validation.success).toBe(true);
      expect(validateMs).toBeLessThan(500);

      const leafNode =
        syntheticDoc.root[syntheticDoc.root.length - 1].children[0]?.children[0] ??
        syntheticDoc.root[0];

      const startUpdate = performance.now();
      const updated = updateNodeById(syntheticDoc, leafNode.id, (n) => ({
        ...n,
        style: {
          ...n.style,
          geometry: { width: { unit: "px", value: 200 } },
        },
      }));
      const updateMs = performance.now() - startUpdate;
      expect(updateMs).toBeLessThan(50);

      const resolved = resolveResponsiveStyle(findNodeById(updated, leafNode.id)!, "mobile");
      expect(resolved).toBeDefined();

      const serialized = serializePageDocument(updated);
      expect(serialized.length).toBeGreaterThan(100);
    }
  });
});
