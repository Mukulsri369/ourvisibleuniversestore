import type { PageDocument } from "../schema/page-document";
import { safeParsePageDocument } from "../schema/validation";
import { validateStructuralDocumentIntegrity } from "../structure/index";
import { shouldCoalesceTransactions } from "./history-grouping";
import {
  calculateStackRetainedNodes,
  estimateTransactionNodeAllocations,
  pruneHistoryStackToLimits,
} from "./history-limits";
import type {
  EditingTransaction,
  HistoryOperationError,
  HistoryState,
  RecordTransactionInput,
  RecordTransactionOutcome,
} from "./history-types";

/**
 * Computes a deterministic content fingerprint for a `PageDocument` that ignores
 * `metadata.updatedAt` so UI/timestamp updates are never treated as substantive design edits
 * (Prompt 13, Part 10, Section 34 & Part 16, Section 53).
 */
export function computeDocumentContentFingerprint(document: PageDocument): string {
  return JSON.stringify({
    id: document.id,
    name: document.name,
    slug: document.slug,
    schemaVersion: document.schemaVersion,
    settings: document.settings,
    root: document.root,
  });
}

/**
 * Checks whether two `PageDocument` states are substantively equal in content.
 * Fast-paths reference equality in O(1) time.
 */
export function areDocumentsContentEqual(a: PageDocument, b: PageDocument): boolean {
  if (a === b) return true;
  if (
    a.root === b.root &&
    a.name === b.name &&
    a.slug === b.slug &&
    a.schemaVersion === b.schemaVersion &&
    a.settings === b.settings
  ) {
    return true;
  }
  return (
    a.name === b.name &&
    a.slug === b.slug &&
    a.schemaVersion === b.schemaVersion &&
    JSON.stringify(a.settings) === JSON.stringify(b.settings) &&
    JSON.stringify(a.root) === JSON.stringify(b.root)
  );
}

/**
 * Validates that a candidate `PageDocument` (before recording or before restoring via Undo/Redo)
 * satisfies both structural hierarchy rules and the `PageDocument` schema contract
 * (Prompt 13, Part 4, Section 12 & Part 18, Section 58).
 */
export function validateHistoryDocumentState(document: unknown): {
  readonly valid: boolean;
  readonly document?: PageDocument;
  readonly error?: HistoryOperationError;
} {
  if (!document || typeof document !== "object") {
    return {
      valid: false,
      error: {
        code: "HISTORY_RESTORE_INVALID_DOCUMENT",
        message: "Target history document is null or not a valid object.",
      },
    };
  }

  const candidate = document as PageDocument;
  if (
    typeof candidate.id !== "string" ||
    !Array.isArray(candidate.root) ||
    typeof candidate.schemaVersion !== "string"
  ) {
    return {
      valid: false,
      error: {
        code: "HISTORY_RESTORE_INVALID_DOCUMENT",
        message: "Target history document is missing required root or schemaVersion fields.",
      },
    };
  }

  const structuralIntegrity = validateStructuralDocumentIntegrity(candidate);
  if (!structuralIntegrity.valid) {
    return {
      valid: false,
      error: {
        code: "HISTORY_RESTORE_INVALID_DOCUMENT",
        message:
          structuralIntegrity.message ?? "History document failed structural hierarchy validation.",
      },
    };
  }

  const schemaValidation = safeParsePageDocument(candidate);
  if (!schemaValidation.success) {
    return {
      valid: false,
      error: {
        code: "HISTORY_RESTORE_INVALID_DOCUMENT",
        message:
          schemaValidation.issues[0]?.message ??
          "History document failed PageDocument schema validation.",
      },
    };
  }

  return {
    valid: true,
    document: candidate,
  };
}

/**
 * Records a validated editing transaction into `HistoryState`:
 * - Rejects invalid or corrupted documents without mutating state.
 * - Ignores no-op changes where `previousDocument` and `nextDocument` have identical content.
 * - Coalesces rapid continuous updates (slider drag, color scrubbing, text input) when
 *   `allowCoalesce !== false` and `shouldCoalesceTransactions` matches.
 * - Drops a coalesced transaction if the user returned the control to its original `previousDocument` value.
 * - Clears `redoStack` whenever a new edit is recorded (Prompt 13, Part 5, Section 14).
 * - Enforces bounded history limits (`maxTransactions` and `maxEstimatedRetainedNodes`).
 */
export function recordEditingTransaction(
  state: HistoryState,
  input: RecordTransactionInput,
): RecordTransactionOutcome {
  const now = input.timestamp ?? Date.now();
  const origin = input.origin ?? "inspector";
  const allowCoalesce = input.allowCoalesce ?? true;
  const coalesceKey = input.coalesceKey ?? null;

  const validatedNext = validateHistoryDocumentState(input.nextDocument);
  if (!validatedNext.valid) {
    const err: HistoryOperationError = validatedNext.error ?? {
      code: "INVALID_TRANSACTION",
      message: "Rejected invalid document in editing transaction.",
    };
    return {
      ok: false,
      recorded: false,
      coalesced: false,
      state: {
        ...state,
        lastError: err,
      },
      document: input.previousDocument,
      transaction: null,
      error: err,
    };
  }

  // If an explicit interaction session is open with the same groupKey, update the session in place
  if (
    state.activeInteraction &&
    coalesceKey &&
    state.activeInteraction.groupKey === coalesceKey
  ) {
    const updatedSession = {
      ...state.activeInteraction,
      latestDocument: input.nextDocument,
      latestSelectionId: input.nextSelectionId ?? state.activeInteraction.latestSelectionId,
      updatedAt: now,
      stepCount: state.activeInteraction.stepCount + 1,
    };
    return {
      ok: true,
      recorded: false,
      coalesced: true,
      state: {
        ...state,
        activeInteraction: updatedSession,
        redoStack: [],
        lastError: null,
      },
      document: input.nextDocument,
      transaction: null,
      error: null,
    };
  }

  // Check if this update can coalesce with the top of the Undo stack
  const topUndo = state.undoStack[state.undoStack.length - 1];
  const canCoalesceWithTop =
    allowCoalesce &&
    shouldCoalesceTransactions(
      topUndo,
      {
        coalesceKey,
        actionType: input.actionType,
        origin,
        timestamp: now,
      },
      state.limits.coalescingWindowMs,
    );

  if (!canCoalesceWithTop && areDocumentsContentEqual(input.previousDocument, input.nextDocument)) {
    return {
      ok: true,
      recorded: false,
      coalesced: false,
      state,
      document: input.previousDocument,
      transaction: null,
      error: null,
    };
  }

  if (canCoalesceWithTop && topUndo) {
    // If the user dragged a slider/input back to the exact original value before the gesture started,
    // remove the coalesced transaction so no net no-op entry remains in history.
    if (areDocumentsContentEqual(topUndo.previousDocument, input.nextDocument)) {
      const poppedStack = state.undoStack.slice(0, -1);
      return {
        ok: true,
        recorded: false,
        coalesced: true,
        state: {
          ...state,
          undoStack: poppedStack,
          redoStack: [],
          estimatedRetainedNodes: calculateStackRetainedNodes(poppedStack),
          lastError: null,
        },
        document: topUndo.previousDocument,
        transaction: null,
        error: null,
      };
    }

    const allocated = estimateTransactionNodeAllocations(
      topUndo.previousDocument,
      input.nextDocument,
    );
    const mergedTx: EditingTransaction = {
      ...topUndo,
      label: input.label || topUndo.label,
      nextDocument: input.nextDocument,
      nextSelectionId:
        input.nextSelectionId !== undefined ? input.nextSelectionId : topUndo.nextSelectionId,
      updatedAt: now,
      coalescedCount: topUndo.coalescedCount + 1,
      estimatedAllocatedNodes: allocated,
    };

    const nextStack = [...state.undoStack.slice(0, -1), mergedTx];
    const pruned = pruneHistoryStackToLimits(nextStack, state.limits);

    return {
      ok: true,
      recorded: true,
      coalesced: true,
      state: {
        ...state,
        undoStack: pruned.prunedStack,
        redoStack: [],
        estimatedRetainedNodes: pruned.estimatedRetainedNodes,
        lastError: null,
      },
      document: input.nextDocument,
      transaction: mergedTx,
      error: null,
    };
  }

  const txId = `tx-${state.nextTransactionSequence}`;
  const allocatedNodes = estimateTransactionNodeAllocations(
    input.previousDocument,
    input.nextDocument,
  );

  const newTx: EditingTransaction = {
    id: txId,
    actionType: input.actionType,
    label: input.label,
    affectedNodeIds: input.affectedNodeIds,
    origin,
    breakpoint: input.breakpoint,
    propertyPath: input.propertyPath,
    previousDocument: input.previousDocument,
    nextDocument: input.nextDocument,
    previousSelectionId: input.previousSelectionId ?? null,
    nextSelectionId: input.nextSelectionId ?? input.previousSelectionId ?? null,
    createdAt: now,
    updatedAt: now,
    coalesceKey,
    coalescedCount: 1,
    committed: true,
    undoable: true,
    estimatedAllocatedNodes: allocatedNodes,
  };

  const appendedStack = [...state.undoStack, newTx];
  const pruned = pruneHistoryStackToLimits(appendedStack, state.limits);

  return {
    ok: true,
    recorded: true,
    coalesced: false,
    state: {
      ...state,
      undoStack: pruned.prunedStack,
      redoStack: [],
      nextTransactionSequence: state.nextTransactionSequence + 1,
      estimatedRetainedNodes: pruned.estimatedRetainedNodes,
      lastError: null,
    },
    document: input.nextDocument,
    transaction: newTx,
    error: null,
  };
}
