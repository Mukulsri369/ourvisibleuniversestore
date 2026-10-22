import { describe, expect, it } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { findNodeById, updateNodeById } from "../tree";
import {
  beginHistoryInteraction,
  buildHistoryCoalesceKey,
  cancelHistoryInteraction,
  commitHistoryInteraction,
  createHistoryState,
  getHistoryStackCounts,
  recordHistoryEdit,
  redoHistory,
  undoHistory,
  updateHistoryInteraction,
} from "../history";

describe("history-grouping — Rapid Input Coalescing & Interaction Sessions", () => {
  it("coalesces rapid continuous slider/numeric updates on the same node and property into a single Undo step", () => {
    const doc0 = createDefaultHomepageDocument();
    let currentDoc = doc0;
    let history = createHistoryState();
    const coalesceKey = buildHistoryCoalesceKey({
      domain: "style",
      nodeId: "home-hero-planet",
      breakpoint: "desktop",
      fieldKey: "paddingTop",
    });

    const values = [28, 32, 36, 40, 48, 56];
    let ts = 10_000;

    for (const val of values) {
      const nextDoc = updateNodeById(currentDoc, "home-hero-planet", (n) => ({
        ...n,
        styles: {
          ...n.styles,
          desktop: {
            ...n.styles?.desktop,
            paddingTop: val,
          },
        },
      }));

      history = recordHistoryEdit(history, {
        kind: "style_edit",
        label: "Edit paddingTop",
        origin: "inspector",
        previousDocument: currentDoc,
        nextDocument: nextDoc,
        previousSelectionId: "home-hero-planet",
        nextSelectionId: "home-hero-planet",
        coalesceKey,
        allowCoalesce: true,
        timestampMs: ts,
      }).state;

      currentDoc = nextDoc;
      ts += 80; // 80ms between slider ticks
    }

    // All 6 rapid ticks coalesced into 1 Undo transaction!
    expect(getHistoryStackCounts(history).undoCount).toBe(1);

    // Undoing once returns directly to doc0 before the slider drag started
    const undone = undoHistory(history, currentDoc);
    expect(undone.document).toBe(doc0);

    // Redoing once returns directly to the final slider value (56)
    const redone = redoHistory(undone.state, undone.document);
    expect(
      findNodeById(redone.document.root, "home-hero-planet")?.styles?.desktop?.paddingTop,
    ).toBe(56);
  });

  it("drops the coalesced history entry cleanly if rapid edits return a property to its original starting value", () => {
    const doc0 = createDefaultHomepageDocument();
    const originalTitle = (
      findNodeById(doc0.root, "home-hero-planet")?.props as { headline?: string }
    )?.headline;

    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: "Temporary Title" },
    }));
    const docBackToOriginal = updateNodeById(doc1, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: originalTitle },
    }));

    const coalesceKey = buildHistoryCoalesceKey({
      domain: "prop",
      nodeId: "home-hero-planet",
      fieldKey: "headline",
    });

    let history = createHistoryState();
    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit headline",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
      coalesceKey,
      allowCoalesce: true,
      timestampMs: 1000,
    }).state;

    expect(getHistoryStackCounts(history).undoCount).toBe(1);

    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit headline",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: docBackToOriginal,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
      coalesceKey,
      allowCoalesce: true,
      timestampMs: 1200,
    }).state;

    // Because the net change is zero, the undo stack is empty
    expect(getHistoryStackCounts(history).undoCount).toBe(0);
  });

  it("keeps edits to different properties or outside the coalescing time window as separate Undo steps", () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: "Title A" },
    }));
    const doc2 = updateNodeById(doc1, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, subheadline: "Subtitle B" },
    }));
    const doc3 = updateNodeById(doc2, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, subheadline: "Subtitle C after pause" },
    }));

    let history = createHistoryState();
    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit headline",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
      coalesceKey: "prop:home-hero-planet:base:headline",
      allowCoalesce: true,
      timestampMs: 1000,
    }).state;

    // Different field -> separate entry
    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit subheadline",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
      coalesceKey: "prop:home-hero-planet:base:subheadline",
      allowCoalesce: true,
      timestampMs: 1100,
    }).state;

    // Same field but 5 seconds later -> separate entry
    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit subheadline later",
      origin: "inspector",
      previousDocument: doc2,
      nextDocument: doc3,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
      coalesceKey: "prop:home-hero-planet:base:subheadline",
      allowCoalesce: true,
      timestampMs: 6500,
    }).state;

    expect(getHistoryStackCounts(history).undoCount).toBe(3);
  });

  it("supports explicit interaction session lifecycle (begin -> update -> commit / cancel)", () => {
    const doc0 = createDefaultHomepageDocument();
    const docMid = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      styles: { ...n.styles, desktop: { ...n.styles?.desktop, gap: 16 } },
    }));
    const docFinal = updateNodeById(docMid, "home-hero-planet", (n) => ({
      ...n,
      styles: { ...n.styles, desktop: { ...n.styles?.desktop, gap: 32 } },
    }));

    let history = createHistoryState();
    history = beginHistoryInteraction(history, {
      sessionId: "drag-gap-1",
      kind: "style_edit",
      label: "Drag Gap Handle",
      origin: "canvas",
      baseDocument: doc0,
      baseSelectionId: "home-hero-planet",
    });

    expect(getHistoryStackCounts(history).hasActiveInteraction).toBe(true);

    history = updateHistoryInteraction(history, {
      sessionId: "drag-gap-1",
      latestDocument: docMid,
      latestSelectionId: "home-hero-planet",
    });

    const committed = commitHistoryInteraction(history, {
      sessionId: "drag-gap-1",
      finalDocument: docFinal,
      finalSelectionId: "home-hero-planet",
    });

    expect(committed.recorded).toBe(true);
    expect(getHistoryStackCounts(committed.state).hasActiveInteraction).toBe(false);
    expect(getHistoryStackCounts(committed.state).undoCount).toBe(1);

    const undone = undoHistory(committed.state, docFinal);
    expect(undone.document).toBe(doc0);

    // Test cancelHistoryInteraction restores baseDocument without adding an undo entry
    const startedCancel = beginHistoryInteraction(undone.state, {
      sessionId: "drag-cancel-1",
      kind: "style_edit",
      label: "Aborted Drag",
      origin: "canvas",
      baseDocument: doc0,
      baseSelectionId: "home-hero-planet",
    });
    const cancelled = cancelHistoryInteraction(startedCancel);
    expect(cancelled.documentToRestore).toBe(doc0);
    expect(getHistoryStackCounts(cancelled.state).undoCount).toBe(0);
  });
});
