import React from "react";
import { Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  nextUndoLabel?: string | null;
  nextRedoLabel?: string | null;
  disabled?: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Functional Undo/Redo toolbar controls with next-action tooltip descriptions
 * and disabled-state accuracy (Prompt 13, Part 8, Sections 23 & 26).
 */
export function HistoryControls({
  canUndo,
  canRedo,
  nextUndoLabel = null,
  nextRedoLabel = null,
  disabled = false,
  onUndo,
  onRedo,
}: HistoryControlsProps) {
  const undoAllowed = canUndo && !disabled;
  const redoAllowed = canRedo && !disabled;

  const undoTitle = nextUndoLabel
    ? `Undo: ${nextUndoLabel} (Ctrl/Cmd+Z)`
    : "Undo (Ctrl/Cmd+Z)";

  const redoTitle = nextRedoLabel
    ? `Redo: ${nextRedoLabel} (Ctrl/Cmd+Shift+Z)`
    : "Redo (Ctrl/Cmd+Shift+Z)";

  return (
    <div
      role="group"
      aria-label="Editing history controls"
      data-testid="studio-history-controls"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border/80 bg-secondary/40 p-0.5"
    >
      <button
        type="button"
        onClick={onUndo}
        disabled={!undoAllowed}
        aria-label={nextUndoLabel ? `Undo: ${nextUndoLabel}` : "Undo"}
        title={undoTitle}
        data-testid="studio-undo-btn"
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
          undoAllowed
            ? "text-foreground hover:bg-background/80"
            : "text-muted-foreground",
        )}
      >
        <Undo2 className="size-3.5" />
        <span className="hidden xl:inline">Undo</span>
      </button>

      <button
        type="button"
        onClick={onRedo}
        disabled={!redoAllowed}
        aria-label={nextRedoLabel ? `Redo: ${nextRedoLabel}` : "Redo"}
        title={redoTitle}
        data-testid="studio-redo-btn"
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
          redoAllowed
            ? "text-foreground hover:bg-background/80"
            : "text-muted-foreground",
        )}
      >
        <Redo2 className="size-3.5" />
        <span className="hidden xl:inline">Redo</span>
      </button>
    </div>
  );
}
