import React from "react";
import type { SelectionBreadcrumbEntry } from "@/lib/visual-editor/interactions";
import type { RenderMode } from "@/lib/visual-editor/rendering/RenderContext";
import type { EditorBreakpoint } from "@/lib/visual-editor/schema/responsive";
import type { StudioPersistenceStatus } from "@/lib/visual-editor/studio";
import { SelectionBreadcrumb } from "./selection/SelectionBreadcrumb";

export interface StudioStatusBarProps {
  persistenceStatus: StudioPersistenceStatus;
  isDirty: boolean;
  draftRevision: number;
  publishedRevision: number;
  lastSavedAt: string | null;
  renderMode: Extract<RenderMode, "editor" | "preview">;
  viewportWidthPx: number;
  breakpoint: EditorBreakpoint;
  zoomPercent: number;
  selectedBreadcrumb: readonly string[];
  selectedBreadcrumbEntries?: readonly SelectionBreadcrumbEntry[];
  onSelectBreadcrumbNode?: (nodeId: string) => void;
  validationError: string | null;
}

export function StudioStatusBar({
  persistenceStatus,
  isDirty,
  draftRevision,
  publishedRevision,
  lastSavedAt,
  renderMode,
  viewportWidthPx,
  breakpoint,
  zoomPercent,
  selectedBreadcrumb,
  selectedBreadcrumbEntries,
  onSelectBreadcrumbNode,
  validationError,
}: StudioStatusBarProps) {
  const formattedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <footer
      data-testid="studio-status-bar"
      className="flex h-7 w-full shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-3 text-[11px] text-muted-foreground select-none"
    >
      {/* Left: Selection Breadcrumb & Mode */}
      <div className="flex min-w-0 items-center gap-2 truncate">
        <span className="font-medium text-foreground">
          {renderMode === "editor" ? "Edit Mode" : "Customer Preview Mode"}
        </span>
        <span aria-hidden="true">·</span>
        {selectedBreadcrumbEntries &&
        selectedBreadcrumbEntries.length > 0 &&
        onSelectBreadcrumbNode ? (
          <div data-testid="studio-status-selection-path" className="min-w-0 truncate">
            <SelectionBreadcrumb
              entries={selectedBreadcrumbEntries}
              onSelectNode={onSelectBreadcrumbNode}
              testId="studio-status-breadcrumb-nav"
            />
          </div>
        ) : selectedBreadcrumb.length > 0 ? (
          <span
            data-testid="studio-status-selection-path"
            className="truncate font-mono text-[11px] text-muted-foreground"
          >
            {selectedBreadcrumb.join(" › ")}
          </span>
        ) : (
          <span>No component selected</span>
        )}
      </div>

      {/* Center: Validation Notice if any */}
      {validationError && (
        <div
          role="alert"
          data-testid="studio-status-validation-error"
          className="truncate font-medium text-destructive"
        >
          {validationError}
        </div>
      )}

      {/* Right: Viewport, Revision & Publishing Scope Disclosure (Section 32) */}
      <div className="hidden sm:flex shrink-0 items-center gap-2 font-mono tabular-nums">
        <span>
          {viewportWidthPx}px · {breakpoint} · {zoomPercent}%
        </span>
        <span aria-hidden="true">·</span>
        <span data-testid="studio-status-revision">
          {persistenceStatus === "saving"
            ? "Saving draft…"
            : isDirty
              ? `Unsaved changes (Draft Rev ${draftRevision})`
              : `Saved Draft Rev ${draftRevision}`}
          {formattedTime ? ` at ${formattedTime}` : ""}
        </span>
        <span aria-hidden="true">·</span>
        <span title="Published revisions are separate from saved and unsaved drafts">
          Published Rev {publishedRevision}
          {publishedRevision === 0 ? " (Canonical storefront)" : ""}
        </span>
      </div>
    </footer>
  );
}
