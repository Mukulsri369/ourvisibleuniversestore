import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { updateNodeById } from "../utils/node-tree";
import {
  clearLocalDraftRecoveryCheckpoint,
  evaluateDraftRecoveryCandidate,
  buildRecoveryStorageKey,
  readLocalDraftRecoveryCheckpoint,
  MAX_RECOVERY_RETENTION_MS,
  writeLocalDraftRecoveryCheckpoint,
} from "../recovery";

const scope = { pageKey: "home", userScope: "qa-admin" };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-20T12:05:00Z"));
});
afterEach(() => vi.useRealTimers());

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe("recovery — Session-Scoped Unsaved Draft Recovery & Stale/Security Guards", () => {
  it("writes, validates, and evaluates a recoverable local unsaved checkpoint when it differs from the server draft", () => {
    const storage = createMemoryStorage();
    const serverDoc = createDefaultHomepageDocument();
    const unsavedDoc = updateNodeById(serverDoc, "home-planet-hero", (n) => ({
      ...n,
      props: { ...n.props, title: "Unsaved Local Hero Headline" },
    }));

    const written = writeLocalDraftRecoveryCheckpoint({
      pageKey: "home",
      document: unsavedDoc,
      baseDraftRevision: 3,
      nowMs: Date.parse("2026-04-20T12:00:00.000Z"),
      storage,
      userScope: "qa-admin",
    });
    expect(written).toBe(true);

    const read = readLocalDraftRecoveryCheckpoint(scope, { storage });
    expect(read).not.toBeNull();
    expect(read?.baseDraftRevision).toBe(3);

    const evaluation = evaluateDraftRecoveryCandidate({
      scope,
      storage,
      serverDocument: serverDoc,
      serverDraftRevision: 3,
      nowMs: new Date("2026-04-20T12:05:00.000Z").getTime(),
    });

    expect(evaluation.status).toBe("recoverable");
    if (evaluation.status === "recoverable") {
      expect(evaluation.checkpoint.baseDraftRevision).toBe(evaluation.serverDraftRevision);
      expect(evaluation.checkpoint.document).toEqual(unsavedDoc);
    }
  });

  it("flags checkpoint as stale_against_server when the server draft revision has advanced past baseDraftRevision", () => {
    const storage = createMemoryStorage();
    const serverDoc = createDefaultHomepageDocument();
    const unsavedDoc = updateNodeById(serverDoc, "home-planet-hero", (n) => ({
      ...n,
      name: "Checkpoint from Rev 2",
    }));

    writeLocalDraftRecoveryCheckpoint({
      pageKey: "home",
      document: unsavedDoc,
      baseDraftRevision: 2,
      nowMs: Date.parse("2026-04-20T12:00:00.000Z"),
      storage,
      userScope: "qa-admin",
    });

    const read = readLocalDraftRecoveryCheckpoint(scope, { storage });
    const evaluation = evaluateDraftRecoveryCandidate({
      scope,
      storage,
      serverDocument: serverDoc,
      serverDraftRevision: 5, // Server moved ahead to revision 5!
      nowMs: new Date("2026-04-20T12:05:00.000Z").getTime(),
    });

    expect(evaluation.status).toBe("stale_against_server");
    if (evaluation.status === "stale_against_server") {
      expect(evaluation.checkpoint.baseDraftRevision).toBeLessThan(evaluation.serverDraftRevision);
      expect(evaluation.serverDraftRevision).toBe(5);
    }
  });

  it("treats checkpoint as identical_to_server when the server already has the same document content", () => {
    const storage = createMemoryStorage();
    const serverDoc = createDefaultHomepageDocument();

    writeLocalDraftRecoveryCheckpoint({
      pageKey: "home",
      document: serverDoc,
      baseDraftRevision: 4,
      nowMs: Date.parse("2026-04-20T12:00:00.000Z"),
      storage,
      userScope: "qa-admin",
    });

    const read = readLocalDraftRecoveryCheckpoint(scope, { storage });
    const evaluation = evaluateDraftRecoveryCandidate({
      scope,
      storage,
      serverDocument: serverDoc,
      serverDraftRevision: 4,
      nowMs: new Date("2026-04-20T12:01:00.000Z").getTime(),
    });

    expect(evaluation).toEqual({ status: "none", reason: "identical_to_server" });
    expect(storage.getItem(buildRecoveryStorageKey(scope))).toBeNull();
  });

  it("rejects expired recovery checkpoints and clears invalid/corrupted or token-bearing payloads", () => {
    const storage = createMemoryStorage();
    const serverDoc = createDefaultHomepageDocument();
    const unsavedDoc = updateNodeById(serverDoc, "home-planet-hero", (n) => ({
      ...n,
      name: "Expired Checkpoint",
    }));

    writeLocalDraftRecoveryCheckpoint({
      pageKey: "home",
      document: unsavedDoc,
      baseDraftRevision: 1,
      nowMs: Date.parse("2026-04-01T00:00:00.000Z"),
      storage,
      userScope: "qa-admin",
    });

    const read = readLocalDraftRecoveryCheckpoint(scope, { storage });
    const expiredEval = evaluateDraftRecoveryCandidate({
      scope,
      storage,
      serverDocument: serverDoc,
      serverDraftRevision: 1,
      nowMs: new Date("2026-04-01T00:00:00.000Z").getTime() + MAX_RECOVERY_RETENTION_MS + 1000,
    });
    expect(expiredEval.status).toBe("none");
    expect(storage.getItem(buildRecoveryStorageKey(scope))).toBeNull();

    // Attempt to write a payload containing a JWT / secret token -> must be rejected!
    const docWithSecret = updateNodeById(serverDoc, "home-planet-hero", (n) => ({
      ...n,
      props: {
        ...n.props,
        title:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      },
    }));

    const secretWritten = writeLocalDraftRecoveryCheckpoint({
      pageKey: "home",
      document: docWithSecret,
      baseDraftRevision: 1,
      storage,
      userScope: "qa-admin",
    });
    expect(secretWritten).toBe(false);

    // Corrupted JSON in storage is automatically cleaned up on read
    storage.setItem(buildRecoveryStorageKey(scope), "{corrupted-json");
    const corruptedRead = readLocalDraftRecoveryCheckpoint(scope, { storage });
    expect(corruptedRead).toBeNull();
    expect(storage.getItem(buildRecoveryStorageKey(scope))).toBeNull();

    // Clear removes checkpoint cleanly
    writeLocalDraftRecoveryCheckpoint({
      pageKey: "home",
      document: unsavedDoc,
      baseDraftRevision: 1,
      storage,
      userScope: "qa-admin",
    });
    clearLocalDraftRecoveryCheckpoint(scope, storage);
    expect(readLocalDraftRecoveryCheckpoint(scope, { storage })).toBeNull();
  });
});
