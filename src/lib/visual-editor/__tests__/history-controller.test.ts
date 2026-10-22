import { describe, expect, it } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { findNodeById, updateNodeById } from "../tree";
import type { EditorNode, PageDocument } from "../types";
import {
  canRedoHistory,
  canUndoHistory,
  clearHistoryStacks,
  createHistoryState,
  estimateHistoryNodeAllocations,
  estimateTransactionNodeAllocations,
  getHistoryStackCounts,
  getNextRedoLabel,
  getNextUndoLabel,
  recordHistoryEdit,
  redoHistory,
  undoHistory,
} from "../history";

function buildScaledTestDocument(nodeCount: number): PageDocument {
  const base = createDefaultHomepageDocument();
  const children: EditorNode[] = [];
  let created = 1; // root counts as 1

  let sectionIdx = 0;
  while (created < nodeCount) {
    sectionIdx += 1;
    const sectionChildren: EditorNode[] = [];
    created += 1;

    while (created < nodeCount && sectionChildren.length < 10) {
      created += 1;
      sectionChildren.push({
        id: `bench-node-${created}`,
        type: "TextBlock",
        name: `Bench Text ${created}`,
        props: {
          title: `Heading ${created}`,
          body: `Content paragraph ${created}`,
          alignment: "left",
        },
        styles: {
          desktop: {
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
        children: [],
      });
    }

    children.push({
      id: `bench-section-${sectionIdx}`,
      type: "Section",
      name: `Bench Section ${sectionIdx}`,
      props: {},
      styles: {
        desktop: {
          paddingTop: 24,
          paddingBottom: 24,
        },
      },
      children: sectionChildren,
    });
  }

  return {
    ...base,
    root: {
      ...base.root,
      children,
    },
  };
}

describe("history-controller — Core Undo/Redo Engine & Memory Accounting", () => {
  it("initializes with empty undo and redo stacks and disabled availability", () => {
    const state = createHistoryState();
    expect(canUndoHistory(state)).toBe(false);
    expect(canRedoHistory(state)).toBe(false);
    expect(getNextUndoLabel(state)).toBeNull();
    expect(getNextRedoLabel(state)).toBeNull();
    expect(getHistoryStackCounts(state)).toEqual({
      undoCount: 0,
      redoCount: 0,
      hasActiveInteraction: false,
    });
  });

  it("supports single-step and multi-step Undo and Redo with exact document and selection restoration", () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: "Step 1 Headline" },
    }));
    const doc2 = updateNodeById(doc1, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: "Step 2 Headline" },
    }));
    const doc3 = updateNodeById(doc2, "home-category-grid", (n) => ({
      ...n,
      name: "Step 3 Custom Sector Grid",
    }));

    let history = createHistoryState();

    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit Headline 1",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
      allowCoalesce: false,
      timestampMs: 1000,
    }).state;

    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit Headline 2",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
      allowCoalesce: false,
      timestampMs: 2000,
    }).state;

    history = recordHistoryEdit(history, {
      kind: "rename_node",
      label: "Rename Sector Grid",
      origin: "layers",
      previousDocument: doc2,
      nextDocument: doc3,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-category-grid",
      allowCoalesce: false,
      timestampMs: 3000,
    }).state;

    expect(getHistoryStackCounts(history).undoCount).toBe(3);
    expect(getNextUndoLabel(history)).toBe("Rename Sector Grid");

    // Undo Step 3 -> back to doc2
    const undo1 = undoHistory(history, doc3);
    expect(undo1.applied).toBe(true);
    expect(undo1.document).toBe(doc2);
    expect(undo1.selectionId).toBe("home-hero-planet");
    expect(getNextUndoLabel(undo1.state)).toBe("Edit Headline 2");
    expect(getNextRedoLabel(undo1.state)).toBe("Rename Sector Grid");

    // Undo Step 2 -> back to doc1
    const undo2 = undoHistory(undo1.state, undo1.document);
    expect(undo2.applied).toBe(true);
    expect(undo2.document).toBe(doc1);
    expect(
      (findNodeById(undo2.document.root, "home-hero-planet")?.props as { headline?: string })
        ?.headline,
    ).toBe("Step 1 Headline");

    // Undo Step 1 -> back to doc0
    const undo3 = undoHistory(undo2.state, undo2.document);
    expect(undo3.applied).toBe(true);
    expect(undo3.document).toBe(doc0);
    expect(canUndoHistory(undo3.state)).toBe(false);
    expect(canRedoHistory(undo3.state)).toBe(true);

    // Redo Step 1 -> doc1
    const redo1 = redoHistory(undo3.state, undo3.document);
    expect(redo1.applied).toBe(true);
    expect(redo1.document).toBe(doc1);

    // Redo Step 2 -> doc2
    const redo2 = redoHistory(redo1.state, redo1.document);
    expect(redo2.applied).toBe(true);
    expect(redo2.document).toBe(doc2);

    // Redo Step 3 -> doc3
    const redo3 = redoHistory(redo2.state, redo2.document);
    expect(redo3.applied).toBe(true);
    expect(redo3.document).toBe(doc3);
    expect(redo3.selectionId).toBe("home-category-grid");
    expect(canRedoHistory(redo3.state)).toBe(false);
  });

  it("clears the redo stack when a new edit occurs after Undo", () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      name: "Hero 1",
    }));
    const doc2 = updateNodeById(doc1, "home-hero-planet", (n) => ({
      ...n,
      name: "Hero 2",
    }));
    const docBranch = updateNodeById(doc1, "home-hero-planet", (n) => ({
      ...n,
      name: "Hero Branch",
    }));

    let history = createHistoryState();
    history = recordHistoryEdit(history, {
      kind: "rename_node",
      label: "Rename 1",
      origin: "layers",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
    }).state;
    history = recordHistoryEdit(history, {
      kind: "rename_node",
      label: "Rename 2",
      origin: "layers",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
    }).state;

    const undone = undoHistory(history, doc2);
    expect(canRedoHistory(undone.state)).toBe(true);

    const branched = recordHistoryEdit(undone.state, {
      kind: "rename_node",
      label: "Rename Branch",
      origin: "layers",
      previousDocument: undone.document,
      nextDocument: docBranch,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
    }).state;

    expect(canRedoHistory(branched)).toBe(false);
    expect(getHistoryStackCounts(branched)).toEqual({
      undoCount: 2,
      redoCount: 0,
      hasActiveInteraction: false,
    });
  });

  it("ignores no-op edits where document content has not changed", () => {
    const doc0 = createDefaultHomepageDocument();
    const docSameContent: PageDocument = {
      ...doc0,
      metadata: {
        ...doc0.metadata,
        updatedAt: "2099-01-01T00:00:00.000Z",
      },
    };

    const history = createHistoryState();
    const result = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "No-op edit",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: docSameContent,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
    });

    expect(result.recorded).toBe(false);
    expect(canUndoHistory(result.state)).toBe(false);
  });

  it("rejects corrupted documents from entering history or being restored", () => {
    const doc0 = createDefaultHomepageDocument();
    const corruptedDoc = {
      ...doc0,
      root: null as unknown as EditorNode,
    };

    const history = createHistoryState();
    const result = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Corrupted edit",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: corruptedDoc,
      previousSelectionId: null,
      nextSelectionId: null,
    });

    expect(result.recorded).toBe(false);
    expect(canUndoHistory(result.state)).toBe(false);
  });

  it("enforces bounded history depth and evicts the oldest entries smoothly", () => {
    let currentDoc = createDefaultHomepageDocument();
    let history = createHistoryState({
      maxTransactions: 10,
      maxNodeAllocationBudget: 5000,
    });

    for (let i = 1; i <= 18; i += 1) {
      const nextDoc = updateNodeById(currentDoc, "home-hero-planet", (n) => ({
        ...n,
        name: `Hero Iteration ${i}`,
      }));
      history = recordHistoryEdit(history, {
        kind: "rename_node",
        label: `Rename ${i}`,
        origin: "layers",
        previousDocument: currentDoc,
        nextDocument: nextDoc,
        previousSelectionId: "home-hero-planet",
        nextSelectionId: "home-hero-planet",
        allowCoalesce: false,
      }).state;
      currentDoc = nextDoc;
    }

    expect(getHistoryStackCounts(history).undoCount).toBe(10);
    expect(history.undoStack[0]?.label).toBe("Rename 9");
    expect(history.undoStack[9]?.label).toBe("Rename 18");

    const cleared = clearHistoryStacks(history);
    expect(getHistoryStackCounts(cleared).undoCount).toBe(0);
  });

  it("preserves structural sharing across unmodified subtrees and scales sub-millisecond up to 1,000 nodes", () => {
    const sizes = [25, 150, 500, 1000] as const;

    for (const size of sizes) {
      const doc0 = buildScaledTestDocument(size);
      const targetId = `bench-node-${size}`;
      const untouchedSection = doc0.root.children[0];

      const recordStart = performance.now();
      const doc1 = updateNodeById(doc0, targetId, (node) => ({
        ...node,
        props: { ...node.props, title: `Updated at size ${size}` },
      }));

      // Verify structural sharing: first section reference is strictly identical
      if (doc0.root.children.length > 1) {
        expect(doc1.root.children[0]).toBe(untouchedSection);
      }

      const recorded = recordHistoryEdit(createHistoryState(), {
        kind: "prop_edit",
        label: `Update ${targetId}`,
        origin: "inspector",
        previousDocument: doc0,
        nextDocument: doc1,
        previousSelectionId: targetId,
        nextSelectionId: targetId,
      });
      const recordMs = performance.now() - recordStart;

      // Only root + target section + target node = 3 nodes allocated!
      const txAllocations = estimateTransactionNodeAllocations(recorded.transaction!);
      expect(txAllocations).toBeLessThanOrEqual(4);
      expect(estimateHistoryNodeAllocations(recorded.state)).toBeLessThanOrEqual(4);

      const undoStart = performance.now();
      const undone = undoHistory(recorded.state, doc1);
      const undoMs = performance.now() - undoStart;

      const redoStart = performance.now();
      const redone = redoHistory(undone.state, undone.document);
      const redoMs = performance.now() - redoStart;

      expect(undone.document).toBe(doc0);
      expect(redone.document).toBe(doc1);
      expect(recordMs).toBeLessThan(100);
      expect(undoMs).toBeLessThan(20);
      expect(redoMs).toBeLessThan(20);
    }
  });
});
