import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Compass,
  Flame,
  FolderKanban,
  Globe,
  Image as ImageIcon,
  Instagram,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  PanelBottom,
  PanelTop,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Square,
  Type,
  Video,
  X,
} from "lucide-react";
import type { Category, HomeData } from "@/lib/store";
import { isEditableInputTarget } from "@/lib/visual-editor/interactions";
import type { PageDocument } from "@/lib/visual-editor/schema/page-document";
import {
  describeDeletionImpact,
  resolveLayerOperationPermissions,
  type DeletionImpactSummary,
  type LayerOperationPermissions,
  type StructuralCommand,
  type StructuralOperationResult,
} from "@/lib/visual-editor/structure";
import {
  buildStudioLayerTree,
  filterStudioLayerTree,
  getAllExpandableLayerIds,
  type StudioLayerTreeItem,
} from "@/lib/visual-editor/studio";
import { cn } from "@/lib/utils";
import {
  LayerActionControls,
  LayerContextMenu,
  LayerDeleteConfirmDialog,
  LayerRenameInput,
} from "./layers";

export interface LayerUndoBannerState {
  description: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export interface StudioLayersPanelProps {
  document: PageDocument;
  categories: readonly Category[];
  homeData?: HomeData;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  expandedLayerIds: ReadonlySet<string>;
  searchQuery: string;
  onSelectNode: (nodeId: string | null, options?: { scrollIntoView?: boolean }) => void;
  onHoverNode: (nodeId: string | null) => void;
  onToggleExpandLayer: (nodeId: string) => void;
  onExpandAllLayers?: (layerIds: readonly string[]) => void;
  onCollapseAllLayers?: () => void;
  onChangeSearchQuery: (query: string) => void;
  onToggleNodeVisibility: (nodeId: string, currentlyHidden: boolean) => void;
  onExecuteStructuralCommand?: (command: StructuralCommand) => StructuralOperationResult;
  undoBanner?: LayerUndoBannerState | null;
}

function getComponentIcon(componentType: string) {
  switch (componentType) {
    case "StoreHeader":
      return PanelTop;
    case "StoreFooter":
      return PanelBottom;
    case "CelestialScrollWorld":
      return Globe;
    case "PlanetHero":
      return Compass;
    case "FestivalSection":
      return Flame;
    case "FeaturedCollection":
      return Sparkles;
    case "ProductScrollRail":
    case "ProductGridSection":
      return LayoutGrid;
    case "ProductCard":
      return ShoppingBag;
    case "CategoryGridSection":
    case "CategorySectionInstance":
    case "CategorySpotlight":
    case "CategoryCard":
      return FolderKanban;
    case "InstagramSection":
      return Instagram;
    case "Section":
    case "Container":
    case "Stack":
    case "Grid":
    case "GridItem":
      return LayoutTemplate;
    case "Heading":
    case "Text":
      return Type;
    case "Image":
      return ImageIcon;
    case "Video":
      return Video;
    case "Button":
    case "Shape":
      return Square;
    default:
      return Box;
  }
}

function flattenVisibleLayerItems(
  items: readonly StudioLayerTreeItem[],
  expandedLayerIds: ReadonlySet<string>,
  forceExpandAll: boolean,
): StudioLayerTreeItem[] {
  const flat: StudioLayerTreeItem[] = [];
  const visit = (item: StudioLayerTreeItem) => {
    flat.push(item);
    const isExpanded = forceExpandAll || expandedLayerIds.has(item.id);
    if (item.children.length > 0 && isExpanded) {
      for (const child of item.children) {
        visit(child);
      }
    }
  };
  for (const rootItem of items) {
    visit(rootItem);
  }
  return flat;
}

const DEFAULT_READONLY_PERMISSIONS: LayerOperationPermissions = {
  targetId: "",
  isDocumentNode: false,
  isRuntimeInstance: false,
  isGlobalChrome: false,
  isDirectlyLocked: true,
  isAncestorLocked: false,
  isEffectivelyLocked: true,
  lockedByAncestorName: null,
  canRename: false,
  canDuplicate: false,
  canToggleVisibility: false,
  canToggleLock: false,
  canMoveUp: false,
  canMoveDown: false,
  canMoveToContainer: false,
  compatibleTargetContainers: [],
  canWrapInContainer: false,
  canUnwrapContainer: false,
  canDelete: false,
  descendantCount: 0,
};

interface LayerRowProps {
  item: StudioLayerTreeItem;
  permissionsById: ReadonlyMap<string, LayerOperationPermissions>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  renamingNodeId: string | null;
  openMenuNodeId: string | null;
  expandedLayerIds: ReadonlySet<string>;
  forceExpandAll: boolean;
  onSelectNode: (nodeId: string | null, options?: { scrollIntoView?: boolean }) => void;
  onHoverNode: (nodeId: string | null) => void;
  onToggleExpandLayer: (nodeId: string) => void;
  onStartRename: (nodeId: string) => void;
  onCommitRename: (nodeId: string, nextName: string) => void;
  onCancelRename: () => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onMoveToContainer: (nodeId: string, targetParentId: string | null) => void;
  onWrapInContainer: (nodeId: string, containerType: "Container" | "Stack" | "Section") => void;
  onUnwrapContainer: (nodeId: string) => void;
  onAddChildContainer: (parentId: string, containerType: "Container" | "Stack") => void;
  onToggleNodeVisibility: (nodeId: string, currentlyHidden: boolean) => void;
  onToggleNodeLock: (nodeId: string, currentlyLocked: boolean) => void;
  onOpenMenu: (nodeId: string) => void;
  onCloseMenu: () => void;
  onRequestDelete: (nodeId: string) => void;
}

const LayerTreeRow = React.memo(function LayerTreeRow({
  item,
  permissionsById,
  selectedNodeId,
  hoveredNodeId,
  renamingNodeId,
  openMenuNodeId,
  expandedLayerIds,
  forceExpandAll,
  onSelectNode,
  onHoverNode,
  onToggleExpandLayer,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onMoveToContainer,
  onWrapInContainer,
  onUnwrapContainer,
  onAddChildContainer,
  onToggleNodeVisibility,
  onToggleNodeLock,
  onOpenMenu,
  onCloseMenu,
  onRequestDelete,
}: LayerRowProps) {
  const Icon = getComponentIcon(item.componentType);
  const isSelected = selectedNodeId === item.id;
  const isHovered = hoveredNodeId === item.id;
  const isRenaming = renamingNodeId === item.id;
  const isMenuOpen = openMenuNodeId === item.id;
  const hasChildren = item.children.length > 0;
  const isExpanded = forceExpandAll || expandedLayerIds.has(item.id);
  const permissions = permissionsById.get(item.id) ?? DEFAULT_READONLY_PERMISSIONS;

  const canCreateChildContainer =
    item.kind === "document_node" &&
    !permissions.isEffectivelyLocked &&
    (item.componentType === "Section" ||
      item.componentType === "Container" ||
      item.componentType === "Stack" ||
      item.componentType === "Grid") &&
    item.id !== "home-dynamic-categories";

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
    >
      <div
        data-testid={`studio-layer-item-${item.id}`}
        data-layer-selected={isSelected ? "true" : undefined}
        data-layer-hidden={item.hidden ? "true" : undefined}
        data-layer-locked={item.locked ? "true" : undefined}
        data-layer-virtual={item.isVirtualInstance ? "true" : undefined}
        onMouseEnter={() => onHoverNode(item.id)}
        onMouseLeave={() => onHoverNode(null)}
        onContextMenu={(e) => {
          if (item.kind === "document_node") {
            e.preventDefault();
            e.stopPropagation();
            onSelectNode(item.id, { scrollIntoView: false });
            onOpenMenu(item.id);
          }
        }}
        style={{ paddingLeft: `${Math.min(item.depth * 14 + 8, 64)}px` }}
        className={cn(
          "group flex h-8 items-center justify-between gap-1 rounded-md pr-1.5 text-xs transition-colors motion-reduce:transition-none",
          isSelected
            ? "bg-primary/15 text-foreground font-medium ring-1 ring-primary/40"
            : isHovered
              ? "bg-secondary/70 text-foreground"
              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
          item.hidden && "opacity-55",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {hasChildren ? (
            <button
              type="button"
              aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
              data-testid={`studio-layer-expand-${item.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpandLayer(item.id);
              }}
              className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          ) : (
            <span className="size-4 shrink-0" aria-hidden="true" />
          )}

          {isRenaming ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Icon className="size-3.5 shrink-0 text-primary" />
              <LayerRenameInput
                nodeId={item.id}
                initialName={item.name}
                onCommit={onCommitRename}
                onCancel={onCancelRename}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSelectNode(item.id, { scrollIntoView: true })}
              onDoubleClick={(e) => {
                if (permissions.canRename) {
                  e.stopPropagation();
                  onStartRename(item.id);
                }
              }}
              data-testid={`studio-layer-select-${item.id}`}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-0.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{item.name}</span>
              {item.slotName && (
                <span className="rounded bg-secondary px-1 py-0.2 font-mono text-[9px] text-muted-foreground">
                  #{item.slotName}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Right Indicators & Structural Controls */}
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden xl:inline font-mono text-[10px] text-muted-foreground/75">
            {item.kind === "virtual_product" || item.kind === "virtual_category_card"
              ? "Instance"
              : item.isVirtualInstance
                ? "Dynamic"
                : item.componentType}
          </span>

          <LayerActionControls
            nodeId={item.id}
            nodeName={item.name}
            hidden={item.hidden}
            locked={item.locked}
            isDirectlyLocked={Boolean(item.isDirectlyLocked)}
            isAncestorLocked={Boolean(item.isAncestorLocked)}
            isSelected={isSelected}
            permissions={permissions}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDuplicate={onDuplicate}
            onToggleVisibility={onToggleNodeVisibility}
            onToggleLock={onToggleNodeLock}
            onOpenMenu={(id) => {
              if (openMenuNodeId === id) {
                onCloseMenu();
              } else {
                onOpenMenu(id);
              }
            }}
          />
        </div>
      </div>

      {/* Contextual Layer Action Menu */}
      {isMenuOpen && (
        <div style={{ paddingLeft: `${Math.min(item.depth * 14 + 20, 64)}px` }} className="pr-1.5">
          <LayerContextMenu
            nodeId={item.id}
            nodeName={item.name}
            hidden={item.hidden}
            isDirectlyLocked={Boolean(item.isDirectlyLocked)}
            parentId={item.parentId}
            canCreateChildContainer={canCreateChildContainer}
            permissions={permissions}
            compatibleContainers={permissions.compatibleTargetContainers}
            onClose={onCloseMenu}
            onStartRename={onStartRename}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onMoveToContainer={onMoveToContainer}
            onWrapInContainer={onWrapInContainer}
            onUnwrapContainer={onUnwrapContainer}
            onAddChildContainer={onAddChildContainer}
            onToggleVisibility={onToggleNodeVisibility}
            onToggleLock={onToggleNodeLock}
            onSelectParent={(pid) => onSelectNode(pid, { scrollIntoView: true })}
            onRevealInCanvas={(id) => onSelectNode(id, { scrollIntoView: true })}
            onRequestDelete={onRequestDelete}
          />
        </div>
      )}

      {hasChildren && isExpanded && (
        <ul role="group" className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <LayerTreeRow
              key={child.id}
              item={child}
              permissionsById={permissionsById}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              renamingNodeId={renamingNodeId}
              openMenuNodeId={openMenuNodeId}
              expandedLayerIds={expandedLayerIds}
              forceExpandAll={forceExpandAll}
              onSelectNode={onSelectNode}
              onHoverNode={onHoverNode}
              onToggleExpandLayer={onToggleExpandLayer}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onDuplicate={onDuplicate}
              onMoveToContainer={onMoveToContainer}
              onWrapInContainer={onWrapInContainer}
              onUnwrapContainer={onUnwrapContainer}
              onAddChildContainer={onAddChildContainer}
              onToggleNodeVisibility={onToggleNodeVisibility}
              onToggleNodeLock={onToggleNodeLock}
              onOpenMenu={onOpenMenu}
              onCloseMenu={onCloseMenu}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

export function StudioLayersPanel({
  document,
  categories,
  homeData,
  selectedNodeId,
  hoveredNodeId,
  expandedLayerIds,
  searchQuery,
  onSelectNode,
  onHoverNode,
  onToggleExpandLayer,
  onExpandAllLayers,
  onCollapseAllLayers,
  onChangeSearchQuery,
  onToggleNodeVisibility,
  onExecuteStructuralCommand,
  undoBanner,
}: StudioLayersPanelProps) {
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [openMenuNodeId, setOpenMenuNodeId] = useState<string | null>(null);
  const [pendingDeleteImpact, setPendingDeleteImpact] = useState<DeletionImpactSummary | null>(
    null,
  );
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const fullTree = useMemo(
    () => buildStudioLayerTree(document, categories, undefined, homeData),
    [document, categories, homeData],
  );

  const filteredTree = useMemo(
    () => filterStudioLayerTree(fullTree, searchQuery),
    [fullTree, searchQuery],
  );

  const hasActiveFilter = searchQuery.trim().length > 0;

  const visibleFlatItems = useMemo(
    () => flattenVisibleLayerItems(filteredTree, expandedLayerIds, hasActiveFilter),
    [filteredTree, expandedLayerIds, hasActiveFilter],
  );

  // Precompute operation permissions for all items in the layer tree
  const permissionsById = useMemo(() => {
    const map = new Map<string, LayerOperationPermissions>();
    const visit = (item: StudioLayerTreeItem) => {
      map.set(item.id, resolveLayerOperationPermissions(document, item.id));
      for (const child of item.children) {
        visit(child);
      }
    };
    for (const root of fullTree) {
      visit(root);
    }
    return map;
  }, [document, fullTree]);

  const allExpandableIds = useMemo(() => getAllExpandableLayerIds(fullTree), [fullTree]);

  // Scroll the active layer item into view when selected from the canvas (Part 13, Section 37)
  useEffect(() => {
    if (!selectedNodeId || !treeScrollRef.current) return;
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(`studio-layer-item-${selectedNodeId}`)
        : `studio-layer-item-${selectedNodeId}`.replace(/"/g, '\\"');
    const rowEl = treeScrollRef.current.querySelector<HTMLElement>(`[data-testid="${escaped}"]`);
    if (rowEl && typeof rowEl.scrollIntoView === "function") {
      rowEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedNodeId]);

  const dispatchCommand = useCallback(
    (command: StructuralCommand) => {
      if (!onExecuteStructuralCommand) {
        if (command.type === "SetVisibility") {
          onToggleNodeVisibility(command.targetId, !command.visible);
        }
        return;
      }
      const result = onExecuteStructuralCommand(command);
      if (!result.ok && result.message) {
        setFeedbackNotice(result.message);
      } else {
        setFeedbackNotice(null);
      }
    },
    [onExecuteStructuralCommand, onToggleNodeVisibility],
  );

  const handleStartRename = useCallback((nodeId: string) => {
    setOpenMenuNodeId(null);
    setRenamingNodeId(nodeId);
  }, []);

  const handleCommitRename = useCallback(
    (nodeId: string, nextName: string) => {
      setRenamingNodeId(null);
      dispatchCommand({ type: "RenameNode", targetId: nodeId, newName: nextName });
    },
    [dispatchCommand],
  );

  const handleCancelRename = useCallback(() => {
    setRenamingNodeId(null);
  }, []);

  const handleMoveUp = useCallback(
    (nodeId: string) => {
      dispatchCommand({ type: "ReorderNode", targetId: nodeId, direction: "up" });
    },
    [dispatchCommand],
  );

  const handleMoveDown = useCallback(
    (nodeId: string) => {
      dispatchCommand({ type: "ReorderNode", targetId: nodeId, direction: "down" });
    },
    [dispatchCommand],
  );

  const handleDuplicate = useCallback(
    (nodeId: string) => {
      dispatchCommand({ type: "DuplicateNode", targetId: nodeId });
    },
    [dispatchCommand],
  );

  const handleMoveToContainer = useCallback(
    (nodeId: string, targetParentId: string | null) => {
      dispatchCommand({
        type: "MoveNode",
        targetId: nodeId,
        destinationParentId: targetParentId,
      });
    },
    [dispatchCommand],
  );

  const handleWrapInContainer = useCallback(
    (nodeId: string, containerType: "Container" | "Stack" | "Section") => {
      dispatchCommand({ type: "WrapNodeInContainer", targetId: nodeId, containerType });
    },
    [dispatchCommand],
  );

  const handleUnwrapContainer = useCallback(
    (nodeId: string) => {
      dispatchCommand({ type: "UnwrapContainer", targetId: nodeId });
    },
    [dispatchCommand],
  );

  const handleAddChildContainer = useCallback(
    (parentId: string, containerType: "Container" | "Stack") => {
      dispatchCommand({ type: "CreateContainer", parentTargetId: parentId, containerType });
    },
    [dispatchCommand],
  );

  const handleToggleVisibility = useCallback(
    (nodeId: string, currentlyHidden: boolean) => {
      if (onExecuteStructuralCommand) {
        dispatchCommand({
          type: "SetVisibility",
          targetId: nodeId,
          visible: currentlyHidden,
        });
      } else {
        onToggleNodeVisibility(nodeId, currentlyHidden);
      }
    },
    [onExecuteStructuralCommand, dispatchCommand, onToggleNodeVisibility],
  );

  const handleToggleLock = useCallback(
    (nodeId: string, currentlyLocked: boolean) => {
      dispatchCommand({
        type: "SetLock",
        targetId: nodeId,
        locked: !currentlyLocked,
      });
    },
    [dispatchCommand],
  );

  const handleRequestDelete = useCallback(
    (nodeId: string) => {
      const impact = describeDeletionImpact(document, nodeId);
      if (!impact || !impact.canDelete) {
        setFeedbackNotice("This layer cannot be removed.");
        return;
      }
      setPendingDeleteImpact(impact);
    },
    [document],
  );

  const handleConfirmDelete = useCallback(
    (nodeId: string) => {
      setPendingDeleteImpact(null);
      dispatchCommand({ type: "RemoveNode", targetId: nodeId });
    },
    [dispatchCommand],
  );

  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (isEditableInputTarget(e.target)) return;
      if (visibleFlatItems.length === 0) return;

      const currentIndex = selectedNodeId
        ? visibleFlatItems.findIndex((item) => item.id === selectedNodeId)
        : -1;
      const currentItem = currentIndex >= 0 ? visibleFlatItems[currentIndex] : null;

      if (e.key === "F2" && currentItem) {
        const perm = permissionsById.get(currentItem.id);
        if (perm?.canRename) {
          e.preventDefault();
          handleStartRename(currentItem.id);
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && currentItem) {
        const perm = permissionsById.get(currentItem.id);
        if (perm?.canDelete) {
          e.preventDefault();
          handleRequestDelete(currentItem.id);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = currentIndex < visibleFlatItems.length - 1 ? currentIndex + 1 : 0;
        const nextItem = visibleFlatItems[nextIndex];
        if (nextItem) {
          onSelectNode(nextItem.id, { scrollIntoView: true });
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleFlatItems.length - 1;
        const prevItem = visibleFlatItems[prevIndex];
        if (prevItem) {
          onSelectNode(prevItem.id, { scrollIntoView: true });
        }
        return;
      }

      if (e.key === "ArrowRight" && currentItem) {
        e.preventDefault();
        const isExpanded = hasActiveFilter || expandedLayerIds.has(currentItem.id);
        if (currentItem.children.length > 0 && !isExpanded) {
          onToggleExpandLayer(currentItem.id);
        } else if (currentItem.children.length > 0 && currentItem.children[0]) {
          onSelectNode(currentItem.children[0].id, { scrollIntoView: true });
        }
        return;
      }

      if (e.key === "ArrowLeft" && currentItem) {
        e.preventDefault();
        const isExpanded = hasActiveFilter || expandedLayerIds.has(currentItem.id);
        if (currentItem.children.length > 0 && isExpanded && !hasActiveFilter) {
          onToggleExpandLayer(currentItem.id);
        } else if (currentItem.parentId) {
          onSelectNode(currentItem.parentId, { scrollIntoView: true });
        }
        return;
      }

      if (e.key === "Escape") {
        if (openMenuNodeId) {
          e.preventDefault();
          setOpenMenuNodeId(null);
          return;
        }
        if (selectedNodeId) {
          e.preventDefault();
          onSelectNode(null);
        }
      }
    },
    [
      visibleFlatItems,
      selectedNodeId,
      hasActiveFilter,
      expandedLayerIds,
      permissionsById,
      openMenuNodeId,
      handleStartRename,
      handleRequestDelete,
      onSelectNode,
      onToggleExpandLayer,
    ],
  );

  return (
    <aside
      aria-label="Page and Component Layers"
      data-testid="studio-layers-panel"
      className="flex h-full w-full flex-col bg-card text-foreground select-none"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <h2 className="font-sans text-xs font-semibold tracking-tight">Page &amp; Layers</h2>
        </div>

        <div className="flex items-center gap-1">
          {onExpandAllLayers && allExpandableIds.length > 0 && (
            <button
              type="button"
              title="Expand all layers"
              aria-label="Expand all layers"
              data-testid="studio-layers-expand-all-btn"
              onClick={() => onExpandAllLayers(allExpandableIds)}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronsUpDown className="size-3.5" />
            </button>
          )}
          {onCollapseAllLayers && expandedLayerIds.size > 0 && (
            <button
              type="button"
              title="Collapse all layers"
              aria-label="Collapse all layers"
              data-testid="studio-layers-collapse-all-btn"
              onClick={onCollapseAllLayers}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronsDownUp className="size-3.5" />
            </button>
          )}
          {selectedNodeId && (
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              data-testid="studio-clear-selection-btn"
              className="ml-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Active Page Context */}
      <div className="border-b border-border/70 bg-secondary/25 px-3 py-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">Storefront Homepage</span>
          <span className="font-mono text-[10px] text-muted-foreground">/ (home)</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {document.root.length} root sections · {categories.length} dynamic categories
        </p>
      </div>

      {/* Immediate Undo Restoration Banner (for destructive actions) */}
      {undoBanner && (
        <div
          data-testid="studio-layer-undo-banner"
          className="flex items-center justify-between gap-2 border-b border-primary/30 bg-primary/10 px-3 py-2 text-xs"
        >
          <span className="truncate text-[11px] font-medium text-foreground">
            {undoBanner.description}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              data-testid="studio-layer-undo-btn"
              onClick={undoBanner.onUndo}
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw className="size-3" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              aria-label="Dismiss undo notice"
              onClick={undoBanner.onDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Structural Guardrail Feedback Notice */}
      {feedbackNotice && (
        <div
          role="status"
          data-testid="studio-layer-feedback-banner"
          className="flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200"
        >
          <span className="leading-snug">{feedbackNotice}</span>
          <button
            type="button"
            aria-label="Dismiss layer notice"
            onClick={() => setFeedbackNotice(null)}
            className="shrink-0 text-amber-200/70 hover:text-amber-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Layer Search / Filter Input */}
      <div className="border-b border-border/70 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Filter layers by name or type…"
            aria-label="Filter layers by name or type"
            data-testid="studio-layer-search-input"
            className="h-7 w-full rounded-md border border-border/80 bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear layer filter"
              onClick={() => onChangeSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hierarchical Layer Tree */}
      <div ref={treeScrollRef} className="flex-1 overflow-y-auto p-2">
        {filteredTree.length > 0 ? (
          <ul
            role="tree"
            tabIndex={0}
            aria-label="Page component tree"
            data-testid="studio-layer-tree"
            onKeyDown={handleTreeKeyDown}
            className="space-y-0.5 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          >
            {filteredTree.map((item) => (
              <LayerTreeRow
                key={item.id}
                item={item}
                permissionsById={permissionsById}
                selectedNodeId={selectedNodeId}
                hoveredNodeId={hoveredNodeId}
                renamingNodeId={renamingNodeId}
                openMenuNodeId={openMenuNodeId}
                expandedLayerIds={expandedLayerIds}
                forceExpandAll={hasActiveFilter}
                onSelectNode={onSelectNode}
                onHoverNode={onHoverNode}
                onToggleExpandLayer={onToggleExpandLayer}
                onStartRename={handleStartRename}
                onCommitRename={handleCommitRename}
                onCancelRename={handleCancelRename}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDuplicate={handleDuplicate}
                onMoveToContainer={handleMoveToContainer}
                onWrapInContainer={handleWrapInContainer}
                onUnwrapContainer={handleUnwrapContainer}
                onAddChildContainer={handleAddChildContainer}
                onToggleNodeVisibility={handleToggleVisibility}
                onToggleNodeLock={handleToggleLock}
                onOpenMenu={(id) => setOpenMenuNodeId(id)}
                onCloseMenu={() => setOpenMenuNodeId(null)}
                onRequestDelete={handleRequestDelete}
              />
            ))}
          </ul>
        ) : (
          <div
            data-testid="studio-layers-empty"
            className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground"
          >
            <p>No layers match &ldquo;{searchQuery}&rdquo;.</p>
          </div>
        )}
      </div>

      {/* Structural Reordering & Keyboard Shortcuts Notice */}
      <div className="border-t border-border/70 bg-secondary/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Double-click name to rename · <code className="font-mono">↑</code> /{" "}
        <code className="font-mono">↓</code> reorder · <code className="font-mono">[</code> /{" "}
        <code className="font-mono">]</code> parent/child.
      </div>

      {/* Safe Deletion Confirmation Modal */}
      {pendingDeleteImpact && (
        <LayerDeleteConfirmDialog
          impact={pendingDeleteImpact}
          onConfirmDelete={handleConfirmDelete}
          onCancel={() => setPendingDeleteImpact(null)}
        />
      )}
    </aside>
  );
}
