import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { updateNodeById } from "../tree";
import {
  createAutosaveCoordinator,
  createRevisionTrackingState,
  createSingleFlightSaveQueue,
  markPersistedSnapshot,
  registerLocalMutation,
  shouldAcceptServerSaveResponse,
  type SaveRequestOutcome,
} from "../autosave";

describe("save-race-conditions — Single-Flight Queue, Generation Tracking & Conflict Safety", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves newer local edits (Gen 11) made while an older save (Gen 10) is in flight and updates expectedDraftRevision", async () => {
    const doc0 = createDefaultHomepageDocument();
    const docGen10 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      name: "Gen 10 Edit",
    }));
    const docGen11 = updateNodeById(docGen10, "home-hero-planet", (n) => ({
      ...n,
      name: "Gen 11 Newer Edit During Save",
    }));

    let revState = createRevisionTrackingState(doc0, 1);

    // Gen 1 (representing Gen 10)
    revState = registerLocalMutation(revState, docGen10);
    const gen10 = revState.localEditGeneration;

    let resolveFirstSave!: (outcome: SaveRequestOutcome) => void;
    const executeSave = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<SaveRequestOutcome>((resolve) => {
            resolveFirstSave = resolve;
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        draftRevision: 3,
        savedAt: "2026-04-20T12:00:02.000Z",
      });

    const queue = createSingleFlightSaveQueue(executeSave);

    // Start saving Gen 10
    const firstSavePromise = queue.enqueue({
      document: docGen10,
      generation: gen10,
      expectedDraftRevision: 1,
      trigger: "autosave",
    });

    // While Gen 10 is in flight, user makes Gen 11 edit!
    revState = registerLocalMutation(revState, docGen11);
    const gen11 = revState.localEditGeneration;

    const secondSavePromise = queue.enqueue({
      document: docGen11,
      generation: gen11,
      expectedDraftRevision: 1, // queued with old revision 1, queue must upgrade to 2!
      trigger: "autosave",
    });

    // Complete first save with server revision 2
    resolveFirstSave({
      ok: true,
      draftRevision: 2,
      savedAt: "2026-04-20T12:00:01.000Z",
    });

    const firstOutcome = await firstSavePromise;
    expect(firstOutcome.ok).toBe(true);

    // Update revision state upon first save completion while workingDocument is already docGen11
    revState = markPersistedSnapshot(revState, {
      savedDocument: docGen10,
      savedGeneration: gen10,
      newServerDraftRevision: 2,
      currentWorkingDocument: docGen11,
    });

    // Working state MUST still be dirty because Gen 11 !== Gen 10!
    expect(revState.isDirty).toBe(true);
    expect(revState.serverDraftRevision).toBe(2);

    const secondOutcome = await secondSavePromise;
    expect(secondOutcome.ok).toBe(true);

    // Verify the second save automatically used the updated expectedDraftRevision (2) from the first save!
    expect(executeSave).toHaveBeenCalledTimes(2);
    expect(executeSave).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        document: docGen11,
        generation: gen11,
        expectedDraftRevision: 2,
      }),
    );

    // Now mark Gen 11 persisted
    revState = markPersistedSnapshot(revState, {
      savedDocument: docGen11,
      savedGeneration: gen11,
      newServerDraftRevision: 3,
      currentWorkingDocument: docGen11,
    });
    expect(revState.isDirty).toBe(false);
    expect(revState.serverDraftRevision).toBe(3);
  });

  it("ignores stale/out-of-order server save responses that are older than already-persisted generations", () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      name: "Gen 1",
    }));
    const doc2 = updateNodeById(doc1, "home-hero-planet", (n) => ({
      ...n,
      name: "Gen 2",
    }));

    let revState = createRevisionTrackingState(doc0, 5);
    revState = registerLocalMutation(revState, doc1);
    revState = registerLocalMutation(revState, doc2);

    revState = markPersistedSnapshot(revState, {
      savedDocument: doc2,
      savedGeneration: 2,
      newServerDraftRevision: 7,
      currentWorkingDocument: doc2,
    });

    // Stale response for generation 1 arrives late with revision 6
    expect(
      shouldAcceptServerSaveResponse(revState, {
        responseGeneration: 1,
        responseDraftRevision: 6,
      }),
    ).toBe(false);

    // Valid newer response is accepted
    expect(
      shouldAcceptServerSaveResponse(revState, {
        responseGeneration: 2,
        responseDraftRevision: 7,
      }),
    ).toBe(true);
  });

  it("halts automatic retries immediately on DRAFT_REVISION_CONFLICT and preserves local unsaved work", async () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      name: "Conflicting Edit",
    }));

    const executeSave = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "DRAFT_REVISION_CONFLICT",
        publicMessage: "Another session updated this draft.",
        status: 409,
        retryable: false,
        conflict: {
          pageKey: "home",
          expectedRevision: 1,
          actualRevision: 4,
          updatedAt: "2026-04-20T12:00:00.000Z",
        },
      },
    });

    const snapshots: string[] = [];
    const coordinator = createAutosaveCoordinator({
      config: {
        debounceMs: 300,
        maxRetryAttempts: 3,
      },
      executeSave,
      onStateChange: (s) => snapshots.push(s.status),
    });

    coordinator.scheduleAutosave({
      document: doc1,
      generation: 1,
      expectedDraftRevision: 1,
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(executeSave).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe("conflict");
    expect(coordinator.getState().lastError?.code).toBe("DRAFT_REVISION_CONFLICT");

    // Advance timers by 30 seconds -> must NOT retry after a revision conflict!
    await vi.advanceTimersByTimeAsync(30_000);
    expect(executeSave).toHaveBeenCalledTimes(1);

    coordinator.dispose();
  });

  it("retries transient network errors with bounded exponential backoff and recovers on success", async () => {
    const doc0 = createDefaultHomepageDocument();
    const doc1 = updateNodeById(doc0, "home-hero-planet", (n) => ({
      ...n,
      name: "Transient Failure Edit",
    }));

    const executeSave = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          publicMessage: "Temporary network error",
          status: 503,
          retryable: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        draftRevision: 2,
        savedAt: "2026-04-20T12:05:00.000Z",
      });

    const coordinator = createAutosaveCoordinator({
      config: {
        debounceMs: 200,
        baseRetryDelayMs: 1000,
        maxRetryDelayMs: 5000,
        maxRetryAttempts: 3,
      },
      executeSave,
    });

    coordinator.scheduleAutosave({
      document: doc1,
      generation: 1,
      expectedDraftRevision: 1,
    });

    // Trigger initial debounced save -> fails with retryable NETWORK_ERROR
    await vi.advanceTimersByTimeAsync(250);
    expect(executeSave).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe("error");
    expect(coordinator.getState().retryAttempt).toBe(1);

    // Advance past 1st retry backoff (1000ms) -> succeeds!
    await vi.advanceTimersByTimeAsync(1100);
    expect(executeSave).toHaveBeenCalledTimes(2);
    expect(coordinator.getState().status).toBe("saved");
    expect(coordinator.getState().retryAttempt).toBe(0);

    coordinator.dispose();
  });
});
