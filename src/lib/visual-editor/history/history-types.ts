import type { PageDocument } from "../schema/page-document";
import type { EditorBreakpoint } from "../schema/responsive";

export type HistoryActionType =
  | "structural.rename"
  | "structural.reorder"
  | "structural.move"
  | "structural.duplicate"
  | "structural.visibility"
  | "structural.lock"
  | "structural.remove"
  | "structural.wrap"
  | "structural.unwrap"
  | "structural.create_container"
  | "property.content"
  | "property.style"
  | "property.spacing"
  | "property.appearance"
  | "property.reset"
  | "property.reset_breakpoint"
  | "interaction.direct_manipulation"
  | "document.batch"
  | "document.revert";

export type HistoryOrigin =
  | "layers_panel"
  | "inspector"
  | "toolbar"
  | "keyboard"
  | "canvas"
  | "programmatic";

/**
 * Authoritative editing transaction metadata recorded in the local Undo/Redo stack
 * (Prompt 13, Part 3, Section 8).
 *
 * Security & Immutability Invariants:
 * - `previousDocument` and `nextDocument` are immutable, structurally shared `PageDocument` states.
 * - Never stores credentials, tokens, or protected customer/product database records.
 */
export interface EditingTransaction {
  readonly id: string;
  readonly actionType: HistoryActionType;
  readonly label: string;
  readonly affectedNodeIds: readonly string[];
  readonly origin: HistoryOrigin;
  readonly breakpoint?: EditorBreakpoint;
  readonly propertyPath?: string;
  readonly previousDocument: PageDocument;
  readonly nextDocument: PageDocument;
  readonly previousSelectionId: string | null;
  readonly nextSelectionId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly coalesceKey: string | null;
  readonly coalescedCount: number;
  readonly committed: boolean;
  readonly undoable: boolean;
  readonly estimatedAllocatedNodes: number;
}

/**
 * Represents an in-progress continuous user interaction (slider drag, color scrubbing,
 * text input editing, or future direct canvas drag/resize/rotate gesture) before final commit
 * (Prompt 13, Part 6, Sections 16–19).
 */
export interface ActiveHistoryInteractionSession {
  readonly sessionId: string;
  readonly groupKey: string;
  readonly actionType: HistoryActionType;
  readonly label: string;
  readonly origin: HistoryOrigin;
  readonly breakpoint?: EditorBreakpoint;
  readonly propertyPath?: string;
  readonly affectedNodeIds: readonly string[];
  readonly baselineDocument: PageDocument;
  readonly baselineSelectionId: string | null;
  readonly latestDocument: PageDocument;
  readonly latestSelectionId: string | null;
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly stepCount: number;
}

export interface HistoryStackLimits {
  readonly maxTransactions: number;
  readonly maxEstimatedRetainedNodes: number;
  readonly coalescingWindowMs: number;
}

export type HistoryOperationErrorCode =
  | "EMPTY_UNDO_STACK"
  | "EMPTY_REDO_STACK"
  | "NO_OP_TRANSACTION"
  | "INVALID_TRANSACTION"
  | "HISTORY_RESTORE_INVALID_DOCUMENT"
  | "INTERACTION_NOT_ACTIVE";

export interface HistoryOperationError {
  readonly code: HistoryOperationErrorCode;
  readonly message: string;
  readonly transactionId?: string;
}

export interface HistoryState {
  readonly undoStack: readonly EditingTransaction[];
  readonly redoStack: readonly EditingTransaction[];
  readonly activeInteraction: ActiveHistoryInteractionSession | null;
  readonly limits: HistoryStackLimits;
  readonly nextTransactionSequence: number;
  readonly estimatedRetainedNodes: number;
  readonly lastError: HistoryOperationError | null;
}

export interface RecordTransactionInput {
  readonly actionType: HistoryActionType;
  readonly label: string;
  readonly affectedNodeIds: readonly string[];
  readonly origin?: HistoryOrigin;
  readonly breakpoint?: EditorBreakpoint;
  readonly propertyPath?: string;
  readonly previousDocument: PageDocument;
  readonly nextDocument: PageDocument;
  readonly previousSelectionId?: string | null;
  readonly nextSelectionId?: string | null;
  readonly coalesceKey?: string | null;
  readonly allowCoalesce?: boolean;
  readonly timestamp?: number;
}

export interface RecordTransactionOutcome {
  readonly ok: boolean;
  readonly recorded: boolean;
  readonly coalesced: boolean;
  readonly state: HistoryState;
  readonly document: PageDocument;
  readonly transaction: EditingTransaction | null;
  readonly error: HistoryOperationError | null;
}

export interface HistoryNavigationOutcome {
  readonly ok: boolean;
  readonly state: HistoryState;
  readonly document: PageDocument;
  readonly selectedNodeId: string | null;
  readonly expandLayerIds: readonly string[];
  readonly transaction: EditingTransaction | null;
  readonly error: HistoryOperationError | null;
}
