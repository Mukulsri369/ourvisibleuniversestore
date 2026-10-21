import React, { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  BoxSelect,
  Copy,
  CornerLeftUp,
  Eye,
  EyeOff,
  FolderInput,
  FolderPlus,
  LocateFixed,
  Lock,
  Pencil,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react";
import type {
  CompatibleContainerDestination,
  LayerOperationPermissions,
} from "@/lib/visual-editor/structure";

export interface LayerContextMenuProps {
  nodeId: string;
  nodeName: string;
  hidden: boolean;
  isDirectlyLocked: boolean;
  parentId: string | null;
  canCreateChildContainer: boolean;
  permissions: LayerOperationPermissions;
  compatibleContainers: readonly CompatibleContainerDestination[];
  onClose: () => void;
  onStartRename: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onMoveToContainer: (nodeId: string, targetParentId: string | null) => void;
  onWrapInContainer: (nodeId: string, containerType: "Container" | "Stack" | "Section") => void;
  onUnwrapContainer: (nodeId: string) => void;
  onAddChildContainer: (parentId: string, containerType: "Container" | "Stack") => void;
  onToggleVisibility: (nodeId: string, currentlyHidden: boolean) => void;
  onToggleLock: (nodeId: string, currentlyLocked: boolean) => void;
  onSelectParent: (parentId: string) => void;
  onRevealInCanvas: (nodeId: string) => void;
  onRequestDelete: (nodeId: string) => void;
}

export function LayerContextMenu({
  nodeId,
  nodeName,
  hidden,
  isDirectlyLocked,
  parentId,
  canCreateChildContainer,
  permissions,
  compatibleContainers,
  onClose,
  onStartRename,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onMoveToContainer,
  onWrapInContainer,
  onUnwrapContainer,
  onAddChildContainer,
  onToggleVisibility,
  onToggleLock,
  onSelectParent,
  onRevealInCanvas,
  onRequestDelete,
}: LayerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const itemClass =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

  const statusReason = permissions.lockedByAncestorName
    ? `Locked by parent "${permissions.lockedByAncestorName}".`
    : permissions.isDirectlyLocked
      ? "Layer is locked. Unlock to modify."
      : !permissions.canDelete
        ? permissions.deleteDisabledReason
        : undefined;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${nodeName}`}
      data-testid={`studio-layer-context-menu-${nodeId}`}
      onClick={(e) => e.stopPropagation()}
      className="mt-1 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
    >
      <div className="mb-1 border-b border-border/60 px-2 pb-1 text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
        {nodeName}
      </div>

      {/* Rename */}
      <button
        type="button"
        role="menuitem"
        disabled={!permissions.canRename}
        data-testid={`studio-layer-menu-rename-${nodeId}`}
        onClick={() => {
          onClose();
          onStartRename(nodeId);
        }}
        className={itemClass}
      >
        <Pencil className="size-3.5 text-muted-foreground" />
        <span>Rename Layer</span>
      </button>

      {/* Duplicate */}
      <button
        type="button"
        role="menuitem"
        disabled={!permissions.canDuplicate}
        data-testid={`studio-layer-menu-duplicate-${nodeId}`}
        onClick={() => {
          onClose();
          onDuplicate(nodeId);
        }}
        className={itemClass}
      >
        <Copy className="size-3.5 text-muted-foreground" />
        <span>Duplicate</span>
      </button>

      {/* Move Up / Move Down */}
      <div className="my-1 border-t border-border/60 pt-1">
        <button
          type="button"
          role="menuitem"
          disabled={!permissions.canMoveUp}
          data-testid={`studio-layer-menu-move-up-${nodeId}`}
          onClick={() => {
            onClose();
            onMoveUp(nodeId);
          }}
          className={itemClass}
        >
          <ArrowUp className="size-3.5 text-muted-foreground" />
          <span>Move Up</span>
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!permissions.canMoveDown}
          data-testid={`studio-layer-menu-move-down-${nodeId}`}
          onClick={() => {
            onClose();
            onMoveDown(nodeId);
          }}
          className={itemClass}
        >
          <ArrowDown className="size-3.5 text-muted-foreground" />
          <span>Move Down</span>
        </button>
      </div>

      {/* Grouping & Container Actions */}
      <div className="my-1 border-t border-border/60 pt-1">
        <button
          type="button"
          role="menuitem"
          disabled={!permissions.canWrapInContainer}
          data-testid={`studio-layer-menu-wrap-container-${nodeId}`}
          onClick={() => {
            onClose();
            onWrapInContainer(nodeId, parentId === null ? "Section" : "Container");
          }}
          className={itemClass}
        >
          <BoxSelect className="size-3.5 text-muted-foreground" />
          <span>{parentId === null ? "Wrap in Section" : "Wrap in Container"}</span>
        </button>

        {permissions.canWrapInContainer && parentId !== null && (
          <button
            type="button"
            role="menuitem"
            data-testid={`studio-layer-menu-wrap-stack-${nodeId}`}
            onClick={() => {
              onClose();
              onWrapInContainer(nodeId, "Stack");
            }}
            className={itemClass}
          >
            <BoxSelect className="size-3.5 text-muted-foreground" />
            <span>Wrap in Stack</span>
          </button>
        )}

        {permissions.canUnwrapContainer && (
          <button
            type="button"
            role="menuitem"
            data-testid={`studio-layer-menu-unwrap-${nodeId}`}
            onClick={() => {
              onClose();
              onUnwrapContainer(nodeId);
            }}
            className={itemClass}
          >
            <Ungroup className="size-3.5 text-muted-foreground" />
            <span>Unwrap Container</span>
          </button>
        )}

        {canCreateChildContainer && (
          <button
            type="button"
            role="menuitem"
            data-testid={`studio-layer-menu-add-container-${nodeId}`}
            onClick={() => {
              onClose();
              onAddChildContainer(nodeId, "Container");
            }}
            className={itemClass}
          >
            <FolderPlus className="size-3.5 text-muted-foreground" />
            <span>Add Child Container</span>
          </button>
        )}

        {permissions.canMoveToContainer && compatibleContainers.length > 0 && (
          <div className="px-2 py-1">
            <label
              htmlFor={`studio-layer-move-target-${nodeId}`}
              className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"
            >
              <FolderInput className="size-3" />
              <span>Move to Container</span>
            </label>
            <select
              id={`studio-layer-move-target-${nodeId}`}
              data-testid={`studio-layer-menu-move-select-${nodeId}`}
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                onClose();
                onMoveToContainer(nodeId, val === "__root__" ? null : val);
              }}
              className="h-7 w-full rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
            >
              <option value="" disabled>
                Choose destination…
              </option>
              {compatibleContainers.map((dest) => (
                <option key={dest.id ?? "__root__"} value={dest.id ?? "__root__"}>
                  {dest.label} ({dest.componentType})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Visibility & Lock */}
      <div className="my-1 border-t border-border/60 pt-1">
        <button
          type="button"
          role="menuitem"
          disabled={!permissions.canToggleVisibility}
          data-testid={`studio-layer-menu-visibility-${nodeId}`}
          onClick={() => {
            onClose();
            onToggleVisibility(nodeId, hidden);
          }}
          className={itemClass}
        >
          {hidden ? (
            <>
              <Eye className="size-3.5 text-muted-foreground" />
              <span>Show Layer</span>
            </>
          ) : (
            <>
              <EyeOff className="size-3.5 text-muted-foreground" />
              <span>Hide Layer</span>
            </>
          )}
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!permissions.canToggleLock}
          data-testid={`studio-layer-menu-lock-${nodeId}`}
          onClick={() => {
            onClose();
            onToggleLock(nodeId, isDirectlyLocked);
          }}
          className={itemClass}
        >
          {isDirectlyLocked ? (
            <>
              <Unlock className="size-3.5 text-muted-foreground" />
              <span>Unlock Layer</span>
            </>
          ) : (
            <>
              <Lock className="size-3.5 text-muted-foreground" />
              <span>Lock Layer</span>
            </>
          )}
        </button>
      </div>

      {/* Navigation Helpers */}
      <div className="my-1 border-t border-border/60 pt-1">
        {parentId && (
          <button
            type="button"
            role="menuitem"
            data-testid={`studio-layer-menu-select-parent-${nodeId}`}
            onClick={() => {
              onClose();
              onSelectParent(parentId);
            }}
            className={itemClass}
          >
            <CornerLeftUp className="size-3.5 text-muted-foreground" />
            <span>Select Parent</span>
          </button>
        )}

        <button
          type="button"
          role="menuitem"
          data-testid={`studio-layer-menu-reveal-${nodeId}`}
          onClick={() => {
            onClose();
            onRevealInCanvas(nodeId);
          }}
          className={itemClass}
        >
          <LocateFixed className="size-3.5 text-muted-foreground" />
          <span>Reveal in Canvas</span>
        </button>
      </div>

      {/* Delete / Remove */}
      <div className="mt-1 border-t border-border/60 pt-1">
        <button
          type="button"
          role="menuitem"
          disabled={!permissions.canDelete}
          data-testid={`studio-layer-menu-delete-${nodeId}`}
          onClick={() => {
            onClose();
            onRequestDelete(nodeId);
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/15 disabled:pointer-events-none disabled:opacity-40"
        >
          <Trash2 className="size-3.5" />
          <span>Remove Layer…</span>
        </button>
      </div>

      {statusReason && (
        <div
          data-testid={`studio-layer-menu-reason-${nodeId}`}
          className="mt-1 rounded bg-secondary/40 px-2 py-1 text-[10px] leading-snug text-muted-foreground"
        >
          {statusReason}
        </div>
      )}
    </div>
  );
}
