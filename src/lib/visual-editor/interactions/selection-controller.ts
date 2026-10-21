import type { Category, ProductCardData } from "@/lib/store";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import type { RenderMode } from "../rendering/RenderContext";
import type { PageDocument } from "../schema/page-document";
import {
  canHoverInInteractionMode,
  canSelectInInteractionMode,
  resolveInteractionModeForRenderMode,
} from "./interaction-modes";
import { buildVirtualCategoryNodeId, parseStudioNodeIdentity } from "./runtime-node-identity";
import {
  getDocumentNodeLookupIndex,
  type SelectionBreadcrumbEntry,
  type StudioSelectionControllerState,
  type StudioSelectionSource,
} from "./selection-state";

export function createInitialSelectionControllerState(
  initialSelectedNodeId: string | null = null,
): StudioSelectionControllerState {
  return {
    selectedNodeId: initialSelectedNodeId,
    hoveredNodeId: null,
    previousSelectedNodeId: null,
    selectionSource: "initial",
    interactionMode: "idle",
  };
}

/**
 * Checks whether a candidate target ID is valid and selectable in the current `PageDocument`
 * (Prompt 10, Part 3, Sections 7–8 & Part 13, Section 39).
 */
export function isTargetValidInDocument(
  document: PageDocument,
  targetId: string | null | undefined,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): boolean {
  const identity = parseStudioNodeIdentity(targetId);
  if (!identity) return false;

  if (identity.kind === "global_chrome" && identity.globalChromeType) {
    const cap = registry.getTrustedCapabilities(identity.globalChromeType);
    return Boolean(cap?.selectable);
  }

  if (!identity.documentNodeId) return false;
  const index = getDocumentNodeLookupIndex(document);
  const node = index.nodeById.get(identity.documentNodeId);
  if (!node) return false;

  const cap = registry.getTrustedCapabilities(node.type);
  return Boolean(cap?.selectable ?? true);
}

/**
 * Transitions the selection state to `targetId` if valid and allowed in the active interaction mode.
 */
export function selectStudioTarget(
  state: StudioSelectionControllerState,
  document: PageDocument,
  targetId: string | null,
  source: StudioSelectionSource = "programmatic",
  renderMode: RenderMode = "editor",
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StudioSelectionControllerState {
  if (!canSelectInInteractionMode(state.interactionMode, renderMode)) {
    return state;
  }

  if (targetId === null) {
    if (state.selectedNodeId === null) return state;
    return {
      ...state,
      previousSelectedNodeId: state.selectedNodeId,
      selectedNodeId: null,
      selectionSource: source,
    };
  }

  if (!isTargetValidInDocument(document, targetId, registry)) {
    return state;
  }

  if (state.selectedNodeId === targetId && state.selectionSource === source) {
    return state;
  }

  return {
    ...state,
    previousSelectedNodeId:
      state.selectedNodeId && state.selectedNodeId !== targetId
        ? state.selectedNodeId
        : state.previousSelectedNodeId,
    selectedNodeId: targetId,
    selectionSource: source,
  };
}

/**
 * Updates hovered target ID in O(1) time without validating the full document tree.
 * Avoids redundant state allocations when the hovered ID has not changed.
 */
export function hoverStudioTarget(
  state: StudioSelectionControllerState,
  document: PageDocument,
  hoveredId: string | null,
  renderMode: RenderMode = "editor",
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StudioSelectionControllerState {
  if (!canHoverInInteractionMode(state.interactionMode, renderMode)) {
    if (state.hoveredNodeId === null) return state;
    return {
      ...state,
      hoveredNodeId: null,
    };
  }

  const normalized =
    hoveredId && isTargetValidInDocument(document, hoveredId, registry) ? hoveredId : null;

  if (state.hoveredNodeId === normalized) {
    return state;
  }

  return {
    ...state,
    hoveredNodeId: normalized,
    interactionMode: normalized ? "hovering" : "idle",
  };
}

/**
 * Clears active selection while remembering `previousSelectedNodeId` for restoration.
 */
export function clearStudioSelection(
  state: StudioSelectionControllerState,
  source: StudioSelectionSource = "keyboard",
): StudioSelectionControllerState {
  if (state.selectedNodeId === null) return state;
  return {
    ...state,
    previousSelectedNodeId: state.selectedNodeId,
    selectedNodeId: null,
    selectionSource: source,
  };
}

/**
 * Restores the most recent valid selection (e.g. when returning from Preview Mode or undoing a clear).
 */
export function restorePreviousStudioSelection(
  state: StudioSelectionControllerState,
  document: PageDocument,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StudioSelectionControllerState {
  if (state.selectedNodeId && isTargetValidInDocument(document, state.selectedNodeId, registry)) {
    return state;
  }
  if (
    state.previousSelectedNodeId &&
    isTargetValidInDocument(document, state.previousSelectedNodeId, registry)
  ) {
    return {
      ...state,
      selectedNodeId: state.previousSelectedNodeId,
      selectionSource: "mode_restore",
    };
  }
  return state;
}

/**
 * Navigates one level up the hierarchy (Prompt 10, Part 5, Sections 12–13):
 * - From a product instance inside a dynamic category section -> selects the dynamic category section
 * - From a product/category instance -> selects its parent template `EditorNode`
 * - From a child `EditorNode` -> selects its parent `EditorNode` in `PageDocument`
 */
export function resolveParentTargetId(
  document: PageDocument,
  currentSelectedId: string | null | undefined,
): string | null {
  const identity = parseStudioNodeIdentity(currentSelectedId);
  if (!identity) return null;

  if (identity.kind === "global_chrome") {
    return null;
  }

  // Product card inside a dynamic category section -> parent is the virtual category section
  if (
    identity.kind === "virtual_product" &&
    identity.documentNodeId &&
    identity.virtualCategoryId
  ) {
    return buildVirtualCategoryNodeId(identity.documentNodeId, identity.virtualCategoryId);
  }

  // Runtime instance -> parent is the template EditorNode in PageDocument
  if (identity.isRuntimeInstance && identity.documentNodeId) {
    return identity.documentNodeId;
  }

  if (!identity.documentNodeId) return null;
  const index = getDocumentNodeLookupIndex(document);
  return index.parentIdById.get(identity.documentNodeId) ?? null;
}

export function selectParentStudioTarget(
  state: StudioSelectionControllerState,
  document: PageDocument,
  source: StudioSelectionSource = "keyboard",
  renderMode: RenderMode = "editor",
): StudioSelectionControllerState {
  const parentId = resolveParentTargetId(document, state.selectedNodeId);
  if (!parentId) return state;
  return selectStudioTarget(state, document, parentId, source, renderMode);
}

/**
 * Navigates one level down into the first child `EditorNode` or first virtual category instance.
 */
export function resolveFirstChildTargetId(
  document: PageDocument,
  currentSelectedId: string | null | undefined,
  categories: readonly Category[] = [],
): string | null {
  const identity = parseStudioNodeIdentity(currentSelectedId);
  if (!identity || identity.kind !== "document_node" || !identity.documentNodeId) {
    return null;
  }

  const index = getDocumentNodeLookupIndex(document);
  const directChildren = index.childIdsById.get(identity.documentNodeId) ?? [];
  if (directChildren.length > 0) {
    return directChildren[0];
  }

  const node = index.nodeById.get(identity.documentNodeId);
  if (node?.binding?.kind === "repeated_category_sections" && categories.length > 0) {
    const sorted = [...categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    if (sorted[0]) {
      return buildVirtualCategoryNodeId(node.id, sorted[0].id);
    }
  }

  return null;
}

export function selectFirstChildStudioTarget(
  state: StudioSelectionControllerState,
  document: PageDocument,
  categories: readonly Category[] = [],
  source: StudioSelectionSource = "keyboard",
  renderMode: RenderMode = "editor",
): StudioSelectionControllerState {
  const childId = resolveFirstChildTargetId(document, state.selectedNodeId, categories);
  if (!childId) return state;
  return selectStudioTarget(state, document, childId, source, renderMode);
}

/**
 * Ensures `selectedNodeId` and `hoveredNodeId` never point to deleted nodes if the document tree changes.
 */
export function syncSelectionWithDocument(
  state: StudioSelectionControllerState,
  document: PageDocument,
  renderMode: Extract<RenderMode, "editor" | "preview">,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StudioSelectionControllerState {
  const validSelected =
    state.selectedNodeId && isTargetValidInDocument(document, state.selectedNodeId, registry)
      ? state.selectedNodeId
      : null;

  const validHovered =
    renderMode === "editor" &&
    state.hoveredNodeId &&
    isTargetValidInDocument(document, state.hoveredNodeId, registry)
      ? state.hoveredNodeId
      : null;

  const nextInteractionMode = resolveInteractionModeForRenderMode(renderMode, validHovered);

  if (
    validSelected === state.selectedNodeId &&
    validHovered === state.hoveredNodeId &&
    nextInteractionMode === state.interactionMode
  ) {
    return state;
  }

  return {
    ...state,
    selectedNodeId: validSelected,
    hoveredNodeId: validHovered,
    interactionMode: nextInteractionMode,
  };
}

/**
 * Builds the structured parent-to-child breadcrumb trail for the currently selected node or runtime instance
 * (Prompt 10, Part 5, Section 12).
 */
export function buildSelectionBreadcrumbChain(
  document: PageDocument,
  selectedId: string | null | undefined,
  categories: readonly Category[] = [],
  products: readonly ProductCardData[] = [],
  registry: VisualComponentRegistry = defaultComponentRegistry,
): SelectionBreadcrumbEntry[] {
  const identity = parseStudioNodeIdentity(selectedId);
  if (!identity) return [];

  if (identity.kind === "global_chrome" && identity.globalChromeType) {
    return [
      {
        id: identity.rawId,
        label:
          identity.globalChromeType === "StoreHeader"
            ? "Store Header (Global Route Chrome)"
            : "Store Footer (Global Route Chrome)",
        componentType: identity.globalChromeType,
        isRuntimeInstance: false,
        isGlobalChrome: true,
        locked: true,
      },
    ];
  }

  if (!identity.documentNodeId) return [];
  const index = getDocumentNodeLookupIndex(document);
  const targetNode = index.nodeById.get(identity.documentNodeId);
  if (!targetNode) return [];

  const ancestorIds = index.ancestorIdsById.get(identity.documentNodeId) ?? [];
  const entries: SelectionBreadcrumbEntry[] = [];

  for (const ancId of ancestorIds) {
    const ancNode = index.nodeById.get(ancId);
    if (!ancNode) continue;
    const cap = registry.getTrustedCapabilities(ancNode.type);
    entries.push({
      id: ancNode.id,
      label: ancNode.name || cap?.displayName || ancNode.type,
      componentType: ancNode.type,
      isRuntimeInstance: false,
      isGlobalChrome: Boolean(cap?.isGlobalChrome),
      locked: Boolean(ancNode.locked),
    });
  }

  const targetCap = registry.getTrustedCapabilities(targetNode.type);
  entries.push({
    id: targetNode.id,
    label: targetNode.name || targetCap?.displayName || targetNode.type,
    componentType: targetNode.type,
    isRuntimeInstance: false,
    isGlobalChrome: Boolean(targetCap?.isGlobalChrome),
    locked: Boolean(targetNode.locked),
  });

  if (identity.virtualCategoryId) {
    const matchedCat = categories.find((c) => c.id === identity.virtualCategoryId);
    const catId = buildVirtualCategoryNodeId(targetNode.id, identity.virtualCategoryId);
    entries.push({
      id: identity.kind === "virtual_category_card" ? identity.rawId : catId,
      label: matchedCat ? `${matchedCat.name} Sector` : `Category (${identity.virtualCategoryId})`,
      componentType:
        identity.kind === "virtual_category_card" ? "CategoryCard" : "CategorySectionInstance",
      isRuntimeInstance: true,
      isGlobalChrome: false,
      locked: true,
    });
  }

  if (identity.kind === "virtual_product" && identity.virtualProductId) {
    const matchedProduct = products.find((p) => p.id === identity.virtualProductId);
    entries.push({
      id: identity.rawId,
      label: matchedProduct
        ? `Product Card (${matchedProduct.name})`
        : `Product Card (${identity.virtualProductId})`,
      componentType: "ProductCard",
      isRuntimeInstance: true,
      isGlobalChrome: false,
      locked: true,
    });
  }

  return entries;
}
