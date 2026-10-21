import React from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, MoreHorizontal, Unlock } from "lucide-react";
import type { LayerOperationPermissions } from "@/lib/visual-editor/structure";
import { cn } from "@/lib/utils";

export interface LayerActionControlsProps {
  nodeId: string;
  nodeName: string;
  hidden: boolean;
  locked: boolean;
  isDirectlyLocked: boolean;
  isAncestorLocked: boolean;
  isSelected: boolean;
  permissions: LayerOperationPermissions;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onToggleVisibility: (nodeId: string, currentlyHidden: boolean) => void;
  onToggleLock: (nodeId: string, currentlyLocked: boolean) => void;
  onOpenMenu: (nodeId: string, triggerEl: HTMLElement) => void;
}

export const LayerActionControls = React.memo(function LayerActionControls({
  nodeId,
  nodeName,
  hidden,
  locked,
  isDirectlyLocked,
  isAncestorLocked,
  isSelected,
  permissions,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  onOpenMenu,
}: LayerActionControlsProps) {
  const showInteractiveHoverControls =
    permissions.canMoveUp ||
    permissions.canMoveDown ||
    permissions.canDuplicate ||
    permissions.canToggleVisibility ||
    permissions.canToggleLock;

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {/* Reorder Up / Down Controls */}
      {(permissions.canMoveUp || permissions.canMoveDown) && (
        <div
          className={cn(
            "flex items-center gap-0.5",
            !isSelected && "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          )}
        >
          <button
            type="button"
            disabled={!permissions.canMoveUp}
            aria-label={`Move ${nodeName} up`}
            title={
              permissions.canMoveUp
                ? `Move ${nodeName} up`
                : (permissions.moveUpDisabledReason ?? "Cannot move up")
            }
            data-testid={`studio-layer-move-up-${nodeId}`}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp(nodeId);
            }}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ArrowUp className="size-3" />
          </button>
          <button
            type="button"
            disabled={!permissions.canMoveDown}
            aria-label={`Move ${nodeName} down`}
            title={
              permissions.canMoveDown
                ? `Move ${nodeName} down`
                : (permissions.moveDownDisabledReason ?? "Cannot move down")
            }
            data-testid={`studio-layer-move-down-${nodeId}`}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown(nodeId);
            }}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ArrowDown className="size-3" />
          </button>
        </div>
      )}

      {permissions.canDuplicate && (
        <button
          type="button"
          aria-label={`Duplicate ${nodeName}`}
          title={`Duplicate ${nodeName}`}
          data-testid={`studio-layer-duplicate-${nodeId}`}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(nodeId);
          }}
          className={cn(
            "flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            !isSelected && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <Copy className="size-3" />
        </button>
      )}

      {/* Visibility Toggle */}
      {permissions.canToggleVisibility ? (
        <button
          type="button"
          aria-label={hidden ? `Show ${nodeName}` : `Hide ${nodeName}`}
          title={hidden ? `Show ${nodeName}` : `Hide ${nodeName}`}
          data-testid={`studio-layer-visibility-${nodeId}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(nodeId, hidden);
          }}
          className={cn(
            "flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            !hidden && !isSelected && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          {hidden ? <EyeOff className="size-3 text-amber-400" /> : <Eye className="size-3" />}
        </button>
      ) : hidden ? (
        <span
          className="flex size-5 items-center justify-center text-muted-foreground/60"
          title={permissions.visibilityDisabledReason ?? "Hidden layer"}
        >
          <EyeOff className="size-3" aria-label="Hidden layer" />
        </span>
      ) : null}

      {/* Lock / Unlock Toggle */}
      {permissions.canToggleLock ? (
        <button
          type="button"
          aria-label={isDirectlyLocked ? `Unlock ${nodeName}` : `Lock ${nodeName}`}
          title={
            isDirectlyLocked
              ? `Unlock ${nodeName}`
              : isAncestorLocked
                ? `Locked by parent container (${permissions.lockedByAncestorName ?? "Ancestor"})`
                : `Lock ${nodeName}`
          }
          data-testid={`studio-layer-lock-${nodeId}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(nodeId, isDirectlyLocked);
          }}
          className={cn(
            "flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            !locked && !isSelected && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            isDirectlyLocked && "text-amber-400 hover:text-amber-300",
          )}
        >
          {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
        </button>
      ) : locked ? (
        <span
          className="flex size-5 items-center justify-center text-muted-foreground/70"
          title={
            isAncestorLocked
              ? `Locked by parent (${permissions.lockedByAncestorName ?? "Ancestor"})`
              : (permissions.lockDisabledReason ?? "Protected layer")
          }
        >
          <Lock className="size-3" aria-label="Locked or global component" />
        </span>
      ) : null}

      {/* Context Action Menu Button */}
      {(showInteractiveHoverControls ||
        permissions.canWrapInContainer ||
        permissions.canUnwrapContainer ||
        permissions.canDelete ||
        permissions.canRename) && (
        <button
          type="button"
          aria-label={`More actions for ${nodeName}`}
          title={`Layer actions for ${nodeName}`}
          data-testid={`studio-layer-menu-btn-${nodeId}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(nodeId, e.currentTarget);
          }}
          className={cn(
            "flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            !isSelected && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      )}
    </div>
  );
});
