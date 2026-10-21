import {
  getDocumentNodeLookupIndex,
  parseStudioNodeIdentity,
  type DocumentNodeLookupIndex,
} from "../interactions/index";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import {
  LEAF_COMPONENT_TYPES,
  ROOT_ONLY_COMPONENT_TYPES,
  type ComponentType,
  type EditorNode,
} from "../schema/nodes";
import { MAX_DOCUMENT_DEPTH, MAX_DOCUMENT_NODES, type PageDocument } from "../schema/page-document";
import { safeParsePageDocument } from "../schema/validation";

export type StructuralErrorCode =
  | "INVALID_TARGET"
  | "NODE_NOT_FOUND"
  | "UNSUPPORTED_OPERATION"
  | "LOCKED_NODE"
  | "LOCKED_ANCESTOR"
  | "INVALID_PARENT"
  | "INVALID_SLOT"
  | "INVALID_DEPTH"
  | "CIRCULAR_MOVE"
  | "DUPLICATE_NODE_ID"
  | "PROTECTED_COMPONENT"
  | "RUNTIME_INSTANCE_PROTECTED"
  | "SCHEMA_VALIDATION_FAILED";

export interface StructuralUndoSnapshot {
  readonly description: string;
  readonly previousDocument: PageDocument;
  readonly previousSelectedNodeId: string | null;
}

export interface StructuralOperationResult {
  readonly ok: boolean;
  readonly code?: StructuralErrorCode;
  readonly message: string;
  readonly document: PageDocument;
  readonly selectedNodeId?: string | null;
  readonly affectedNodeIds?: readonly string[];
  readonly expandLayerIds?: readonly string[];
  readonly undoSnapshot?: StructuralUndoSnapshot;
}

export interface CompatibleContainerDestination {
  readonly id: string | null;
  readonly label: string;
  readonly componentType: string;
  readonly slotName?: string;
  readonly depth: number;
}

export interface LayerOperationPermissions {
  readonly targetId: string;
  readonly isDocumentNode: boolean;
  readonly isRuntimeInstance: boolean;
  readonly isGlobalChrome: boolean;
  readonly isDirectlyLocked: boolean;
  readonly isAncestorLocked: boolean;
  readonly isEffectivelyLocked: boolean;
  readonly lockedByAncestorName: string | null;
  readonly canRename: boolean;
  readonly renameDisabledReason?: string;
  readonly canDuplicate: boolean;
  readonly duplicateDisabledReason?: string;
  readonly canToggleVisibility: boolean;
  readonly visibilityDisabledReason?: string;
  readonly canToggleLock: boolean;
  readonly lockDisabledReason?: string;
  readonly canMoveUp: boolean;
  readonly moveUpDisabledReason?: string;
  readonly canMoveDown: boolean;
  readonly moveDownDisabledReason?: string;
  readonly canMoveToContainer: boolean;
  readonly compatibleTargetContainers: readonly CompatibleContainerDestination[];
  readonly canWrapInContainer: boolean;
  readonly wrapDisabledReason?: string;
  readonly canUnwrapContainer: boolean;
  readonly unwrapDisabledReason?: string;
  readonly canDelete: boolean;
  readonly deleteDisabledReason?: string;
  readonly descendantCount: number;
}

/**
 * Updates `document.metadata.updatedAt` whenever a structural change produces a new document reference.
 */
export function withUpdatedStructuralTimestamp(
  originalDoc: PageDocument,
  updatedDoc: PageDocument,
): PageDocument {
  if (updatedDoc === originalDoc) return originalDoc;
  return {
    ...updatedDoc,
    metadata: {
      ...updatedDoc.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Finds the nearest locked ancestor of `nodeId`, if any, in O(depth) time via `DocumentNodeLookupIndex`
 * (Prompt 11, Part 10, Section 31).
 */
export function getLockedAncestorNode(
  document: PageDocument,
  nodeId: string,
  index: DocumentNodeLookupIndex = getDocumentNodeLookupIndex(document),
): EditorNode | null {
  const ancestors = index.ancestorIdsById.get(nodeId);
  if (!ancestors || ancestors.length === 0) return null;

  for (const ancId of ancestors) {
    const ancNode = index.nodeById.get(ancId);
    if (ancNode?.locked) {
      return ancNode;
    }
  }
  return null;
}

/**
 * Checks whether a document node is locked either directly (`node.locked === true`)
 * or through an inherited lock on an ancestor container.
 */
export function isNodeEffectivelyLocked(
  document: PageDocument,
  nodeId: string,
  index: DocumentNodeLookupIndex = getDocumentNodeLookupIndex(document),
): {
  locked: boolean;
  direct: boolean;
  lockedAncestor: EditorNode | null;
} {
  const node = index.nodeById.get(nodeId);
  if (!node) {
    return { locked: false, direct: false, lockedAncestor: null };
  }
  const lockedAncestor = getLockedAncestorNode(document, nodeId, index);
  const direct = Boolean(node.locked);
  return {
    locked: direct || lockedAncestor !== null,
    direct,
    lockedAncestor,
  };
}

/**
 * Computes the height of a subtree rooted at `node` (1 for a leaf node).
 */
export function getSubtreeHeight(node: EditorNode): number {
  let maxChildHeight = 0;
  for (const child of node.children) {
    const h = getSubtreeHeight(child);
    if (h > maxChildHeight) maxChildHeight = h;
  }
  if (node.slots) {
    for (const slotList of Object.values(node.slots)) {
      for (const slotChild of slotList) {
        const h = getSubtreeHeight(slotChild);
        if (h > maxChildHeight) maxChildHeight = h;
      }
    }
  }
  return 1 + maxChildHeight;
}

/**
 * Counts all descendant nodes below `node` (0 for a leaf node).
 */
export function countSubtreeDescendants(node: EditorNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countSubtreeDescendants(child);
  }
  if (node.slots) {
    for (const slotList of Object.values(node.slots)) {
      for (const slotChild of slotList) {
        count += 1 + countSubtreeDescendants(slotChild);
      }
    }
  }
  return count;
}

/**
 * Determines whether a root-level node is pinned in place (e.g. `CelestialScrollWorld`, `PlanetHero`,
 * `StoreHeader`, `StoreFooter`) and cannot be reordered or displaced by ordinary sections
 * (Prompt 11, Part 5, Section 16).
 */
export function isPinnedRootComponent(
  node: EditorNode,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): boolean {
  const cap = registry.getTrustedCapabilities(node.type);
  if (!cap) return true;
  if (cap.isGlobalChrome || cap.isGlobalBackgroundLayer) return true;
  if (cap.isRootOnly && !cap.draggable) return true;
  return !cap.draggable;
}

/**
 * Validates whether `parentType` (or `null` for `document.root`) can contain `childNode`
 * in `slotName` (or default `children` when `slotName` is undefined), enforcing:
 * - Leaf component restrictions (`LEAF_COMPONENT_TYPES`)
 * - Root-only component restrictions (`ROOT_ONLY_COMPONENT_TYPES`)
 * - Slot definitions (`supportedSlots`, `allowedChildTypes`, `maxChildren`)
 * - Specialized storefront component context rules (`CategorySpotlightHero`, `ProductCard`, etc.)
 */
export function validateParentChildCompatibility(
  parentNode: EditorNode | null,
  childNode: EditorNode,
  slotName?: string,
  registry: VisualComponentRegistry = defaultComponentRegistry,
  ignoreExistingChildId?: string,
): {
  valid: boolean;
  code?: StructuralErrorCode;
  reason?: string;
} {
  const childCap = registry.getTrustedCapabilities(childNode.type);
  if (!childCap) {
    return {
      valid: false,
      code: "UNSUPPORTED_OPERATION",
      reason: `Unknown component type "${childNode.type}".`,
    };
  }

  // Moving to document.root
  if (parentNode === null) {
    if (slotName) {
      return {
        valid: false,
        code: "INVALID_SLOT",
        reason: "Document root does not support named slots.",
      };
    }
    // Only section/layout/storefront blocks or root-capable components belong at document.root;
    // GridItem cannot sit directly at document.root without a parent Grid.
    if (childNode.type === "GridItem") {
      return {
        valid: false,
        code: "INVALID_PARENT",
        reason: "GridItem must be placed inside a Grid or Container, not at the document root.",
      };
    }
    return { valid: true };
  }

  const parentCap = registry.getTrustedCapabilities(parentNode.type);
  if (!parentCap) {
    return {
      valid: false,
      code: "INVALID_PARENT",
      reason: `Unknown parent component type "${parentNode.type}".`,
    };
  }

  if (parentCap.isLeaf || LEAF_COMPONENT_TYPES.has(parentNode.type)) {
    return {
      valid: false,
      code: "INVALID_PARENT",
      reason: `Leaf component "${parentCap.displayName}" (${parentNode.type}) cannot contain child elements.`,
    };
  }

  if (childCap.isRootOnly || ROOT_ONLY_COMPONENT_TYPES.has(childNode.type)) {
    return {
      valid: false,
      code: "INVALID_PARENT",
      reason: `Root-only component "${childCap.displayName}" (${childNode.type}) cannot be nested inside "${parentNode.type}".`,
    };
  }

  if (parentNode.type === "Grid" && childNode.type === "Section") {
    return {
      valid: false,
      code: "INVALID_PARENT",
      reason: `A full "Section" cannot be nested directly inside a "Grid" container.`,
    };
  }

  // Prevent nesting a dynamic repeated category template inside another container
  if (childNode.binding?.kind === "repeated_category_sections") {
    return {
      valid: false,
      code: "PROTECTED_COMPONENT",
      reason: "Dynamic repeated category section templates must remain at the page root.",
    };
  }

  // Prevent nesting arbitrary children inside a dynamic repeated category template section
  if (
    parentNode.binding?.kind === "repeated_category_sections" &&
    childNode.type !== "Heading" &&
    childNode.type !== "Text"
  ) {
    return {
      valid: false,
      code: "PROTECTED_COMPONENT",
      reason: `Dynamic category template "${parentNode.name}" manages its sector cards at runtime and cannot accept "${childNode.type}" children.`,
    };
  }

  // Specialized storefront sections (PlanetHero, FestivalSection, ProductScrollRail, FeaturedCollection, InterestSection, BenefitsSection, InstagramSection)
  // are self-contained storefront adapters that do not render arbitrary generic child trees unless placed in a supported slot.
  const GENERIC_CONTAINER_TYPES = new Set<ComponentType>([
    "Section",
    "Container",
    "Stack",
    "Grid",
    "GridItem",
    "Shape",
    "Overlay",
  ]);

  if (!GENERIC_CONTAINER_TYPES.has(parentNode.type)) {
    return {
      valid: false,
      code: "INVALID_PARENT",
      reason: `Specialized storefront component "${parentCap.displayName}" (${parentNode.type}) does not accept arbitrary nested child nodes.`,
    };
  }

  // Check named slot rules if slotName is specified
  if (slotName) {
    const slotDef = parentCap.supportedSlots.find((s) => s.slotName === slotName);
    if (!slotDef) {
      return {
        valid: false,
        code: "INVALID_SLOT",
        reason: `Component "${parentNode.type}" does not support slot "${slotName}".`,
      };
    }
    if (
      slotDef.allowedChildTypes &&
      slotDef.allowedChildTypes.length > 0 &&
      !slotDef.allowedChildTypes.includes(childNode.type)
    ) {
      return {
        valid: false,
        code: "INVALID_SLOT",
        reason: `Slot "${slotName}" on "${parentNode.type}" does not allow "${childNode.type}" children.`,
      };
    }
    if (slotDef.maxChildren !== undefined) {
      const existingSlotNodes = (parentNode.slots?.[slotName] ?? []).filter(
        (n) => n.id !== ignoreExistingChildId,
      );
      if (existingSlotNodes.length >= slotDef.maxChildren) {
        return {
          valid: false,
          code: "INVALID_SLOT",
          reason: `Slot "${slotName}" on "${parentNode.type}" has reached its maximum child count (${slotDef.maxChildren}).`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Lightweight structural invariant check after an in-memory structural command.
 * Validates node count, max depth, unique node IDs, parent-child nesting, and leaf constraints
 * in a single fast pass (`< 0.4ms` for 1,000 nodes), falling back to full `safeParsePageDocument`
 * when needed.
 */
export function validateStructuralDocumentIntegrity(
  doc: PageDocument,
  options?: { runFullZodParse?: boolean },
): {
  valid: boolean;
  code?: StructuralErrorCode;
  message?: string;
} {
  const seenIds = new Set<string>();
  let nodeCount = 0;

  const checkNode = (
    node: EditorNode,
    depth: number,
    parentNode: EditorNode | null,
    slotKey?: string,
  ): { valid: boolean; code?: StructuralErrorCode; message?: string } => {
    nodeCount += 1;
    if (nodeCount > MAX_DOCUMENT_NODES) {
      return {
        valid: false,
        code: "SCHEMA_VALIDATION_FAILED",
        message: `Document exceeds maximum allowed node count (${MAX_DOCUMENT_NODES}).`,
      };
    }
    if (depth > MAX_DOCUMENT_DEPTH) {
      return {
        valid: false,
        code: "INVALID_DEPTH",
        message: `Node "${node.name || node.id}" at depth ${depth} exceeds maximum nesting depth (${MAX_DOCUMENT_DEPTH}).`,
      };
    }
    if (seenIds.has(node.id)) {
      return {
        valid: false,
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node ID "${node.id}" detected in document hierarchy.`,
      };
    }
    seenIds.add(node.id);

    if (parentNode) {
      if (LEAF_COMPONENT_TYPES.has(parentNode.type)) {
        return {
          valid: false,
          code: "INVALID_PARENT",
          message: `Leaf component "${parentNode.type}" cannot contain child "${node.type}".`,
        };
      }
      if (ROOT_ONLY_COMPONENT_TYPES.has(node.type)) {
        return {
          valid: false,
          code: "INVALID_PARENT",
          message: `Root-only component "${node.type}" cannot be nested inside "${parentNode.type}".`,
        };
      }
      if (parentNode.type === "Grid" && node.type === "Section") {
        return {
          valid: false,
          code: "INVALID_PARENT",
          message: `Component "Grid" cannot contain child of type "Section".`,
        };
      }
    }

    if (LEAF_COMPONENT_TYPES.has(node.type) && node.children.length > 0) {
      return {
        valid: false,
        code: "INVALID_PARENT",
        message: `Leaf component "${node.type}" cannot have child nodes.`,
      };
    }

    for (const child of node.children) {
      const res = checkNode(child, depth + 1, node, undefined);
      if (!res.valid) return res;
    }

    if (node.slots) {
      for (const [sKey, sList] of Object.entries(node.slots)) {
        for (const slotChild of sList) {
          const res = checkNode(slotChild, depth + 1, node, sKey);
          if (!res.valid) return res;
        }
      }
    }

    return { valid: true };
  };

  for (const rootNode of doc.root) {
    const res = checkNode(rootNode, 1, null, undefined);
    if (!res.valid) return res;
  }

  if (options?.runFullZodParse) {
    const parsed = safeParsePageDocument(doc);
    if (!parsed.success) {
      return {
        valid: false,
        code: "SCHEMA_VALIDATION_FAILED",
        message: parsed.issues[0]?.message ?? "Document failed schema validation.",
      };
    }
  }

  return { valid: true };
}

/**
 * Resolves the complete set of structural editing permissions and disabled reasons
 * for a given layer or selection target ID (Prompt 11, Part 3, Section 11 & Part 13, Section 40).
 */
export function resolveLayerOperationPermissions(
  document: PageDocument,
  targetId: string | null | undefined,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): LayerOperationPermissions {
  const emptyPermissions: LayerOperationPermissions = {
    targetId: targetId ?? "",
    isDocumentNode: false,
    isRuntimeInstance: false,
    isGlobalChrome: false,
    isDirectlyLocked: true,
    isAncestorLocked: false,
    isEffectivelyLocked: true,
    lockedByAncestorName: null,
    canRename: false,
    renameDisabledReason: "No editable component selected.",
    canDuplicate: false,
    duplicateDisabledReason: "No editable component selected.",
    canToggleVisibility: false,
    visibilityDisabledReason: "No editable component selected.",
    canToggleLock: false,
    lockDisabledReason: "No editable component selected.",
    canMoveUp: false,
    moveUpDisabledReason: "No editable component selected.",
    canMoveDown: false,
    moveDownDisabledReason: "No editable component selected.",
    canMoveToContainer: false,
    compatibleTargetContainers: [],
    canWrapInContainer: false,
    wrapDisabledReason: "No editable component selected.",
    canUnwrapContainer: false,
    unwrapDisabledReason: "No editable component selected.",
    canDelete: false,
    deleteDisabledReason: "No editable component selected.",
    descendantCount: 0,
  };

  const identity = parseStudioNodeIdentity(targetId);
  if (!identity) return emptyPermissions;

  if (identity.kind === "global_chrome") {
    const chromeMsg =
      "Shared global storefront chrome (Header/Footer) is managed at the route level and cannot be structurally modified.";
    return {
      ...emptyPermissions,
      targetId: identity.rawId,
      isGlobalChrome: true,
      renameDisabledReason: chromeMsg,
      duplicateDisabledReason: chromeMsg,
      visibilityDisabledReason: chromeMsg,
      lockDisabledReason: chromeMsg,
      moveUpDisabledReason: chromeMsg,
      moveDownDisabledReason: chromeMsg,
      wrapDisabledReason: chromeMsg,
      unwrapDisabledReason: chromeMsg,
      deleteDisabledReason: chromeMsg,
    };
  }

  if (identity.isRuntimeInstance) {
    const runtimeMsg =
      "Runtime product/category instances are dynamically bound from catalog data. Select the parent section template to edit structure.";
    return {
      ...emptyPermissions,
      targetId: identity.rawId,
      isRuntimeInstance: true,
      renameDisabledReason: runtimeMsg,
      duplicateDisabledReason: runtimeMsg,
      visibilityDisabledReason: runtimeMsg,
      lockDisabledReason: runtimeMsg,
      moveUpDisabledReason: runtimeMsg,
      moveDownDisabledReason: runtimeMsg,
      wrapDisabledReason: runtimeMsg,
      unwrapDisabledReason: runtimeMsg,
      deleteDisabledReason: runtimeMsg,
    };
  }

  if (!identity.documentNodeId) return emptyPermissions;

  const index = getDocumentNodeLookupIndex(document);
  const node = index.nodeById.get(identity.documentNodeId);
  if (!node) return emptyPermissions;

  const cap = registry.getTrustedCapabilities(node.type);
  const lockStatus = isNodeEffectivelyLocked(document, node.id, index);
  const parentId = index.parentIdById.get(node.id) ?? null;
  const parentNode = parentId ? (index.nodeById.get(parentId) ?? null) : null;
  const slotKey = index.slotKeyById.get(node.id);
  const indexInParent = index.indexInParentById.get(node.id) ?? 0;
  const depth = index.depthById.get(node.id) ?? 1;
  const subtreeHeight = getSubtreeHeight(node);
  const descendantCount = countSubtreeDescendants(node);

  const lockedReason = lockStatus.lockedAncestor
    ? `Locked by parent "${lockStatus.lockedAncestor.name || lockStatus.lockedAncestor.type}".`
    : lockStatus.direct
      ? `Component "${node.name || node.type}" is locked. Unlock it first.`
      : undefined;

  // 1. Rename
  const canRename = !lockStatus.locked && !cap?.isGlobalChrome;
  const renameDisabledReason = canRename
    ? undefined
    : (lockedReason ?? "This component cannot be renamed.");

  // 2. Toggle Lock (allowed if not global chrome and not locked by an ancestor)
  const canToggleLock = !cap?.isGlobalChrome && !lockStatus.lockedAncestor;
  const lockDisabledReason = canToggleLock
    ? undefined
    : lockStatus.lockedAncestor
      ? `Parent "${lockStatus.lockedAncestor.name || lockStatus.lockedAncestor.type}" is locked.`
      : "Global route chrome lock state cannot be changed.";

  // 3. Toggle Visibility
  const isProtectedBackground = Boolean(cap?.isGlobalBackgroundLayer);
  const canToggleVisibility = !lockStatus.locked && !cap?.isGlobalChrome && !isProtectedBackground;
  const visibilityDisabledReason = canToggleVisibility
    ? undefined
    : lockedReason
      ? lockedReason
      : isProtectedBackground
        ? "Global celestial background visibility is protected."
        : "Global route chrome visibility cannot be changed.";

  // 4. Sibling Reordering (Move Up / Move Down)
  const siblings: readonly EditorNode[] = parentNode
    ? slotKey
      ? (parentNode.slots?.[slotKey] ?? [])
      : parentNode.children
    : document.root;

  let canMoveUp = false;
  let moveUpDisabledReason: string | undefined;
  let canMoveDown = false;
  let moveDownDisabledReason: string | undefined;

  if (lockStatus.locked) {
    moveUpDisabledReason = lockedReason;
    moveDownDisabledReason = lockedReason;
  } else if (!cap?.draggable || (parentNode === null && isPinnedRootComponent(node, registry))) {
    const pinMsg = `"${node.name || node.type}" is pinned in place and cannot be reordered.`;
    moveUpDisabledReason = pinMsg;
    moveDownDisabledReason = pinMsg;
  } else {
    // Check previous sibling
    if (indexInParent <= 0) {
      moveUpDisabledReason = "Already at the top of its container.";
    } else {
      const prevSibling = siblings[indexInParent - 1];
      if (parentNode === null && prevSibling && isPinnedRootComponent(prevSibling, registry)) {
        moveUpDisabledReason = `Cannot move above pinned component "${prevSibling.name || prevSibling.type}".`;
      } else {
        canMoveUp = true;
      }
    }

    // Check next sibling
    if (indexInParent >= siblings.length - 1) {
      moveDownDisabledReason = "Already at the bottom of its container.";
    } else {
      const nextSibling = siblings[indexInParent + 1];
      if (parentNode === null && nextSibling && isPinnedRootComponent(nextSibling, registry)) {
        moveDownDisabledReason = `Cannot move below pinned component "${nextSibling.name || nextSibling.type}".`;
      } else {
        canMoveDown = true;
      }
    }
  }

  // 5. Duplication
  const isDynamicCategoriesTemplate = node.binding?.kind === "repeated_category_sections";
  let canDuplicate = false;
  let duplicateDisabledReason: string | undefined;

  if (lockStatus.locked) {
    duplicateDisabledReason = lockedReason;
  } else if (
    !cap?.duplicable ||
    cap.isGlobalChrome ||
    cap.isGlobalBackgroundLayer ||
    cap.isRootOnly
  ) {
    duplicateDisabledReason = `"${cap?.displayName ?? node.type}" is a protected singleton component and cannot be duplicated.`;
  } else if (isDynamicCategoriesTemplate) {
    duplicateDisabledReason =
      "Dynamic repeated category template cannot be duplicated in the page document.";
  } else {
    canDuplicate = true;
  }

  // 6. Deletion
  let canDelete = false;
  let deleteDisabledReason: string | undefined;

  if (lockStatus.locked) {
    deleteDisabledReason = lockedReason;
  } else if (
    !cap?.deletable ||
    cap.isGlobalChrome ||
    cap.isGlobalBackgroundLayer ||
    cap.isRootOnly
  ) {
    deleteDisabledReason = `"${cap?.displayName ?? node.type}" is a protected core storefront component and cannot be removed.`;
  } else if (isDynamicCategoriesTemplate) {
    deleteDisabledReason =
      "Dynamic category template is required for storefront category sectors. Hide it instead if needed.";
  } else {
    canDelete = true;
  }

  // 7. Wrap in Container
  let canWrapInContainer = false;
  let wrapDisabledReason: string | undefined;

  if (lockStatus.locked) {
    wrapDisabledReason = lockedReason;
  } else if (cap?.isRootOnly || ROOT_ONLY_COMPONENT_TYPES.has(node.type) || cap?.isGlobalChrome) {
    wrapDisabledReason = `Root-only component "${node.name || node.type}" cannot be wrapped in a container.`;
  } else if (isDynamicCategoriesTemplate) {
    wrapDisabledReason = "Dynamic repeated category template must remain at the page root.";
  } else if (depth + subtreeHeight > MAX_DOCUMENT_DEPTH) {
    wrapDisabledReason = `Wrapping would exceed maximum nesting depth (${MAX_DOCUMENT_DEPTH}).`;
  } else {
    canWrapInContainer = true;
  }

  // 8. Unwrap Container
  let canUnwrapContainer = false;
  let unwrapDisabledReason: string | undefined;

  if (lockStatus.locked) {
    unwrapDisabledReason = lockedReason;
  } else if (
    (node.type !== "Container" && node.type !== "Stack" && node.type !== "Section") ||
    Boolean(node.binding)
  ) {
    unwrapDisabledReason = "Only generic Container, Stack, or Section layers can be unwrapped.";
  } else if (node.children.length === 0) {
    unwrapDisabledReason = "Container has no child elements to unwrap.";
  } else {
    const allChildrenCompatibleWithParent = node.children.every(
      (child) => validateParentChildCompatibility(parentNode, child, slotKey, registry).valid,
    );
    if (!allChildrenCompatibleWithParent) {
      unwrapDisabledReason =
        "One or more child elements are not compatible with the parent container.";
    } else {
      canUnwrapContainer = true;
    }
  }

  // 9. Compatible Target Containers for Cross-Parent Move
  const compatibleTargetContainers: CompatibleContainerDestination[] = [];
  if (!lockStatus.locked && cap?.draggable && !isDynamicCategoriesTemplate) {
    // Check moving to document.root (if not already at root)
    if (
      parentNode !== null &&
      validateParentChildCompatibility(null, node, undefined, registry).valid
    ) {
      compatibleTargetContainers.push({
        id: null,
        label: "Page Root (Top-Level Section)",
        componentType: "PageRoot",
        depth: 0,
      });
    }

    // Collect all unlocked, non-descendant generic container nodes in the document
    for (const [candidateId, candidateNode] of index.nodeById.entries()) {
      if (candidateId === node.id) continue;
      if (candidateId === parentId && !slotKey) continue;

      const candidateAncestors = index.ancestorIdsById.get(candidateId) ?? [];
      if (candidateAncestors.includes(node.id)) continue; // Prevent circular move into own descendant

      const candidateLock = isNodeEffectivelyLocked(document, candidateId, index);
      if (candidateLock.locked) continue;

      const candidateDepth = index.depthById.get(candidateId) ?? 1;
      if (candidateDepth + subtreeHeight > MAX_DOCUMENT_DEPTH) continue;

      const compat = validateParentChildCompatibility(
        candidateNode,
        node,
        undefined,
        registry,
        node.id,
      );
      if (compat.valid) {
        compatibleTargetContainers.push({
          id: candidateNode.id,
          label: candidateNode.name || candidateNode.type,
          componentType: candidateNode.type,
          depth: candidateDepth,
        });
      }
    }
  }

  return {
    targetId: node.id,
    isDocumentNode: true,
    isRuntimeInstance: false,
    isGlobalChrome: false,
    isDirectlyLocked: lockStatus.direct,
    isAncestorLocked: Boolean(lockStatus.lockedAncestor),
    isEffectivelyLocked: lockStatus.locked,
    lockedByAncestorName: lockStatus.lockedAncestor
      ? lockStatus.lockedAncestor.name || lockStatus.lockedAncestor.type
      : null,
    canRename,
    renameDisabledReason,
    canDuplicate,
    duplicateDisabledReason,
    canToggleVisibility,
    visibilityDisabledReason,
    canToggleLock,
    lockDisabledReason,
    canMoveUp,
    moveUpDisabledReason,
    canMoveDown,
    moveDownDisabledReason,
    canMoveToContainer: compatibleTargetContainers.length > 0,
    compatibleTargetContainers,
    canWrapInContainer,
    wrapDisabledReason,
    canUnwrapContainer,
    unwrapDisabledReason,
    canDelete,
    deleteDisabledReason,
    descendantCount,
  };
}
