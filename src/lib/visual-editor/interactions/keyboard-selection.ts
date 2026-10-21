import type { Category } from "@/lib/store";
import type { PageDocument } from "../schema/page-document";
import { resolveFirstChildTargetId, resolveParentTargetId } from "./selection-controller";

/**
 * Checks if a keyboard event originated inside an interactive text-entry control
 * (`<input>`, `<textarea>`, `<select>`, or `contenteditable`) so editor keyboard
 * shortcuts never steal keystrokes while typing (Prompt 10, Part 5, Section 13 & Part 15, Section 43).
 */
export function isEditableInputTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("tagName" in target)) {
    return false;
  }
  const el = target as HTMLElement;
  const tagName = (el.tagName || "").toUpperCase();
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  if (el.isContentEditable || el.getAttribute?.("contenteditable") === "true") {
    return true;
  }
  return false;
}

export type StudioKeyboardSelectionAction =
  | { readonly type: "none" }
  | { readonly type: "clear_selection" }
  | { readonly type: "select_target"; readonly targetId: string; readonly scrollIntoView: boolean }
  | { readonly type: "save_draft" };

export interface KeyboardSelectionEventLike {
  readonly key: string;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly target: EventTarget | null;
}

/**
 * Resolves global studio keyboard shortcuts for selection and hierarchy navigation:
 * - `Escape`: Clear current selection
 * - `Alt+ArrowUp` or `[`: Select parent component/template
 * - `Alt+ArrowDown` or `]`: Select first child component/instance
 * - `Cmd/Ctrl+S`: Save working draft
 */
export function resolveStudioKeyboardSelectionAction(
  event: KeyboardSelectionEventLike,
  document: PageDocument,
  currentSelectedId: string | null,
  categories: readonly Category[] = [],
): StudioKeyboardSelectionAction {
  const isMod = Boolean(event.metaKey || event.ctrlKey);

  // Cmd/Ctrl+S is allowed globally to save the draft
  if (isMod && event.key.toLowerCase() === "s") {
    return { type: "save_draft" };
  }

  // Never intercept keys when the user is typing in an input, textarea, select, or contenteditable
  if (isEditableInputTarget(event.target)) {
    return { type: "none" };
  }

  if (event.key === "Escape") {
    if (currentSelectedId !== null) {
      return { type: "clear_selection" };
    }
    return { type: "none" };
  }

  // Select parent (`Alt+ArrowUp` or `[` without Cmd/Ctrl)
  if ((event.altKey && event.key === "ArrowUp") || (!isMod && !event.altKey && event.key === "[")) {
    const parentId = resolveParentTargetId(document, currentSelectedId);
    if (parentId) {
      return { type: "select_target", targetId: parentId, scrollIntoView: true };
    }
    return { type: "none" };
  }

  // Select first child (`Alt+ArrowDown` or `]` without Cmd/Ctrl)
  if (
    (event.altKey && event.key === "ArrowDown") ||
    (!isMod && !event.altKey && event.key === "]")
  ) {
    const childId = resolveFirstChildTargetId(document, currentSelectedId, categories);
    if (childId) {
      return { type: "select_target", targetId: childId, scrollIntoView: true };
    }
    return { type: "none" };
  }

  return { type: "none" };
}
