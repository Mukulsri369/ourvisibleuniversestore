import { describe, expect, it } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { findNodeById, updateNodeById } from "../utils/node-tree";
import {
  beginHistoryInteraction,
  buildTransactionCoalesceKey,
  cancelHistoryInteraction,
  commitHistoryInteraction,
  createInitialHistoryState,
  recordEditingTransaction,
  redoEditingTransaction,
  undoEditingTransaction,
  updateHistoryInteraction,
} from "../history";

describe("history-grouping — Rapid Input Coalescing & Interaction Sessions", () => {
  it("coalesces rapid continuous slider/numeric updates on the same node and property into a single Undo step", () => {
    const doc0 = createDefaultHomepageDocument();
    let currentDoc = doc0;
    let history = createInitialHistoryState();
    const coalesceKey = buildTransactionCoalesceKey({
      actionType: "property.style",
      targetNodeId: "home-planet-hero",
      breakpoint: "desktop",
      propertyPath: "paddingTop",
    });

    const values = [28, 32, 36, 40, 48, 56];
    let ts = 10_000;

    for (const val of values) {
      const nextDoc = updateNodeById(currentDoc, "home-planet-hero", (n) => ({
        ...n,
        style: {
          ...n.style,
          geometry: {
            ...n.style.geometry,
            padding: { top: val, right: 0, bottom: 0, left: 0, unit: "px" },
          },
        },
      }));

      history = recordEditingTransaction(history, {
        actionType: "property.style",
        affectedNodeIds: ["home-planet-hero"],
        label: "Edit paddingTop",
        origin: "inspector",
        previousDocument: currentDoc,
        nextDocument: nextDoc,
        previousSelectionId: "home-planet-hero",
        nextSelectionId: "home-planet-hero",
        coalesceKey,
        allowCoalesce: true,
        timestamp: ts,
      }).state;

      currentDoc = nextDoc;
      ts += 80; // 80ms between slider ticks
    }

    // All 6 rapid ticks coalesced into 1 Undo transaction!
    expect(getHistoryStackCounts(history).undoCount).toBe(1);

    // Undoing once returns directly to doc0 before the slider drag started
    const undone = undoEditingTransaction(history, currentDoc, null);
    expect(undone.document).toBe(doc0);

    // Redoing once returns directly to the final slider value (56)
    const redone = redoEditingTransaction(undone.state, undone.document, null);
    expect(findNodeById(redone.document, "home-planet-hero")?.style.geometry?.padding?.top).toBe(
      56,
    );
  });

  it("drops the coalesced history entry cleanly if rapid edits return a property to its original starting value", () => {
    const doc0 = createDefaultHomepageDocument();
    const originalTitle = (findNodeById(doc0, "home-planet-hero")?.props as { title?: string })
      ?.title;

    const doc1 = updateNodeById(doc0, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, title: "Temporary Title" },
    }));
    const docBackToOriginal = updateNodeById(doc1, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, title: originalTitle },
    }));

    const coalesceKey = buildTransactionCoalesceKey({
      actionType: "property.content",
      targetNodeId: "home-planet-hero",
      propertyPath: "title",
    });

    let history = createInitialHistoryState();
    history = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "Edit title",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
      coalesceKey,
      allowCoalesce: true,
      timestamp: 1000,
    }).state;

    expect(getHistoryStackCounts(history).undoCount).toBe(1);

    history = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "Edit title",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: docBackToOriginal,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
      coalesceKey,
      allowCoalesce: true,
      timestamp: 1200,
    }).state;

    // Because the net change is zero, the undo stack is empty
    expect(getHistoryStackCounts(history).undoCount).toBe(0);
  });

  it("keeps edits to different properties or outside the coalescing time window as separate Undo steps", () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, title: "Title A" },
    }));
    const doc2 = updateNodeById(doc1, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, subtitle: "Subtitle B" },
    }));
    const doc3 = updateNodeById(doc2, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, subtitle: "Subtitle C after pause" },
    }));

    let history = createInitialHistoryState();
    history = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "Edit title",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
      coalesceKey: "prop:home-planet-hero:base:title",
      allowCoalesce: true,
      timestamp: 1000,
    }).state;

    // Different field -> separate entry
    history = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "Edit subtitle",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
      coalesceKey: "prop:home-planet-hero:base:subtitle",
      allowCoalesce: true,
      timestamp: 1100,
    }).state;

    // Same field but 5 seconds later -> separate entry
    history = recordEditingTransaction(history, {
      actionType: "property.content",
      affectedNodeIds: ["home-planet-hero"],
      label: "Edit subtitle later",
      origin: "inspector",
      previousDocument: doc2,
      nextDocument: doc3,
      previousSelectionId: "home-planet-hero",
      nextSelectionId: "home-planet-hero",
      coalesceKey: "prop:home-planet-hero:base:subtitle",
      allowCoalesce: true,
      timestamp: 6500,
    }).state;

    expect(getHistoryStackCounts(history).undoCount).toBe(3);
  });

  it("supports explicit interaction session lifecycle (begin -> update -> commit / cancel)", () => {
    const doc0 = createDefaultHomepageDocument();
    const docMid = updateNodeById(doc0, "home-planet-hero", (n) => ({
      ...n,
      style: { ...n.style, layout: { mode: "flex", flex: { columnGapPx: 16 } } },
    }));
    const docFinal = updateNodeById(docMid, "home-planet-hero", (n) => ({
      ...n,
      style: { ...n.style, layout: { mode: "flex", flex: { columnGapPx: 32 } } },
    }));

    let history = createInitialHistoryState();
    history = beginHistoryInteraction(history, {
      groupKey: "drag-gap-1",
      actionType: "property.style",
      affectedNodeIds: ["home-planet-hero"],
      label: "Drag Gap Handle",
      origin: "canvas",
      baselineDocument: doc0,
      baselineSelectionId: "home-planet-hero",
    });

    expect(getHistoryStackCounts(history).hasActiveInteraction).toBe(true);

    history = updateHistoryInteraction(history, docMid, "home-planet-hero").state;

    history = updateHistoryInteraction(history, docFinal, "home-planet-hero").state;
    const committed = commitHistoryInteraction(history);

    expect(committed.recorded).toBe(true);
    expect(getHistoryStackCounts(committed.state).hasActiveInteraction).toBe(false);
    expect(getHistoryStackCounts(committed.state).undoCount).toBe(1);

    const undone = undoEditingTransaction(committed.state, docFinal, null);
    expect(undone.document).toBe(doc0);

    // Test cancelHistoryInteraction restores baseDocument without adding an undo entry
    const startedCancel = beginHistoryInteraction(undone.state, {
      groupKey: "drag-cancel-1",
      actionType: "property.style",
      affectedNodeIds: ["home-planet-hero"],
      label: "Aborted Drag",
      origin: "canvas",
      baselineDocument: doc0,
      baselineSelectionId: "home-planet-hero",
    });
    const cancelled = cancelHistoryInteraction(startedCancel, docMid, "home-planet-hero");
    expect(cancelled.document).toBe(doc0);
    expect(getHistoryStackCounts(cancelled.state).undoCount).toBe(0);
  });
});

function getHistoryStackCounts(state: import("../history").HistoryState) {
  return {
    undoCount: state.undoStack.length,
    redoCount: state.redoStack.length,
    hasActiveInteraction: state.activeInteraction !== null,
  };
}
