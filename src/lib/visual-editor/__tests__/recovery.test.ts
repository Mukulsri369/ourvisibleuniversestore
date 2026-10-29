import { describe, expect, it } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { updateNodeById } from "../utils/node-tree";
import {
  clearLocalDraftRecoverySnapshot,
  evaluateDraftRecoveryCandidate,
  getDraftRecoveryStorageKey,
  readLocalDraftRecoverySnapshot,
  RECOVERY_SNAPSHOT_MAX_AGE_MS,
  writeLocalDraftRecoverySnapshot,
} from "../recovery";

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
    const unsavedDoc = updateNodeById(serverDoc, "home-hero-planet", (n) => ({
      ...n,
      props: { ...n.props, headline: "Unsaved Local Hero Headline" },
    }));

    const written = writeLocalDraftRecoverySnapshot(
      {
        pageKey: "home",
        document: unsavedDoc,
        baseDraftRevision: 3,
        localEditGeneration: 4,
        savedAt: "2026-04-20T12:00:00.000Z",
      },
      storage,
    );
    expect(written).toBe(true);

    const read = readLocalDraftRecoverySnapshot("home", storage);
    expect(read.ok).toBe(true);
    expect(read.envelope?.baseDraftRevision).toBe(3);

    const evaluation = evaluateDraftRecoveryCandidate({
      envelope: read.envelope,
      pageKey: "home",
      serverDocument: serverDoc,
      serverDraftRevision: 3,
      nowMs: new Date("2026-04-20T12:05:00.000Z").getTime(),
    });

    expect(evaluation.status).toBe("recoverable");
    if (evaluation.status === "recoverable") {
      expect(evaluation.isNewerServerRevision).toBe(false);
      expect(evaluation.envelope.document).toEqual(unsavedDoc);
    }
  });

  it("flags checkpoint as stale_against_server when the server draft revision has advanced past baseDraftRevision", () => {
    const storage = createMemoryStorage();
    const serverDoc = createDefaultHomepageDocument();
    const unsavedDoc = updateNodeById(serverDoc, "home-hero-planet", (n) => ({
      ...n,
      name: "Checkpoint from Rev 2",
    }));

    writeLocalDraftRecoverySnapshot(
      {
        pageKey: "home",
        document: unsavedDoc,
        baseDraftRevision: 2,
        localEditGeneration: 1,
        savedAt: "2026-04-20T12:00:00.000Z",
      },
      storage,
    );

    const read = readLocalDraftRecoverySnapshot("home", storage);
    const evaluation = evaluateDraftRecoveryCandidate({
      envelope: read.envelope,
      pageKey: "home",
      serverDocument: serverDoc,
      serverDraftRevision: 5, // Server moved ahead to revision 5!
      nowMs: new Date("2026-04-20T12:05:00.000Z").getTime(),
    });

    expect(evaluation.status).toBe("stale_against_server");
    if (evaluation.status === "stale_against_server") {
      expect(evaluation.isNewerServerRevision).toBe(true);
      expect(evaluation.serverDraftRevision).toBe(5);
    }
  });

  it("treats checkpoint as identical_to_server when the server already has the same document content", () => {
    const storage = createMemoryStorage();
    const serverDoc = createDefaultHomepageDocument();

    writeLocalDraftRecoverySnapshot(
      {
        pageKey: "home",
        document: serverDoc,
        baseDraftRevision: 4,
        localEditGeneration: 2,
        savedAt: "2026-04-20T12:00:00.000Z",
      },
      storage,
    );

    const read = readLocalDraftRecoverySnapshot("home", storage);
    const evaluation = evaluateDraftRecoveryCandidate({
      envelope: read.envelope,
      pageKey: "home",
      serverDocument: serverDoc,
      serverDraftRevision: 4,
      nowMs: new Date("2026-04-20T12:01:00.000Z").getTime(),
    });

    expect(evaluation.status).toBe("identical_to_server");
  });

  it("rejects expired recovery checkpoints and clears invalid/corrupted or token-bearing payloads", () => {
    const storage = createMemoryStorage();
    const serverDoc = createDefaultHomepageDocument();
    const unsavedDoc = updateNodeById(serverDoc, "home-hero-planet", (n) => ({
      ...n,
      name: "Expired Checkpoint",
    }));

    writeLocalDraftRecoverySnapshot(
      {
        pageKey: "home",
        document: unsavedDoc,
        baseDraftRevision: 1,
        localEditGeneration: 1,
        savedAt: "2026-04-01T00:00:00.000Z",
      },
      storage,
    );

    const read = readLocalDraftRecoverySnapshot("home", storage);
    const expiredEval = evaluateDraftRecoveryCandidate({
      envelope: read.envelope,
      pageKey: "home",
      serverDocument: serverDoc,
      serverDraftRevision: 1,
      nowMs: new Date("2026-04-01T00:00:00.000Z").getTime() + RECOVERY_SNAPSHOT_MAX_AGE_MS + 1000,
    });
    expect(expiredEval.status).toBe("expired");

    // Attempt to write a payload containing a JWT / secret token -> must be rejected!
    const docWithSecret = updateNodeById(serverDoc, "home-hero-planet", (n) => ({
      ...n,
      props: {
        ...n.props,
        headline:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      },
    }));

    const secretWritten = writeLocalDraftRecoverySnapshot(
      {
        pageKey: "home",
        document: docWithSecret,
        baseDraftRevision: 1,
        localEditGeneration: 2,
      },
      storage,
    );
    expect(secretWritten).toBe(false);

    // Corrupted JSON in storage is automatically cleaned up on read
    storage.setItem(getDraftRecoveryStorageKey("home"), "{corrupted-json");
    const corruptedRead = readLocalDraftRecoverySnapshot("home", storage);
    expect(corruptedRead.ok).toBe(false);
    expect(storage.getItem(getDraftRecoveryStorageKey("home"))).toBeNull();

    // Clear removes checkpoint cleanly
    writeLocalDraftRecoverySnapshot(
      {
        pageKey: "home",
        document: unsavedDoc,
        baseDraftRevision: 1,
        localEditGeneration: 1,
      },
      storage,
    );
    clearLocalDraftRecoverySnapshot("home", storage);
    expect(readLocalDraftRecoverySnapshot("home", storage).envelope).toBeNull();
  });
});
