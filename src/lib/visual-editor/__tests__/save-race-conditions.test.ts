import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultHomepageDocument } from "../homepage/default-homepage-document";
import {
  advanceLocalGeneration,
  createInitialRevisionTrackingState,
  reconcileConfirmedSaveGeneration,
} from "../autosave";
import { PersistenceError } from "../persistence/persistence-errors";
import type { StudioSaveDraftInput, StudioSaveDraftOutcome } from "../studio/studio-persistence";
import { coordinatorFixture, edited, saved } from "./autosave-fixture";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("save-race-conditions — Single-Flight Queue, Generation Tracking & Conflict Safety", () => {
  it("preserves newer local edits (Gen 11) made while an older save (Gen 10) is in flight and updates expectedDraftRevision", async () => {
    const doc0 = createDefaultHomepageDocument(),
      docGen10 = edited(doc0, "Gen 10 Edit"),
      docGen11 = edited(docGen10, "Gen 11 Newer Edit During Save");
    let resolveFirst!: (result: StudioSaveDraftOutcome) => void;
    const executeSave = vi
      .fn<(input: StudioSaveDraftInput) => Promise<StudioSaveDraftOutcome>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(async (input) => saved(input.workingDocument, 3));
    const { coordinator } = coordinatorFixture(executeSave, { debounceMs: 1000 }, doc0);
    const snapshots: ReturnType<typeof coordinator.getSnapshot>[] = [];
    coordinator.subscribe((s) => snapshots.push(s));
    try {
      coordinator.notifyWorkingDocumentChanged(docGen10);
      const gen10 = coordinator.getSnapshot().tracking.localGeneration;
      const firstSave = coordinator.saveNow();
      expect(executeSave).toHaveBeenCalledTimes(1);
      coordinator.notifyWorkingDocumentChanged(docGen11);
      const gen11 = coordinator.getSnapshot().tracking.localGeneration;
      expect(gen11).toBeGreaterThan(gen10);
      expect(await coordinator.saveNow()).toBe(false);
      expect(executeSave).toHaveBeenCalledTimes(1);
      resolveFirst(saved(docGen10, 2));
      expect(await firstSave).toBe(true);
      expect(
        snapshots.some(
          (s) =>
            s.tracking.serverDraftRevision === 2 && s.isDirty && s.workingDocument === docGen11,
        ),
      ).toBe(true);
      expect(executeSave).toHaveBeenCalledTimes(2);
      expect(executeSave).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ workingDocument: docGen11, expectedDraftRevision: 2 }),
      );
      expect(coordinator.getSnapshot().isDirty).toBe(false);
      expect(coordinator.getSnapshot().tracking.lastSavedGeneration).toBe(gen11);
      expect(coordinator.getSnapshot().tracking.serverDraftRevision).toBe(3);
    } finally {
      coordinator.dispose();
    }
  });
  it("ignores stale/out-of-order server save responses that are older than already-persisted generations", () => {
    const doc0 = createDefaultHomepageDocument(),
      doc1 = edited(doc0, "Gen 1"),
      doc2 = edited(doc1, "Gen 2");
    let tracking = createInitialRevisionTrackingState({
      persistedDocument: doc0,
      serverDraftRevision: 5,
    });
    tracking = advanceLocalGeneration(tracking, doc1);
    tracking = advanceLocalGeneration(tracking, doc2);
    tracking = reconcileConfirmedSaveGeneration(tracking, {
      submittedGeneration: 2,
      confirmedDocument: doc2,
      confirmedDraftRevision: 7,
    }).tracking;
    const stale = reconcileConfirmedSaveGeneration(tracking, {
      submittedGeneration: 1,
      confirmedDocument: doc1,
      confirmedDraftRevision: 6,
    });
    expect(stale.isStaleGenerationResponse).toBe(true);
    expect(stale.tracking).toBe(tracking);
    expect(stale.tracking.serverDraftRevision).toBe(7);
    expect(stale.tracking.hasUnsavedChanges).toBe(false);
    const current = reconcileConfirmedSaveGeneration(tracking, {
      submittedGeneration: 2,
      confirmedDocument: doc2,
      confirmedDraftRevision: 7,
    });
    expect(current.isStaleGenerationResponse).toBe(false);
  });
  it("halts automatic retries immediately on DRAFT_REVISION_CONFLICT and preserves local unsaved work", async () => {
    const executeSave = vi.fn(async () => {
      throw new PersistenceError({
        code: "DRAFT_REVISION_CONFLICT",
        publicMessage: "Another session updated this draft.",
        retryable: false,
        conflict: { conflictKind: "draft_revision", expectedRevision: 1, actualRevision: 4 },
      });
    });
    const { coordinator, document } = coordinatorFixture(executeSave, {
      debounceMs: 300,
      maxRetries: 3,
    });
    const doc1 = edited(document, "Conflicting Edit");
    try {
      coordinator.notifyWorkingDocumentChanged(doc1);
      await vi.advanceTimersByTimeAsync(400);
      expect(executeSave).toHaveBeenCalledTimes(1);
      expect(coordinator.getSnapshot().status).toBe("conflict");
      expect(coordinator.getSnapshot().error?.code).toBe("DRAFT_REVISION_CONFLICT");
      expect(coordinator.getSnapshot().isDirty).toBe(true);
      expect(coordinator.getSnapshot().workingDocument).toBe(doc1);
      await vi.advanceTimersByTimeAsync(30000);
      expect(executeSave).toHaveBeenCalledTimes(1);
    } finally {
      coordinator.dispose();
    }
  });
  it("retries transient network errors with bounded exponential backoff and recovers on success", async () => {
    const executeSave = vi
      .fn<(input: StudioSaveDraftInput) => Promise<StudioSaveDraftOutcome>>()
      .mockRejectedValueOnce(
        new PersistenceError({
          code: "DATABASE_UNAVAILABLE",
          publicMessage: "Temporary network error",
          retryable: true,
        }),
      )
      .mockImplementationOnce(async (input) => saved(input.workingDocument, 2));
    const { coordinator, document } = coordinatorFixture(executeSave, {
      debounceMs: 200,
      baseRetryDelayMs: 1000,
      maxRetries: 3,
    });
    try {
      coordinator.notifyWorkingDocumentChanged(edited(document, "Transient Failure Edit"));
      await vi.advanceTimersByTimeAsync(250);
      expect(executeSave).toHaveBeenCalledTimes(1);
      expect(coordinator.getSnapshot().status).toBe("error");
      expect(coordinator.getSnapshot().retryAttempt).toBe(1);
      await vi.advanceTimersByTimeAsync(1100);
      expect(executeSave).toHaveBeenCalledTimes(2);
      expect(coordinator.getSnapshot().status).toBe("saved");
      expect(coordinator.getSnapshot().retryAttempt).toBe(0);
      expect(coordinator.getSnapshot().isDirty).toBe(false);
    } finally {
      coordinator.dispose();
    }
  });
});
