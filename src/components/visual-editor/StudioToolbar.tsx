import React from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  Layers,
  Loader2,
  MousePointerClick,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import type { RenderMode } from "@/lib/visual-editor/rendering/RenderContext";
import type { EditorBreakpoint } from "@/lib/visual-editor/schema/responsive";
import type {
  PersistenceError,
  StudioDevicePreset,
  StudioMobileDrawer,
  StudioPersistenceStatus,
  StudioZoomMode,
} from "@/lib/visual-editor/studio";
import { HistoryControls, SaveStatus } from "./history";
import { StudioViewportControls } from "./StudioViewportControls";
import { cn } from "@/lib/utils";

export interface StudioToolbarProps {
  pageTitle: string;
  persistenceStatus: StudioPersistenceStatus;
  isDirty: boolean;
  draftRevision: number;
  isPublishedLive: boolean;
  renderMode: Extract<RenderMode, "editor" | "preview">;
  devicePreset: StudioDevicePreset;
  viewportWidthPx: number;
  breakpoint: EditorBreakpoint;
  zoomMode: StudioZoomMode;
  zoomPercent: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  mobileActiveDrawer: StudioMobileDrawer;
  canUndo?: boolean;
  canRedo?: boolean;
  nextUndoLabel?: string | null;
  nextRedoLabel?: string | null;
  isOnline?: boolean;
  retryAttempt?: number;
  persistenceError?: PersistenceError | null;
  validationError?: string | null;
  hasRecoveryCheckpoint?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onRetrySave?: () => void;
  onOpenRecovery?: () => void;
  onReturnToAdmin: () => void;
  onSaveDraft: () => void;
  publishingControls?: React.ReactNode;
  onResetWorkingDraft: () => void;
  onChangeRenderMode: (mode: Extract<RenderMode, "editor" | "preview">) => void;
  onSelectDevicePreset: (preset: Exclude<StudioDevicePreset, "custom">) => void;
  onChangeViewportWidth: (widthPx: number) => void;
  onChangeZoom: (zoomPercent: number, mode?: StudioZoomMode) => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onChangeMobileDrawer: (drawer: StudioMobileDrawer) => void;
}

export function StudioToolbar({
  pageTitle,
  persistenceStatus,
  isDirty,
  draftRevision,
  isPublishedLive,
  renderMode,
  devicePreset,
  viewportWidthPx,
  breakpoint,
  zoomMode,
  zoomPercent,
  leftPanelCollapsed,
  rightPanelCollapsed,
  mobileActiveDrawer,
  canUndo = false,
  canRedo = false,
  nextUndoLabel = null,
  nextRedoLabel = null,
  isOnline = true,
  retryAttempt = 0,
  persistenceError = null,
  validationError = null,
  hasRecoveryCheckpoint = false,
  onUndo,
  onRedo,
  onRetrySave,
  onOpenRecovery,
  onReturnToAdmin,
  onSaveDraft,
  publishingControls,
  onResetWorkingDraft,
  onChangeRenderMode,
  onSelectDevicePreset,
  onChangeViewportWidth,
  onChangeZoom,
  onToggleLeftPanel,
  onToggleRightPanel,
  onChangeMobileDrawer,
}: StudioToolbarProps) {
  const isSaving = persistenceStatus === "saving";

  return (
    <header
      data-testid="studio-toolbar"
      className="flex min-h-14 w-full shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-1.5 backdrop-blur"
    >
      {/* Left Zone: Return to Admin, Studio Identity, Page Title & Save Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onReturnToAdmin}
          data-testid="studio-return-admin-btn"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/50 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">Admin</span>
        </button>

        <button
          type="button"
          onClick={onToggleLeftPanel}
          aria-label={leftPanelCollapsed ? "Show layers panel" : "Hide layers panel"}
          data-testid="studio-toggle-left-panel"
          className="hidden md:inline-flex size-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {leftPanelCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>

        {/* Mobile Drawer Toggles */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            aria-pressed={mobileActiveDrawer === "layers"}
            aria-label="Open Layers drawer"
            data-testid="studio-mobile-layers-btn"
            onClick={() =>
              onChangeMobileDrawer(mobileActiveDrawer === "layers" ? "none" : "layers")
            }
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg border border-border/70 px-2 text-xs font-medium",
              mobileActiveDrawer === "layers"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/40 text-foreground",
            )}
          >
            <Layers className="size-3.5" />
            <span>Layers</span>
          </button>
          <button
            type="button"
            aria-pressed={mobileActiveDrawer === "inspector"}
            aria-label="Open Inspector drawer"
            data-testid="studio-mobile-inspector-btn"
            onClick={() =>
              onChangeMobileDrawer(mobileActiveDrawer === "inspector" ? "none" : "inspector")
            }
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg border border-border/70 px-2 text-xs font-medium",
              mobileActiveDrawer === "inspector"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/40 text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Inspect</span>
          </button>
        </div>

        <div className="min-w-0 border-l border-border/70 pl-2.5">
          <div className="flex items-center gap-2 truncate">
            <span className="font-sans text-xs font-semibold tracking-tight text-foreground">
              Store Design Studio
            </span>
            <span aria-hidden="true" className="text-muted-foreground/50">
              /
            </span>
            <span
              data-testid="studio-page-title"
              className="truncate text-xs text-muted-foreground"
            >
              {pageTitle}
            </span>
          </div>
          <SaveStatus
            status={persistenceStatus}
            isDirty={isDirty}
            draftRevision={draftRevision}
            isPublishedLive={isPublishedLive}
            isOnline={isOnline}
            retryAttempt={retryAttempt}
            error={persistenceError}
            validationError={validationError}
            hasRecoveryCheckpoint={hasRecoveryCheckpoint}
            onRetrySave={onRetrySave}
            onOpenRecovery={onOpenRecovery}
          />
        </div>
      </div>

      {/* Center Zone: Viewport & Zoom Controls */}
      <div className="hidden lg:flex items-center justify-center">
        <StudioViewportControls
          devicePreset={devicePreset}
          viewportWidthPx={viewportWidthPx}
          breakpoint={breakpoint}
          zoomMode={zoomMode}
          zoomPercent={zoomPercent}
          onSelectDevicePreset={onSelectDevicePreset}
          onChangeViewportWidth={onChangeViewportWidth}
          onChangeZoom={onChangeZoom}
        />
      </div>

      {/* Right Zone: History (Undo/Redo), Edit/Preview Toggle, View Live Store, Revert & Save Draft */}
      <div className="flex items-center gap-2">
        {onUndo && onRedo && (
          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            nextUndoLabel={nextUndoLabel}
            nextRedoLabel={nextRedoLabel}
            disabled={persistenceStatus === "loading" || renderMode !== "editor"}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        )}

        {/* Edit / Preview Segmented Toggle */}
        <div
          role="group"
          aria-label="Studio interaction mode"
          className="flex items-center gap-0.5 rounded-lg border border-border/80 bg-secondary/50 p-0.5"
        >
          <button
            type="button"
            aria-pressed={renderMode === "editor"}
            data-testid="studio-mode-editor"
            onClick={() => onChangeRenderMode("editor")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              renderMode === "editor"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MousePointerClick className="size-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            aria-pressed={renderMode === "preview"}
            data-testid="studio-mode-preview"
            onClick={() => onChangeRenderMode("preview")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              renderMode === "preview"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="size-3.5" />
            <span>Preview</span>
          </button>
        </div>

        {/* Published-site comparison link (Part 13, Section 34) */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="studio-view-live-store-link"
          title="Open currently published public storefront in a new tab"
          className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/40 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <span>Live Store</span>
          <ExternalLink className="size-3" />
        </a>

        {/* Revert Unsaved Changes */}
        {isDirty && (
          <button
            type="button"
            onClick={onResetWorkingDraft}
            disabled={isSaving}
            data-testid="studio-revert-changes-btn"
            title="Discard unsaved local edits and restore last saved state"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/80 bg-secondary/40 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden xl:inline">Revert</span>
          </button>
        )}

        {publishingControls}
        {/* Primary Save Draft Button (Part 12, Section 30) */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSaving || persistenceStatus === "loading" || (!isDirty && draftRevision > 0)}
          data-testid="studio-save-draft-btn"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
            isDirty
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border bg-secondary/70 text-foreground hover:bg-secondary",
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Saving…</span>
            </>
          ) : !isDirty && draftRevision > 0 ? (
            <>
              <Check className="size-3.5" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Save className="size-3.5" />
              <span>Save Draft</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleRightPanel}
          aria-label={rightPanelCollapsed ? "Show inspector panel" : "Hide inspector panel"}
          data-testid="studio-toggle-right-panel"
          className="hidden md:inline-flex size-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {rightPanelCollapsed ? (
            <PanelRightOpen className="size-4" />
          ) : (
            <PanelRightClose className="size-4" />
          )}
        </button>
      </div>

      {/* Compact Secondary Row for Tablet/Mobile Viewport Controls */}
      <div className="flex w-full items-center justify-between border-t border-border/50 pt-1.5 lg:hidden">
        <StudioViewportControls
          devicePreset={devicePreset}
          viewportWidthPx={viewportWidthPx}
          breakpoint={breakpoint}
          zoomMode={zoomMode}
          zoomPercent={zoomPercent}
          onSelectDevicePreset={onSelectDevicePreset}
          onChangeViewportWidth={onChangeViewportWidth}
          onChangeZoom={onChangeZoom}
        />
      </div>
    </header>
  );
}
