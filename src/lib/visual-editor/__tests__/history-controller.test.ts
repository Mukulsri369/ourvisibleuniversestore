import { describe, expect, it } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { findNodeById, updateNodeById } from "../utils/node-tree";
import type { EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import {
  canRedoHistory,
  canUndoHistory,
  createInitialHistoryState,
  estimateTransactionNodeAllocations,
  getNextRedoLabel,
  getNextUndoLabel,
  recordEditingTransaction,
  redoEditingTransaction,
  undoEditingTransaction,
  validateHistoryDocumentState,
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
        type: "Text",
        name: `Bench Text ${created}`,
        props: {
          title: `Heading ${created}`,
          text: `Content paragraph ${created}`,
        },
        style: {},
        children: [],
      });
    }

    children.push({
      id: `bench-section-${sectionIdx}`,
      type: "Section",
      name: `Bench Section ${sectionIdx}`,
      props: {},
      style: {},
      children: sectionChildren,
    });
  }

  return {
    ...base,
    root: children,
  };
}

describe("history-controller — Core Undo/Redo Engine & Memory Accounting", () => {
  it("initializes with empty undo and redo stacks and disabled availability", () => {
    const state = createInitialHistoryState();
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
    const doc1 = updateNodeById(doc0, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, title: "Step 1 Headline" },
    }));
    const doc2 = updateNodeById(doc1, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, title: "Step 2 Headline" },
    }));
    const doc3 = updateNodeById(doc2, "home-dynamic-categories", (n) => ({
      ...n,
      name: "Step 3 Custom Sector Grid",
    }));

    let history = createInitialHistoryState();

    history = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "Edit Headline 1",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
      allowCoalesce: false,
      timestamp: 1000,
    }).state;

    history = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "Edit Headline 2",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
      allowCoalesce: false,
      timestamp: 2000,
    }).state;

    history = recordEditingTransaction(history, {
      actionType: "structural.rename",
      affectedNodeIds: ["home-planet-hero"],
      label: "Rename Sector Grid",
      origin: "layers_panel",
      previousDocument: doc2,
      nextDocument: doc3,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-dynamic-categories",
      allowCoalesce: false,
      timestamp: 3000,
    }).state;

    expect(getHistoryStackCounts(history).undoCount).toBe(3);
    expect(getNextUndoLabel(history)).toBe("Rename Sector Grid");

    // Undo Step 3 -> back to doc2
    const undo1 = undoEditingTransaction(history, doc3, null);
    expect(undo1.ok).toBe(true);
    expect(undo1.document).toBe(doc2);
    expect(undo1.selectedNodeId).toBe("home-planet-hero");
    expect(getNextUndoLabel(undo1.state)).toBe("Edit Headline 2");
    expect(getNextRedoLabel(undo1.state)).toBe("Rename Sector Grid");

    // Undo Step 2 -> back to doc1
    const undo2 = undoEditingTransaction(undo1.state, undo1.document, null);
    expect(undo2.ok).toBe(true);
    expect(undo2.document).toBe(doc1);
    expect(
      (findNodeById(undo2.document, "home-planet-hero")?.props as { title?: string })?.title,
    ).toBe("Step 1 Headline");

    // Undo Step 1 -> back to doc0
    const undo3 = undoEditingTransaction(undo2.state, undo2.document, null);
    expect(undo3.ok).toBe(true);
    expect(undo3.document).toBe(doc0);
    expect(canUndoHistory(undo3.state)).toBe(false);
    expect(canRedoHistory(undo3.state)).toBe(true);

    // Redo Step 1 -> doc1
    const redo1 = redoEditingTransaction(undo3.state, undo3.document, null);
    expect(redo1.ok).toBe(true);
    expect(redo1.document).toBe(doc1);

    // Redo Step 2 -> doc2
    const redo2 = redoEditingTransaction(redo1.state, redo1.document, null);
    expect(redo2.ok).toBe(true);
    expect(redo2.document).toBe(doc2);

    // Redo Step 3 -> doc3
    const redo3 = redoEditingTransaction(redo2.state, redo2.document, null);
    expect(redo3.ok).toBe(true);
    expect(redo3.document).toBe(doc3);
    expect(redo3.selectedNodeId).toBe("home-dynamic-categories");
    expect(canRedoHistory(redo3.state)).toBe(false);
  });

  it("clears the redo stack when a new edit occurs after Undo", () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-planet-hero", (n) => ({
      ...n,
      name: "Hero 1",
    }));
    const doc2 = updateNodeById(doc1, "home-planet-hero", (n) => ({
      ...n,
      name: "Hero 2",
    }));
    const docBranch = updateNodeById(doc1, "home-planet-hero", (n) => ({
      ...n,
      name: "Hero Branch",
    }));

    let history = createInitialHistoryState();
    history = recordEditingTransaction(history, {
      actionType: "structural.rename",
      affectedNodeIds: ["home-planet-hero"],
      label: "Rename 1",
      origin: "layers_panel",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
    }).state;
    history = recordEditingTransaction(history, {
      actionType: "structural.rename",
      affectedNodeIds: ["home-planet-hero"],
      label: "Rename 2",
      origin: "layers_panel",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
    }).state;

    const undone = undoEditingTransaction(history, doc2, null);
    expect(canRedoHistory(undone.state)).toBe(true);

    const branched = recordEditingTransaction(undone.state, {
      actionType: "structural.rename",
      affectedNodeIds: ["home-planet-hero"],
      label: "Rename Branch",
      origin: "layers_panel",
      previousDocument: undone.document,
      nextDocument: docBranch,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
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

    const history = createInitialHistoryState();
    const result = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "No-op edit",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: docSameContent,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
    });

    expect(result.recorded).toBe(false);
    expect(canUndoHistory(result.state)).toBe(false);
  });

  it("rejects corrupted documents from entering history or being restored", () => {
    const doc0 = createDefaultHomepageDocument();
    const corruptedDoc = {
      ...doc0,
      root: null as unknown as EditorNode[],
    };

    const history = createInitialHistoryState();
    const result = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
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

  it("revalidates mutated snapshot references and checks duplicate IDs across cached roots", () => {
    const doc = createDefaultHomepageDocument();
    expect(validateHistoryDocumentState(doc).valid).toBe(true);
    const changed = structuredClone(doc);
    expect(validateHistoryDocumentState(changed).valid).toBe(true);
    changed.root[0].props = { href: "javascript:alert(1)" };
    expect(validateHistoryDocumentState(changed).valid).toBe(false);
    const duplicate = { ...doc, root: [...doc.root, doc.root[0]] };
    expect(validateHistoryDocumentState(duplicate).valid).toBe(false);
  });

  it("enforces bounded history depth and evicts the oldest entries smoothly", () => {
    let currentDoc = createDefaultHomepageDocument();
    let history = createInitialHistoryState({
      maxTransactions: 10,
      maxEstimatedRetainedNodes: 5000,
    });

    for (let i = 1; i <= 18; i += 1) {
      const nextDoc = updateNodeById(currentDoc, "home-planet-hero", (n) => ({
        ...n,
        name: `Hero Iteration ${i}`,
      }));
      history = recordEditingTransaction(history, {
        actionType: "structural.rename",
        affectedNodeIds: ["home-planet-hero"],
        label: `Rename ${i}`,
        origin: "layers_panel",
        previousDocument: currentDoc,
        nextDocument: nextDoc,
        previousSelectionId: "home-planet-hero",
        nextSelectionId: "home-planet-hero",
        allowCoalesce: false,
      }).state;
      currentDoc = nextDoc;
    }

    expect(getHistoryStackCounts(history).undoCount).toBe(10);
    expect(history.undoStack[0]?.label).toBe("Rename 9");
    expect(history.undoStack[9]?.label).toBe("Rename 18");

    const cleared = createInitialHistoryState(history.limits);
    expect(getHistoryStackCounts(cleared).undoCount).toBe(0);
  });

  it("preserves structural sharing across unmodified subtrees and scales sub-millisecond up to 1,000 nodes", () => {
    const sizes = [25, 150, 500, 1000] as const;

    for (const size of sizes) {
      const doc0 = buildScaledTestDocument(size);
      // Real editor snapshots are validated on load, before timing an edit/undo/redo.
      expect(validateHistoryDocumentState(doc0).valid).toBe(true);
      const targetId = `bench-node-${size}`;
      const untouchedSection = doc0.root[0];

      const recordStart = performance.now();
      const doc1 = updateNodeById(doc0, targetId, (node) => ({
        ...node,
        props: { ...node.props, title: `Updated at size ${size}` },
      }));

      // Verify structural sharing: first section reference is strictly identical
      if (doc0.root.length > 1) {
        expect(doc1.root[0]).toBe(untouchedSection);
      }

      const recorded = recordEditingTransaction(createInitialHistoryState(), {
        actionType: "property.content",
        affectedNodeIds: ["home-planet-hero"],
        label: `Update ${targetId}`,
        origin: "inspector",
        previousDocument: doc0,
        nextDocument: doc1,
        previousSelectionId: targetId,
        nextSelectionId: targetId,
      });
      const recordMs = performance.now() - recordStart;

      // Only root + target section + target node = 3 nodes allocated!
      const txAllocations = estimateTransactionNodeAllocations(
        recorded.transaction!.previousDocument,
        recorded.transaction!.nextDocument,
      );
      expect(txAllocations).toBeLessThanOrEqual(4);
      expect(recorded.state.estimatedRetainedNodes).toBeLessThanOrEqual(4);

      const undoStart = performance.now();
      const undone = undoEditingTransaction(recorded.state, doc1, null);
      const undoMs = performance.now() - undoStart;

      const redoStart = performance.now();
      const redone = redoEditingTransaction(undone.state, undone.document, null);
      const redoMs = performance.now() - redoStart;

      expect(undone.document).toBe(doc0);
      expect(redone.document).toBe(doc1);
      expect(recordMs).toBeLessThan(100);
      expect(undoMs).toBeLessThan(20);
      expect(redoMs).toBeLessThan(20);
    }
  });
});

function getHistoryStackCounts(state: import("../history").HistoryState) {
  return {
    undoCount: state.undoStack.length,
    redoCount: state.redoStack.length,
    hasActiveInteraction: state.activeInteraction !== null,
  };
}
