import { describe, expect, it } from "vitest";
import { createDefaultHomepageDocument } from "../homepage";
import { executeStructuralCommand } from "../commands";
import { findNodeById, updateNodeById } from "../tree";
import {
  resetNodeBreakpointOverrides,
  resetNodeStyleProperty,
  setNodeStyleProperty,
} from "../responsive";
import {
  createHistoryState,
  describeStructuralCommandForHistory,
  mapStructuralCommandToHistoryKind,
  recordHistoryEdit,
  redoHistory,
  undoHistory,
} from "../history";

describe("history-transactions — Structural Commands, Responsive Overrides & Inspector Undo/Redo", () => {
  it("undoes and redoes structural commands (rename, visibility, lock, reorder, move, duplicate, wrap, unwrap, delete)", () => {
    const doc0 = createDefaultHomepageDocument();
    let history = createHistoryState();
    let working = doc0;

    const runCommand = (
      command: Parameters<typeof executeStructuralCommand>[1],
      prevSel: string | null = "home-category-grid",
    ) => {
      const result = executeStructuralCommand(working, command);
      expect(result.ok).toBe(true);
      const recorded = recordHistoryEdit(history, {
        kind: mapStructuralCommandToHistoryKind(command.type),
        label: describeStructuralCommandForHistory(command.type, result.description),
        origin: "layers",
        previousDocument: working,
        nextDocument: result.document,
        previousSelectionId: prevSel,
        nextSelectionId: result.selectedNodeId,
        allowCoalesce: false,
      });
      history = recorded.state;
      working = result.document;
      return result;
    };

    // 1. Rename
    runCommand({
      type: "RenameNode",
      targetId: "home-category-grid",
      name: "Renamed Sector Grid",
    });
    expect(findNodeById(working.root, "home-category-grid")?.name).toBe("Renamed Sector Grid");

    // 2. Toggle visibility
    runCommand({
      type: "SetVisibility",
      targetId: "home-category-grid",
      hidden: true,
    });
    expect(findNodeById(working.root, "home-category-grid")?.hidden).toBe(true);

    // 3. Toggle lock
    runCommand({
      type: "SetLock",
      targetId: "home-story-intro",
      locked: true,
    });
    expect(findNodeById(working.root, "home-story-intro")?.locked).toBe(true);

    // Unlock so we can wrap/duplicate/remove
    runCommand({
      type: "SetLock",
      targetId: "home-story-intro",
      locked: false,
    });

    // 4. Reorder
    const initialOrder = working.root.children.map((c) => c.id);
    runCommand({
      type: "ReorderNode",
      targetId: "home-category-grid",
      direction: "down",
    });
    expect(working.root.children.map((c) => c.id)).not.toEqual(initialOrder);

    // 5. Wrap in container & Unwrap
    const wrapRes = runCommand({
      type: "WrapNodeInContainer",
      targetId: "home-story-intro",
      containerType: "Container",
    });
    const wrapperId = wrapRes.selectedNodeId!;
    expect(findNodeById(working.root, wrapperId)?.type).toBe("Container");

    runCommand({
      type: "UnwrapContainer",
      targetId: wrapperId,
    });
    expect(findNodeById(working.root, wrapperId)).toBeNull();
    expect(findNodeById(working.root, "home-story-intro")).not.toBeNull();

    // 6. Duplicate node
    const dupRes = runCommand({
      type: "DuplicateNode",
      targetId: "home-story-intro",
    });
    const duplicatedId = dupRes.selectedNodeId!;
    expect(findNodeById(working.root, duplicatedId)).not.toBeNull();

    // 7. Remove duplicated node
    runCommand(
      {
        type: "RemoveNode",
        targetId: duplicatedId,
      },
      duplicatedId,
    );
    expect(findNodeById(working.root, duplicatedId)).toBeNull();

    // Undo Remove -> duplicated node is restored with its exact ID and selection!
    const undoRemove = undoHistory(history, working);
    expect(findNodeById(undoRemove.document.root, duplicatedId)).not.toBeNull();
    expect(undoRemove.selectionId).toBe(duplicatedId);

    // Redo Remove -> duplicated node is removed again
    const redoRemove = redoHistory(undoRemove.state, undoRemove.document);
    expect(findNodeById(redoRemove.document.root, duplicatedId)).toBeNull();

    // Undo all the way back to initial document
    let cursorState = redoRemove.state;
    let cursorDoc = redoRemove.document;
    while (cursorState.undoStack.length > 0) {
      const step = undoHistory(cursorState, cursorDoc);
      cursorState = step.state;
      cursorDoc = step.document;
    }

    expect(cursorDoc).toBe(doc0);
  });

  it("undoes and redoes responsive breakpoint style overrides and reset actions without leaking across breakpoints", () => {
    const doc0 = createDefaultHomepageDocument();
    let history = createHistoryState();

    // 1. Set Desktop paddingTop = 64
    const doc1 = updateNodeById(doc0, "home-category-grid", (node) =>
      setNodeStyleProperty(node, "desktop", "paddingTop", 64),
    );
    history = recordHistoryEdit(history, {
      kind: "style_edit",
      label: "Edit paddingTop",
      origin: "inspector",
      previousDocument: doc0,
      nextDocument: doc1,
      previousSelectionId: "home-category-grid",
      nextSelectionId: "home-category-grid",
      allowCoalesce: false,
    }).state;

    // 2. Set Mobile override paddingTop = 20
    const doc2 = updateNodeById(doc1, "home-category-grid", (node) =>
      setNodeStyleProperty(node, "mobile", "paddingTop", 20),
    );
    history = recordHistoryEdit(history, {
      kind: "responsive_override",
      label: "EditpaddingTop (mobile)",
      origin: "inspector",
      previousDocument: doc1,
      nextDocument: doc2,
      previousSelectionId: "home-category-grid",
      nextSelectionId: "home-category-grid",
      allowCoalesce: false,
    }).state;

    expect(findNodeById(doc2.root, "home-category-grid")?.styles?.desktop?.paddingTop).toBe(64);
    expect(findNodeById(doc2.root, "home-category-grid")?.styles?.mobile?.paddingTop).toBe(20);

    // 3. Reset Mobile paddingTop override
    const doc3 = updateNodeById(doc2, "home-category-grid", (node) =>
      resetNodeStyleProperty(node, "mobile", "paddingTop"),
    );
    history = recordHistoryEdit(history, {
      kind: "reset_override",
      label: "Reset paddingTop (mobile)",
      origin: "inspector",
      previousDocument: doc2,
      nextDocument: doc3,
      previousSelectionId: "home-category-grid",
      nextSelectionId: "home-category-grid",
      allowCoalesce: false,
    }).state;

    expect(
      findNodeById(doc3.root, "home-category-grid")?.styles?.mobile?.paddingTop,
    ).toBeUndefined();
    expect(findNodeById(doc3.root, "home-category-grid")?.styles?.desktop?.paddingTop).toBe(64);

    // Undo Reset -> mobile override 20 returns while desktop 64 remains intact
    const undoReset = undoHistory(history, doc3);
    expect(
      findNodeById(undoReset.document.root, "home-category-grid")?.styles?.mobile?.paddingTop,
    ).toBe(20);
    expect(
      findNodeById(undoReset.document.root, "home-category-grid")?.styles?.desktop?.paddingTop,
    ).toBe(64);

    // Reset all mobile overrides and test Undo
    const doc4 = updateNodeById(undoReset.document, "home-category-grid", (node) =>
      resetNodeBreakpointOverrides(node, "mobile"),
    );
    const afterBulkReset = recordHistoryEdit(undoReset.state, {
      kind: "reset_breakpoint_overrides",
      label: "Reset mobile overrides",
      origin: "inspector",
      previousDocument: undoReset.document,
      nextDocument: doc4,
      previousSelectionId: "home-category-grid",
      nextSelectionId: "home-category-grid",
      allowCoalesce: false,
    }).state;

    const undoBulkReset = undoHistory(afterBulkReset, doc4);
    expect(
      findNodeById(undoBulkReset.document.root, "home-category-grid")?.styles?.mobile?.paddingTop,
    ).toBe(20);
  });
});
