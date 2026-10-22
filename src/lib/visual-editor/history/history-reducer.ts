import type { PageDocument } from "../schema/page-document";
import {
  beginHistoryInteraction,
  cancelHistoryInteraction,
  commitHistoryInteraction,
  createInitialHistoryState,
  redoEditingTransaction,
  undoEditingTransaction,
  updateHistoryInteraction,
} from "./history-controller";
import { recordEditingTransaction } from "./history-transactions";
import type {
  HistoryActionType,
  HistoryOrigin,
  HistoryStackLimits,
  HistoryState,
  RecordTransactionInput,
} from "./history-types";
import type { EditorBreakpoint } from "../schema/responsive";

export type HistoryReducerAction =
  | {
      readonly type: "RECORD_TRANSACTION";
      readonly input: RecordTransactionInput;
    }
  | {
      readonly type: "UNDO";
      readonly currentDocument: PageDocument;
      readonly currentSelectedId: string | null;
    }
  | {
      readonly type: "REDO";
      readonly currentDocument: PageDocument;
      readonly currentSelectedId: string | null;
    }
  | {
      readonly type: "BEGIN_INTERACTION";
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
    }
  | {
      readonly type: "UPDATE_INTERACTION";
      readonly nextDocument: PageDocument;
      readonly nextSelectionId?: string | null;
      readonly timestamp?: number;
    }
  | {
      readonly type: "COMMIT_INTERACTION";
      readonly timestamp?: number;
    }
  | {
      readonly type: "CANCEL_INTERACTION";
      readonly currentDocument: PageDocument;
      readonly currentSelectedId: string | null;
    }
  | {
      readonly type: "CLEAR_HISTORY";
      readonly limits?: Partial<HistoryStackLimits>;
    };

export function historyStateReducer(
  state: HistoryState,
  action: HistoryReducerAction,
): HistoryState {
  switch (action.type) {
    case "RECORD_TRANSACTION":
      return recordEditingTransaction(state, action.input).state;
    case "UNDO":
      return undoEditingTransaction(state, action.currentDocument, action.currentSelectedId).state;
    case "REDO":
      return redoEditingTransaction(state, action.currentDocument, action.currentSelectedId).state;
    case "BEGIN_INTERACTION":
      return beginHistoryInteraction(state, action);
    case "UPDATE_INTERACTION":
      return updateHistoryInteraction(
        state,
        action.nextDocument,
        action.nextSelectionId,
        action.timestamp,
      ).state;
    case "COMMIT_INTERACTION":
      return commitHistoryInteraction(state, action.timestamp).state;
    case "CANCEL_INTERACTION":
      return cancelHistoryInteraction(state, action.currentDocument, action.currentSelectedId)
        .state;
    case "CLEAR_HISTORY":
      return createInitialHistoryState(action.limits ?? state.limits);
  }
}
