import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { updateNodeById } from "../utils/node-tree";
import { createHistoryState, recordHistoryEdit, undoHistory } from "../history";
import {
  areDocumentsContentEqual,
  createAutosaveCoordinator,
  createRevisionTrackingState,
  markPersistedSnapshot,
  registerLocalMutation,
} from "../autosave";

describe("autosave — Smart Debounced Autosave Coordinator & Undo/Redo Coordination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces rapid edits and persists only the latest document snapshot once", async () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      name: "Edit 1",
    }));
    const doc2 = updateNodeById(doc1, "home-hero-planet", (n) => ({
      ...n,
      name: "Edit 2",
    }));
    const doc3 = updateNodeById(doc2, "home-hero-planet", (n) => ({
      ...n,
      name: "Edit 3 Final",
    }));

    const executeSave = vi.fn().mockResolvedValue({
      ok: true,
      draftRevision: 2,
      savedAt: "2026-04-20T12:00:00.000Z",
    });

    const coordinator = createAutosaveCoordinator({
      config: {
        debounceMs: 1000,
        maxWaitMs: 5000,
      },
      executeSave,
    });

    coordinator.scheduleAutosave({
      document: doc1,
      generation: 1,
      expectedDraftRevision: 1,
    });
    vi.advanceTimersByTime(400);

    coordinator.scheduleAutosave({
      document: doc2,
      generation: 2,
      expectedDraftRevision: 1,
    });
    vi.advanceTimersByTime(400);

    coordinator.scheduleAutosave({
      document: doc3,
      generation: 3,
      expectedDraftRevision: 1,
    });

    // Still within trailing 1000ms of Edit 3 -> no network call yet
    expect(executeSave).not.toHaveBeenCalled();
    expect(coordinator.hasPendingSave()).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect(executeSave).toHaveBeenCalledTimes(1);
    expect(executeSave).toHaveBeenCalledWith(
      expect.objectContaining({
        document: doc3,
        generation: 3,
        expectedDraftRevision: 1,
        trigger: "autosave",
      }),
    );
    expect(coordinator.hasPendingSave()).toBe(false);

    coordinator.dispose();
  });

  it("enforces maxWaitMs during continuous editing so changes are saved periodically", async () => {
    const doc0 = createDefaultHomepageDocument();
    const executeSave = vi.fn().mockResolvedValue({
      ok: true,
      draftRevision: 2,
      savedAt: "2026-04-20T12:01:00.000Z",
    });

    const coordinator = createAutosaveCoordinator({
      config: {
        debounceMs: 1000,
        maxWaitMs: 2500,
      },
      executeSave,
    });

    let currentDoc = doc0;
    for (let i = 1; i <= 6; i += 1) {
      currentDoc = updateNodeById(currentDoc, "home-hero-planet", (n) => ({
        ...n,
        name: `Continuous Tick ${i}`,
      }));
      coordinator.scheduleAutosave({
        document: currentDoc,
        generation: i,
        expectedDraftRevision: 1,
      });
      await vi.advanceTimersByTimeAsync(500);
    }

    // 6 * 500ms = 3000ms > 2500ms maxWaitMs -> save fired at 2500ms!
    expect(executeSave).toHaveBeenCalledTimes(1);
    coordinator.dispose();
  });

  it("cancels pending autosave and clears dirty state when Undoing all edits back to the last saved snapshot", () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: "Temporary Edit" },
    }));

    let revState = createRevisionTrackingState(doc0, 5);
    let history = createHistoryState();

    const executeSave = vi.fn();
    const coordinator = createAutosaveCoordinator({
      config: { debounceMs: 1200 },
      executeSave,
    });

    // Apply edit -> schedules autosave
    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit headline",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
    }).state;
    revState = registerLocalMutation(revState, doc1);

    expect(revState.isDirty).toBe(true);
    coordinator.scheduleAutosave({
      document: doc1,
      generation: revState.localEditGeneration,
      expectedDraftRevision: revState.serverDraftRevision,
    });
    expect(coordinator.hasPendingSave()).toBe(true);

    // Undo before debounce fires -> back to saved doc0
    const undone = undoHistory(history, doc1);
    revState = registerLocalMutation(revState, undone.document);

    expect(areDocumentsContentEqual(undone.document, doc0)).toBe(true);
    expect(revState.isDirty).toBe(false);

    if (!revState.isDirty) {
      coordinator.cancelPendingAutosave();
    }

    vi.advanceTimersByTime(3000);
    expect(executeSave).not.toHaveBeenCalled();
    coordinator.dispose();
  });

  it("schedules a new autosave when Undoing after a draft has already been saved to the server", async () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: "Persisted Edit" },
    }));

    let revState = createRevisionTrackingState(doc0, 1);
    let history = createHistoryState();

    // Edit doc0 -> doc1
    history = recordHistoryEdit(history, {
      kind: "prop_edit",
      label: "Edit headline",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-hero-planet",
      nextSelectionId: "home-hero-planet",
    }).state;
    revState = registerLocalMutation(revState, doc1);

    // Autosave completes for doc1 at revision 2
    revState = markPersistedSnapshot(revState, {
      savedDocument: doc1,
      savedGeneration: revState.localEditGeneration,
      newServerDraftRevision: 2,
      currentWorkingDocument: doc1,
    });
    expect(revState.isDirty).toBe(false);

    // Now user presses Undo -> working document returns to doc0, which differs from persisted doc1!
    const undone = undoHistory(history, doc1);
    revState = registerLocalMutation(revState, undone.document);
    expect(revState.isDirty).toBe(true);

    const executeSave = vi.fn().mockResolvedValue({
      ok: true,
      draftRevision: 3,
      savedAt: "2026-04-20T12:05:00.000Z",
    });
    const coordinator = createAutosaveCoordinator({
      config: { debounceMs: 500 },
      executeSave,
    });

    coordinator.scheduleAutosave({
      document: undone.document,
      generation: revState.localEditGeneration,
      expectedDraftRevision: revState.serverDraftRevision,
    });

    await vi.advanceTimersByTimeAsync(600);
    expect(executeSave).toHaveBeenCalledTimes(1);
    expect(executeSave).toHaveBeenCalledWith(
      expect.objectContaining({
        document: doc0,
        expectedDraftRevision: 2,
      }),
    );

    coordinator.dispose();
  });

  it("coordinates manual Save Draft with pending debounced autosave without duplicate writes", async () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      name: "Manual Save Target",
    }));

    const executeSave = vi.fn().mockResolvedValue({
      ok: true,
      draftRevision: 2,
      savedAt: "2026-04-20T12:10:00.000Z",
    });

    const coordinator = createAutosaveCoordinator({
      config: { debounceMs: 1200 },
      executeSave,
    });

    // Schedule debounced autosave
    coordinator.scheduleAutosave({
      document: doc1,
      generation: 1,
      expectedDraftRevision: 1,
    });
    expect(coordinator.hasPendingSave()).toBe(true);

    // User immediately clicks Save Draft (or presses Cmd/Ctrl+S)
    await coordinator.flushImmediateSave({
      document: doc1,
      generation: 1,
      expectedDraftRevision: 1,
      trigger: "manual",
    });

    expect(executeSave).toHaveBeenCalledTimes(1);
    expect(executeSave).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "manual",
      }),
    );

    // Advance timer past original debounce window -> must NOT fire a duplicate request
    await vi.advanceTimersByTimeAsync(2000);
    expect(executeSave).toHaveBeenCalledTimes(1);
    coordinator.dispose();
  });
});
