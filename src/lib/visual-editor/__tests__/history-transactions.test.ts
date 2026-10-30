import { describe, expect, it } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { executeStructuralCommand } from "../structure";
import { findNodeById, updateNodeById } from "../utils/node-tree";
import {
  resetInspectorBreakpointOverrides,
  resetInspectorStyleProperty,
  updateInspectorStyleProperty,
} from "../inspector/property-updates";
import {
  createInitialHistoryState,
  executeStructuralCommandWithHistory,
  recordEditingTransaction,
  redoEditingTransaction,
  undoEditingTransaction,
} from "../history";

describe("history-transactions — Structural Commands, Responsive Overrides & Inspector Undo/Redo", () => {
  it("undoes and redoes structural commands (rename, visibility, lock, reorder, move, duplicate, wrap, unwrap, delete)", () => {
    const baseline = createDefaultHomepageDocument();
    const doc0: import("../schema/page-document").PageDocument = {
      ...baseline,
      root: [
        ...baseline.root,
        {
          id: "story-container",
          type: "Section",
          name: "Synthetic story container",
          props: {},
          style: {},
          children: [
            {
              id: "home-story-intro",
              type: "Text",
              name: "Synthetic story",
              props: { text: "Synthetic story content" },
              style: {},
              children: [],
            },
          ],
        },
      ],
    };
    let history = createInitialHistoryState();
    let working = doc0;

    const runCommand = (
      command: Parameters<typeof executeStructuralCommand>[1],
      prevSel: string | null = "home-dynamic-categories",
    ) => {
      const execution = executeStructuralCommandWithHistory(history, working, command, prevSel);
      const result = execution.operationResult;
      expect(result.ok).toBe(true);
      expect(execution.historyOutcome?.recorded).toBe(true);
      history = execution.historyState;
      working = result.document;
      return result;
    };

    // 1. Rename
    runCommand({
      type: "RenameNode",
      targetId: "home-dynamic-categories",
      newName: "Renamed Sector Grid",
    });
    expect(findNodeById(working, "home-dynamic-categories")?.name).toBe("Renamed Sector Grid");

    // 2. Toggle visibility
    runCommand({
      type: "SetVisibility",
      targetId: "home-dynamic-categories",
      visible: false,
    });
    expect(findNodeById(working, "home-dynamic-categories")?.hidden).toBe(true);

    // 3. Toggle lock
    runCommand({
      type: "SetLock",
      targetId: "home-story-intro",
      locked: true,
    });
    expect(findNodeById(working, "home-story-intro")?.locked).toBe(true);

    // Unlock so we can wrap/duplicate/remove
    runCommand({
      type: "SetLock",
      targetId: "home-story-intro",
      locked: false,
    });

    // 4. Reorder
    const initialOrder = working.root.map((c) => c.id);
    runCommand({
      type: "ReorderNode",
      targetId: "home-dynamic-categories",
      direction: "down",
    });
    expect(working.root.map((c) => c.id)).not.toEqual(initialOrder);

    // 5. Wrap in container & Unwrap
    const wrapRes = runCommand({
      type: "WrapNodeInContainer",
      targetId: "home-story-intro",
      containerType: "Container",
    });
    const wrapperId = wrapRes.selectedNodeId!;
    expect(findNodeById(working, wrapperId)?.type).toBe("Container");

    runCommand({
      type: "UnwrapContainer",
      targetId: wrapperId,
    });
    expect(findNodeById(working, wrapperId)).toBeNull();
    expect(findNodeById(working, "home-story-intro")).not.toBeNull();

    // 6. Duplicate node
    const dupRes = runCommand({
      type: "DuplicateNode",
      targetId: "home-story-intro",
    });
    const duplicatedId = dupRes.selectedNodeId!;
    expect(findNodeById(working, duplicatedId)).not.toBeNull();

    // 7. Remove duplicated node
    runCommand(
      {
        type: "RemoveNode",
        targetId: duplicatedId,
      },
      duplicatedId,
    );
    expect(findNodeById(working, duplicatedId)).toBeNull();

    // Undo Remove -> duplicated node is restored with its exact ID and selection!
    const undoRemove = undoEditingTransaction(history, working, null);
    expect(findNodeById(undoRemove.document, duplicatedId)).not.toBeNull();
    expect(undoRemove.selectedNodeId).toBe(duplicatedId);

    // Redo Remove -> duplicated node is removed again
    const redoRemove = redoEditingTransaction(undoRemove.state, undoRemove.document, null);
    expect(findNodeById(redoRemove.document, duplicatedId)).toBeNull();

    // Undo all the way back to initial document
    let cursorState = redoRemove.state;
    let cursorDoc = redoRemove.document;
    while (cursorState.undoStack.length > 0) {
      const step = undoEditingTransaction(cursorState, cursorDoc, null);
      cursorState = step.state;
      cursorDoc = step.document;
    }

    expect(cursorDoc).toBe(doc0);
  });

  it("undoes and redoes responsive breakpoint style overrides and reset actions without leaking across breakpoints", () => {
    const doc0 = createDefaultHomepageDocument();
    let history = createInitialHistoryState();

    // 1. Set Desktop paddingTop = 64
    const doc1 = updateInspectorStyleProperty(
      doc0,
      "home-dynamic-categories",
      "geometry.padding",
      { top: 64, right: 0, bottom: 0, left: 0 },
      "desktop",
    ).document;
    history = recordEditingTransaction(history, {
      actionType: "property.style",
      affectedNodeIds: ["home-dynamic-categories"],
      label: "Edit paddingTop",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-dynamic-categories",
      nextSelectionId: "home-dynamic-categories",
      allowCoalesce: false,
    }).state;

    // 2. Set Mobile override paddingTop = 20
    const doc2 = updateInspectorStyleProperty(
      doc1,
      "home-dynamic-categories",
      "geometry.padding",
      { top: 20, right: 0, bottom: 0, left: 0 },
      "mobile",
    ).document;
    history = recordEditingTransaction(history, {
      actionType: "property.style",
      affectedNodeIds: ["home-dynamic-categories"],
      label: "EditpaddingTop (mobile)",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-dynamic-categories",
      nextSelectionId: "home-dynamic-categories",
      allowCoalesce: false,
    }).state;

    expect(findNodeById(doc2, "home-dynamic-categories")?.style.geometry?.padding?.top).toBe(64);
    expect(
      findNodeById(doc2, "home-dynamic-categories")?.responsive?.mobile?.geometry?.padding?.top,
    ).toBe(20);

    // 3. Reset Mobile paddingTop override
    const doc3 = resetInspectorStyleProperty(
      doc2,
      "home-dynamic-categories",
      "geometry.padding",
      "mobile",
    ).document;
    history = recordEditingTransaction(history, {
      actionType: "property.reset",
      affectedNodeIds: ["home-dynamic-categories"],
      label: "Reset paddingTop (mobile)",
      origin: "inspector",
      previousDocument: doc2,
      nextDocument: doc3,
      previousSelectionId: "home-dynamic-categories",
      nextSelectionId: "home-dynamic-categories",
      allowCoalesce: false,
    }).state;

    expect(
      findNodeById(doc3, "home-dynamic-categories")?.responsive?.mobile?.geometry?.padding?.top,
    ).toBeUndefined();
    expect(findNodeById(doc3, "home-dynamic-categories")?.style.geometry?.padding?.top).toBe(64);

    // Undo Reset -> mobile override 20 returns while desktop 64 remains intact
    const undoReset = undoEditingTransaction(history, doc3, null);
    expect(
      findNodeById(undoReset.document, "home-dynamic-categories")?.responsive?.mobile?.geometry
        ?.padding?.top,
    ).toBe(20);
    expect(
      findNodeById(undoReset.document, "home-dynamic-categories")?.style.geometry?.padding?.top,
    ).toBe(64);

    // Reset all mobile overrides and test Undo
    const doc4 = resetInspectorBreakpointOverrides(
      undoReset.document,
      "home-dynamic-categories",
      "mobile",
    ).document;
    const afterBulkReset = recordEditingTransaction(undoReset.state, {
      actionType: "property.reset_breakpoint",
      affectedNodeIds: ["home-dynamic-categories"],
      label: "Reset mobile overrides",
      origin: "inspector",
      previousDocument: undoReset.document,
      nextDocument: doc4,
      previousSelectionId: "home-dynamic-categories",
      nextSelectionId: "home-dynamic-categories",
      allowCoalesce: false,
    }).state;

    const undoBulkReset = undoEditingTransaction(afterBulkReset, doc4, null);
    expect(
      findNodeById(undoBulkReset.document, "home-dynamic-categories")?.responsive?.mobile?.geometry
        ?.padding?.top,
    ).toBe(20);
  });
});
