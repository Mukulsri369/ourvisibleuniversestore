import type { StudioSaveDraftInput } from "../studio/studio-persistence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultHomepageDocument } from "../homepage/default-homepage-document";
import {
  createInitialHistoryState,
  recordEditingTransaction,
  undoEditingTransaction,
} from "../history";
import { coordinatorFixture, edited, saved } from "./autosave-fixture";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("autosave — Smart Debounced Autosave Coordinator & Undo/Redo Coordination", () => {
  it("debounces rapid edits and persists only the latest document snapshot once", async () => {
    const doc0 = createDefaultHomepageDocument(),
      doc1 = edited(doc0, "Edit 1"),
      doc2 = edited(doc1, "Edit 2"),
      doc3 = edited(doc2, "Edit 3 Final");
    const executeSave = vi.fn(async (input: StudioSaveDraftInput) =>
      saved(input.workingDocument, 2),
    );
    const { coordinator } = coordinatorFixture(
      executeSave,
      { debounceMs: 1000, maxWaitMs: 5000 },
      doc0,
    );
    try {
      coordinator.notifyWorkingDocumentChanged(doc1);
      await vi.advanceTimersByTimeAsync(400);
      coordinator.notifyWorkingDocumentChanged(doc2);
      await vi.advanceTimersByTimeAsync(400);
      coordinator.notifyWorkingDocumentChanged(doc3);
      expect(executeSave).not.toHaveBeenCalled();
      expect(coordinator.getSnapshot().isDirty).toBe(true);
      await vi.advanceTimersByTimeAsync(1000);
      expect(executeSave).toHaveBeenCalledTimes(1);
      expect(executeSave).toHaveBeenCalledWith(
        expect.objectContaining({ workingDocument: doc3, expectedDraftRevision: 1 }),
      );
      expect(coordinator.getSnapshot().tracking.localGeneration).toBe(3);
      expect(coordinator.getSnapshot().tracking.lastSavedGeneration).toBe(3);
      expect(coordinator.getSnapshot().isDirty).toBe(false);
    } finally {
      coordinator.dispose();
    }
  });
  it("enforces maxWaitMs during continuous editing so changes are saved periodically", async () => {
    const executeSave = vi.fn(async (input: StudioSaveDraftInput) =>
      saved(input.workingDocument, 2),
    );
    const { coordinator, document } = coordinatorFixture(executeSave, {
      debounceMs: 1000,
      maxWaitMs: 2500,
    });
    let current = document;
    try {
      for (let i = 1; i <= 6; i++) {
        current = edited(current, "Continuous Tick " + i);
        coordinator.notifyWorkingDocumentChanged(current);
        await vi.advanceTimersByTimeAsync(500);
      }
      expect(executeSave).toHaveBeenCalledTimes(1);
      expect(coordinator.getSnapshot().totalSaveRequestsSent).toBe(1);
    } finally {
      coordinator.dispose();
    }
  });
  it("cancels pending autosave and clears dirty state when Undoing all edits back to the last saved snapshot", async () => {
    const executeSave = vi.fn(async (input: StudioSaveDraftInput) =>
      saved(input.workingDocument, 6),
    );
    const { coordinator, document } = coordinatorFixture(
      executeSave,
      { debounceMs: 1200 },
      undefined,
      5,
    );
    const doc1 = edited(document, "Temporary Edit");
    try {
      const history = recordEditingTransaction(createInitialHistoryState(), {
        actionType: "property.content",
        affectedNodeIds: ["home-planet-hero"],
        label: "Edit",
        previousDocument: document,
        nextDocument: doc1,
      }).state;
      coordinator.notifyWorkingDocumentChanged(doc1);
      expect(coordinator.getSnapshot().isDirty).toBe(true);
      const undone = undoEditingTransaction(history, doc1, null);
      expect(undone.ok).toBe(true);
      coordinator.notifyWorkingDocumentChanged(undone.document);
      expect(coordinator.getSnapshot().isDirty).toBe(false);
      await vi.advanceTimersByTimeAsync(2000);
      expect(executeSave).not.toHaveBeenCalled();
      expect(coordinator.getSnapshot().status).toBe("saved");
    } finally {
      coordinator.dispose();
    }
  });
  it("schedules a new autosave when Undoing after a draft has already been saved to the server", async () => {
    const doc0 = createDefaultHomepageDocument(),
      doc1 = edited(doc0, "Saved Edit");
    let nextRevision = 1;
    const executeSave = vi.fn(async (input: StudioSaveDraftInput) =>
      saved(input.workingDocument, ++nextRevision),
    );
    const { coordinator } = coordinatorFixture(executeSave, { debounceMs: 500 }, doc0);
    try {
      const history = recordEditingTransaction(createInitialHistoryState(), {
        actionType: "property.content",
        affectedNodeIds: ["home-planet-hero"],
        label: "Edit",
        previousDocument: doc0,
        nextDocument: doc1,
      }).state;
      coordinator.notifyWorkingDocumentChanged(doc1);
      await vi.advanceTimersByTimeAsync(600);
      expect(coordinator.getSnapshot().isDirty).toBe(false);
      expect(coordinator.getSnapshot().tracking.serverDraftRevision).toBe(2);
      const undone = undoEditingTransaction(history, doc1, null);
      expect(undone.ok).toBe(true);
      coordinator.notifyWorkingDocumentChanged(undone.document);
      expect(coordinator.getSnapshot().isDirty).toBe(true);
      await vi.advanceTimersByTimeAsync(600);
      expect(executeSave).toHaveBeenCalledTimes(2);
      expect(executeSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ workingDocument: doc0, expectedDraftRevision: 2 }),
      );
      expect(coordinator.getSnapshot().tracking.serverDraftRevision).toBe(3);
    } finally {
      coordinator.dispose();
    }
  });
  it("coordinates manual Save Draft with pending debounced autosave without duplicate writes", async () => {
    const executeSave = vi.fn(async (input: StudioSaveDraftInput) =>
      saved(input.workingDocument, 2),
    );
    const { coordinator, document } = coordinatorFixture(executeSave, { debounceMs: 1200 });
    const doc1 = edited(document, "Manual Save Target");
    try {
      coordinator.notifyWorkingDocumentChanged(doc1);
      expect(coordinator.getSnapshot().isDirty).toBe(true);
      expect(await coordinator.saveNow()).toBe(true);
      expect(executeSave).toHaveBeenCalledTimes(1);
      expect(executeSave).toHaveBeenCalledWith(
        expect.objectContaining({ workingDocument: doc1, expectedDraftRevision: 1 }),
      );
      await vi.advanceTimersByTimeAsync(2000);
      expect(executeSave).toHaveBeenCalledTimes(1);
      expect(coordinator.getSnapshot().isDirty).toBe(false);
    } finally {
      coordinator.dispose();
    }
  });
});
