import {
  getDocumentNodeLookupIndex,
  isTargetValidInDocument,
  parseStudioNodeIdentity,
} from "../interactions/index";
import type { PageDocument } from "../schema/page-document";
import type { EditorBreakpoint } from "../schema/responsive";
import {
  executeStructuralCommand,
  type StructuralCommand,
  type StructuralOperationResult,
} from "../structure/index";
import { getAncestorLayerIdsForTarget } from "../studio/studio-selection";
import {
  buildTransactionCoalesceKey,
  describeStructuralCommandForHistory,
  describeStylePathForHistory,
} from "./history-grouping";
import { calculateStackRetainedNodes, DEFAULT_HISTORY_LIMITS } from "./history-limits";
import {
  areDocumentsContentEqual,
  recordEditingTransaction,
  validateHistoryDocumentState,
} from "./history-transactions";
import type {
  ActiveHistoryInteractionSession,
  EditingTransaction,
  HistoryActionType,
  HistoryNavigationOutcome,
  HistoryOrigin,
  HistoryStackLimits,
  HistoryState,
  RecordTransactionOutcome,
} from "./history-types";

export function createInitialHistoryState(
  customLimits?: Partial<HistoryStackLimits>,
): HistoryState {
  return {
    undoStack: [],
    redoStack: [],
    activeInteraction: null,
    limits: {
      ...DEFAULT_HISTORY_LIMITS,
      ...customLimits,
    },
    nextTransactionSequence: 1,
    estimatedRetainedNodes: 0,
    lastError: null,
  };
}

export function canUndoHistory(state: HistoryState): boolean {
  return state.undoStack.length > 0 || state.activeInteraction !== null;
}

export function canRedoHistory(state: HistoryState): boolean {
  return state.redoStack.length > 0 && state.activeInteraction === null;
}

export function getNextUndoTransaction(state: HistoryState): EditingTransaction | null {
  if (state.undoStack.length === 0) return null;
  return state.undoStack[state.undoStack.length - 1] ?? null;
}

export function getNextRedoTransaction(state: HistoryState): EditingTransaction | null {
  if (state.redoStack.length === 0) return null;
  return state.redoStack[state.redoStack.length - 1] ?? null;
}

export function getNextUndoLabel(state: HistoryState): string | null {
  if (state.activeInteraction) {
    return state.activeInteraction.label;
  }
  return getNextUndoTransaction(state)?.label ?? null;
}

export function getNextRedoLabel(state: HistoryState): string | null {
  return getNextRedoTransaction(state)?.label ?? null;
}

/**
 * Reconciles editor selection after an Undo or Redo transition so deleted nodes never leave
 * stale overlays and restored nodes can be selected and revealed in the Layer Tree
 * (Prompt 13, Part 9, Sections 27–29).
 */
export function reconcileSelectionAfterHistoryRestore(
  restoredDocument: PageDocument,
  preferredSelectionId: string | null,
  currentSelectionId: string | null,
  fallbackAffectedNodeIds: readonly string[] = [],
): {
  readonly selectedNodeId: string | null;
  readonly expandLayerIds: readonly string[];
} {
  if (preferredSelectionId && isTargetValidInDocument(restoredDocument, preferredSelectionId)) {
    return {
      selectedNodeId: preferredSelectionId,
      expandLayerIds: getAncestorLayerIdsForTarget(restoredDocument, preferredSelectionId),
    };
  }

  for (const affectedId of fallbackAffectedNodeIds) {
    if (isTargetValidInDocument(restoredDocument, affectedId)) {
      return {
        selectedNodeId: affectedId,
        expandLayerIds: getAncestorLayerIdsForTarget(restoredDocument, affectedId),
      };
    }
  }

  if (currentSelectionId && isTargetValidInDocument(restoredDocument, currentSelectionId)) {
    return {
      selectedNodeId: currentSelectionId,
      expandLayerIds: getAncestorLayerIdsForTarget(restoredDocument, currentSelectionId),
    };
  }

  // If the current selection was inside a removed child, try selecting its surviving parent
  if (currentSelectionId) {
    const identity = parseStudioNodeIdentity(currentSelectionId);
    if (identity?.documentNodeId) {
      const index = getDocumentNodeLookupIndex(restoredDocument);
      if (index.nodeById.has(identity.documentNodeId)) {
        return {
          selectedNodeId: identity.documentNodeId,
          expandLayerIds: getAncestorLayerIdsForTarget(restoredDocument, identity.documentNodeId),
        };
      }
    }
  }

  return {
    selectedNodeId: null,
    expandLayerIds: [],
  };
}

/**
 * Begins an explicit continuous interaction session (e.g., pointer down on a slider,
 * color picker, or future canvas drag/resize handle) (Prompt 13, Part 6, Sections 17 & 19).
 */
export function beginHistoryInteraction(
  state: HistoryState,
  params: {
    readonly groupKey: string;
    readonly actionType: HistoryActionType;
    readonly label: string;
    readonly affectedNodeIds: readonly string[];
    readonly baselineDocument: PageDocument;
    readonly baselineSelectionId: string | null;
    readonly origin?: HistoryOrigin;
    readonly breakpoint?: EditorBreakpoint;
    readonly propertyPath?: string;
    readonly timestamp?: number;
  },
): HistoryState {
  const now = params.timestamp ?? Date.now();
  // If an earlier interaction was left open, commit it first before starting the new one
  const baseState = state.activeInteraction ? commitHistoryInteraction(state, now).state : state;

  const session: ActiveHistoryInteractionSession = {
    sessionId: `session-${baseState.nextTransactionSequence}-${now}`,
    groupKey: params.groupKey,
    actionType: params.actionType,
    label: params.label,
    origin: params.origin ?? "inspector",
    breakpoint: params.breakpoint,
    propertyPath: params.propertyPath,
    affectedNodeIds: params.affectedNodeIds,
    baselineDocument: params.baselineDocument,
    baselineSelectionId: params.baselineSelectionId,
    latestDocument: params.baselineDocument,
    latestSelectionId: params.baselineSelectionId,
    startedAt: now,
    updatedAt: now,
    stepCount: 0,
  };

  return {
    ...baseState,
    activeInteraction: session,
    lastError: null,
  };
}

/**
 * Updates the transient document inside an active continuous interaction session without
 * pushing intermediate history entries per pointer move.
 */
export function updateHistoryInteraction(
  state: HistoryState,
  nextDocument: PageDocument,
  nextSelectionId?: string | null,
  timestamp?: number,
): {
  readonly ok: boolean;
  readonly state: HistoryState;
  readonly document: PageDocument;
} {
  if (!state.activeInteraction) {
    return {
      ok: false,
      state: {
        ...state,
        lastError: {
          code: "INTERACTION_NOT_ACTIVE",
          message: "No active interaction session to update.",
        },
      },
      document: nextDocument,
    };
  }

  const validated = validateHistoryDocumentState(nextDocument);
  if (!validated.valid) {
    return {
      ok: false,
      state: {
        ...state,
        lastError: validated.error ?? {
          code: "INVALID_TRANSACTION",
          message: "Transient interaction update failed validation.",
        },
      },
      document: state.activeInteraction.latestDocument,
    };
  }

  const now = timestamp ?? Date.now();
  return {
    ok: true,
    state: {
      ...state,
      activeInteraction: {
        ...state.activeInteraction,
        latestDocument: nextDocument,
        latestSelectionId:
          nextSelectionId !== undefined
            ? nextSelectionId
            : state.activeInteraction.latestSelectionId,
        updatedAt: now,
        stepCount: state.activeInteraction.stepCount + 1,
      },
      redoStack: [],
      lastError: null,
    },
    document: nextDocument,
  };
}

/**
 * Commits an active continuous interaction session as a single logical Undo transaction.
 * If the final document equals `baselineDocument`, no history entry is added.
 */
export function commitHistoryInteraction(
  state: HistoryState,
  timestamp?: number,
): RecordTransactionOutcome {
  const session = state.activeInteraction;
  if (!session) {
    return {
      ok: false,
      recorded: false,
      coalesced: false,
      state,
      document: DEFAULT_HISTORY_LIMITS as unknown as PageDocument,
      transaction: null,
      error: {
        code: "INTERACTION_NOT_ACTIVE",
        message: "No active interaction session to commit.",
      },
    };
  }

  const clearedState: HistoryState = {
    ...state,
    activeInteraction: null,
  };

  if (areDocumentsContentEqual(session.baselineDocument, session.latestDocument)) {
    return {
      ok: true,
      recorded: false,
      coalesced: false,
      state: clearedState,
      document: session.baselineDocument,
      transaction: null,
      error: null,
    };
  }

  return recordEditingTransaction(clearedState, {
    actionType: session.actionType,
    label: session.label,
    affectedNodeIds: session.affectedNodeIds,
    origin: session.origin,
    breakpoint: session.breakpoint,
    propertyPath: session.propertyPath,
    previousDocument: session.baselineDocument,
    nextDocument: session.latestDocument,
    previousSelectionId: session.baselineSelectionId,
    nextSelectionId: session.latestSelectionId,
    coalesceKey: session.groupKey,
    allowCoalesce: false,
    timestamp: timestamp ?? session.updatedAt,
  });
}

/**
 * Cancels/aborts an active continuous interaction session and restores `baselineDocument`
 * without committing any history transaction (Prompt 13, Part 25, Section 81).
 */
export function cancelHistoryInteraction(
  state: HistoryState,
  currentDocument: PageDocument,
  currentSelectedId: string | null,
): HistoryNavigationOutcome {
  if (!state.activeInteraction) {
    return {
      ok: false,
      state,
      document: currentDocument,
      selectedNodeId: currentSelectedId,
      expandLayerIds: [],
      transaction: null,
      error: {
        code: "INTERACTION_NOT_ACTIVE",
        message: "No active interaction session to cancel.",
      },
    };
  }

  const { baselineDocument, baselineSelectionId, affectedNodeIds } = state.activeInteraction;
  const reconciled = reconcileSelectionAfterHistoryRestore(
    baselineDocument,
    baselineSelectionId,
    currentSelectedId,
    affectedNodeIds,
  );

  return {
    ok: true,
    state: {
      ...state,
      activeInteraction: null,
      lastError: null,
    },
    document: baselineDocument,
    selectedNodeId: reconciled.selectedNodeId,
    expandLayerIds: reconciled.expandLayerIds,
    transaction: null,
    error: null,
  };
}

/**
 * Global Undo operation (Prompt 13, Part 4, Sections 10–12).
 * - Restores the previous valid `PageDocument` state.
 * - Preserves original node identities and structural sharing references.
 * - Moves the undone transaction to `redoStack`.
 * - Safely rejects corrupted history entries without mutating the current valid working document.
 */
export function undoEditingTransaction(
  state: HistoryState,
  currentDocument: PageDocument,
  currentSelectedId: string | null,
): HistoryNavigationOutcome {
  // If an interaction is mid-flight, cancel it back to its baseline first
  if (state.activeInteraction) {
    return cancelHistoryInteraction(state, currentDocument, currentSelectedId);
  }

  if (state.undoStack.length === 0) {
    const error = {
      code: "EMPTY_UNDO_STACK" as const,
      message: "Nothing to undo.",
    };
    return {
      ok: false,
      state: {
        ...state,
        lastError: error,
      },
      document: currentDocument,
      selectedNodeId: currentSelectedId,
      expandLayerIds: [],
      transaction: null,
      error,
    };
  }

  const targetTx = state.undoStack[state.undoStack.length - 1];
  const validated = validateHistoryDocumentState(targetTx.previousDocument);
  if (!validated.valid || !validated.document) {
    const error = {
      code: "HISTORY_RESTORE_INVALID_DOCUMENT" as const,
      message:
        validated.error?.message ??
        `Cannot undo "${targetTx.label}" because the target document state is invalid.`,
      transactionId: targetTx.id,
    };
    return {
      ok: false,
      state: {
        ...state,
        lastError: error,
      },
      document: currentDocument,
      selectedNodeId: currentSelectedId,
      expandLayerIds: [],
      transaction: targetTx,
      error,
    };
  }

  const nextUndoStack = state.undoStack.slice(0, -1);
  const nextRedoStack = [...state.redoStack, targetTx];

  const reconciled = reconcileSelectionAfterHistoryRestore(
    validated.document,
    targetTx.previousSelectionId,
    currentSelectedId,
    targetTx.affectedNodeIds,
  );

  return {
    ok: true,
    state: {
      ...state,
      undoStack: nextUndoStack,
      redoStack: nextRedoStack,
      estimatedRetainedNodes: calculateStackRetainedNodes(nextUndoStack),
      lastError: null,
    },
    document: validated.document,
    selectedNodeId: reconciled.selectedNodeId,
    expandLayerIds: reconciled.expandLayerIds,
    transaction: targetTx,
    error: null,
  };
}

/**
 * Global Redo operation (Prompt 13, Part 5, Sections 13–15).
 * - Reapplies the most recently undone valid transaction.
 * - Moves the reapplied transaction back to `undoStack`.
 * - Safely rejects corrupted history entries without mutating the current valid working document.
 */
export function redoEditingTransaction(
  state: HistoryState,
  currentDocument: PageDocument,
  currentSelectedId: string | null,
): HistoryNavigationOutcome {
  if (state.redoStack.length === 0 || state.activeInteraction !== null) {
    const error = {
      code: "EMPTY_REDO_STACK" as const,
      message: "Nothing to redo.",
    };
    return {
      ok: false,
      state: {
        ...state,
        lastError: error,
      },
      document: currentDocument,
      selectedNodeId: currentSelectedId,
      expandLayerIds: [],
      transaction: null,
      error,
    };
  }

  const targetTx = state.redoStack[state.redoStack.length - 1];
  const validated = validateHistoryDocumentState(targetTx.nextDocument);
  if (!validated.valid || !validated.document) {
    const error = {
      code: "HISTORY_RESTORE_INVALID_DOCUMENT" as const,
      message:
        validated.error?.message ??
        `Cannot redo "${targetTx.label}" because the target document state is invalid.`,
      transactionId: targetTx.id,
    };
    return {
      ok: false,
      state: {
        ...state,
        lastError: error,
      },
      document: currentDocument,
      selectedNodeId: currentSelectedId,
      expandLayerIds: [],
      transaction: targetTx,
      error,
    };
  }

  const nextRedoStack = state.redoStack.slice(0, -1);
  const nextUndoStack = [...state.undoStack, targetTx];

  const reconciled = reconcileSelectionAfterHistoryRestore(
    validated.document,
    targetTx.nextSelectionId,
    currentSelectedId,
    targetTx.affectedNodeIds,
  );

  return {
    ok: true,
    state: {
      ...state,
      undoStack: nextUndoStack,
      redoStack: nextRedoStack,
      estimatedRetainedNodes: calculateStackRetainedNodes(nextUndoStack),
      lastError: null,
    },
    document: validated.document,
    selectedNodeId: reconciled.selectedNodeId,
    expandLayerIds: reconciled.expandLayerIds,
    transaction: targetTx,
    error: null,
  };
}

/**
 * Executes a Prompt 11 structural command (`executeStructuralCommand`) and records it
 * atomically in the unified editing history stack (Prompt 13, Part 18, Sections 57–59).
 */
export function executeStructuralCommandWithHistory(
  historyState: HistoryState,
  document: PageDocument,
  command: StructuralCommand,
  currentSelectedNodeId: string | null = null,
  options?: {
    readonly origin?: HistoryOrigin;
    readonly timestamp?: number;
  },
): {
  readonly operationResult: StructuralOperationResult;
  readonly historyOutcome: RecordTransactionOutcome | null;
  readonly historyState: HistoryState;
} {
  const descriptor = describeStructuralCommandForHistory(command, document);
  const opResult = executeStructuralCommand(document, command, currentSelectedNodeId);

  if (!opResult.ok || opResult.document === document) {
    return {
      operationResult: opResult,
      historyOutcome: null,
      historyState,
    };
  }

  const affectedIds =
    opResult.affectedNodeIds && opResult.affectedNodeIds.length > 0
      ? opResult.affectedNodeIds
      : "targetId" in command
        ? [command.targetId]
        : command.parentTargetId
          ? [command.parentTargetId]
          : [];

  const nextSelectionId =
    opResult.selectedNodeId !== undefined ? opResult.selectedNodeId : currentSelectedNodeId;

  const historyOutcome = recordEditingTransaction(historyState, {
    actionType: descriptor.actionType,
    label: descriptor.label,
    affectedNodeIds: affectedIds,
    origin: options?.origin ?? "layers_panel",
    breakpoint: command.type === "SetVisibility" ? command.breakpoint : undefined,
    previousDocument: document,
    nextDocument: opResult.document,
    previousSelectionId: currentSelectedNodeId,
    nextSelectionId,
    coalesceKey: descriptor.coalesceKey,
    allowCoalesce: descriptor.coalesceKey !== null,
    timestamp: options?.timestamp,
  });

  return {
    operationResult: opResult,
    historyOutcome,
    historyState: historyOutcome.state,
  };
}

/**
 * Helper to record a validated Inspector property/style mutation result into the unified
 * editing history stack (Prompt 13, Part 19, Sections 60–62).
 */
export function recordPropertyMutationInHistory(
  historyState: HistoryState,
  previousDocument: PageDocument,
  mutationResult: {
    readonly ok: boolean;
    readonly document: PageDocument;
    readonly error?: string;
  },
  metadata: {
    readonly targetNodeId: string;
    readonly currentSelectedNodeId: string | null;
    readonly actionType: HistoryActionType;
    readonly propertyPath: string;
    readonly breakpoint?: EditorBreakpoint;
    readonly isReset?: boolean;
    readonly customLabel?: string;
    readonly allowCoalesce?: boolean;
    readonly origin?: HistoryOrigin;
    readonly timestamp?: number;
  },
): {
  readonly ok: boolean;
  readonly document: PageDocument;
  readonly historyState: HistoryState;
  readonly historyOutcome: RecordTransactionOutcome | null;
  readonly error?: string;
} {
  if (!mutationResult.ok) {
    return {
      ok: false,
      document: previousDocument,
      historyState,
      historyOutcome: null,
      error: mutationResult.error,
    };
  }

  if (mutationResult.document === previousDocument) {
    return {
      ok: true,
      document: previousDocument,
      historyState,
      historyOutcome: null,
    };
  }

  const label =
    metadata.customLabel ??
    describeStylePathForHistory(
      metadata.propertyPath,
      metadata.breakpoint,
      Boolean(metadata.isReset),
    );

  const coalesceKey =
    metadata.allowCoalesce === false || metadata.isReset
      ? null
      : buildTransactionCoalesceKey({
          actionType: metadata.actionType,
          targetNodeId: metadata.targetNodeId,
          propertyPath: metadata.propertyPath,
          breakpoint: metadata.breakpoint,
        });

  const outcome = recordEditingTransaction(historyState, {
    actionType: metadata.actionType,
    label,
    affectedNodeIds: [metadata.targetNodeId],
    origin: metadata.origin ?? "inspector",
    breakpoint: metadata.breakpoint,
    propertyPath: metadata.propertyPath,
    previousDocument,
    nextDocument: mutationResult.document,
    previousSelectionId: metadata.currentSelectedNodeId ?? metadata.targetNodeId,
    nextSelectionId: metadata.currentSelectedNodeId ?? metadata.targetNodeId,
    coalesceKey,
    allowCoalesce: coalesceKey !== null,
    timestamp: metadata.timestamp,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      document: previousDocument,
      historyState: outcome.state,
      historyOutcome: outcome,
      error: outcome.error?.message ?? "Failed to record property history transaction.",
    };
  }

  return {
    ok: true,
    document: outcome.document,
    historyState: outcome.state,
    historyOutcome: outcome,
  };
}
