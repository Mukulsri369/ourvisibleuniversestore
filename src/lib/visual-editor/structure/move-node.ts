import { getDocumentNodeLookupIndex, parseStudioNodeIdentity } from "../interactions/index";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import type { EditorNode } from "../schema/nodes";
import { MAX_DOCUMENT_DEPTH, type PageDocument } from "../schema/page-document";
import { insertChildNode, removeNodeById, reorderChildNodes } from "../utils/node-tree";
import {
  getSubtreeHeight,
  isNodeEffectivelyLocked,
  isPinnedRootComponent,
  validateParentChildCompatibility,
  validateStructuralDocumentIntegrity,
  withUpdatedStructuralTimestamp,
  type StructuralOperationResult,
} from "./structural-validation";

/**
 * Reorders a sibling node within its current parent (`children` or `slots[slotKey]`) or at `document.root`
 * (Prompt 11, Part 5, Sections 14–17 & Part 6, Sections 18–20).
 */
export function reorderSiblingNode(
  document: PageDocument,
  targetId: string,
  directionOrIndex: "up" | "down" | number,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StructuralOperationResult {
  const identity = parseStudioNodeIdentity(targetId);
  if (!identity) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      message: "Invalid layer target ID.",
      document,
    };
  }

  if (identity.kind === "global_chrome") {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message:
        "Shared global route chrome (Header/Footer) is fixed at the layout boundary and cannot be reordered.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message:
        "Runtime product/category instances follow catalog sort order and cannot be reordered in the page document.",
      document,
    };
  }

  if (!identity.documentNodeId) {
    return {
      ok: false,
      code: "NODE_NOT_FOUND",
      message: "Target component was not found in the page document.",
      document,
    };
  }

  const index = getDocumentNodeLookupIndex(document);
  const node = index.nodeById.get(identity.documentNodeId);
  if (!node) {
    return {
      ok: false,
      code: "NODE_NOT_FOUND",
      message: `Component "${identity.documentNodeId}" was not found in the page document.`,
      document,
    };
  }

  const lockState = isNodeEffectivelyLocked(document, node.id, index);
  if (lockState.locked) {
    return {
      ok: false,
      code: lockState.lockedAncestor ? "LOCKED_ANCESTOR" : "LOCKED_NODE",
      message: lockState.lockedAncestor
        ? `Cannot reorder "${node.name || node.type}" while parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}" is locked.`
        : `Component "${node.name || node.type}" is locked. Unlock it before reordering.`,
      document,
    };
  }

  const cap = registry.getTrustedCapabilities(node.type);
  const parentId = index.parentIdById.get(node.id) ?? null;
  const parentNode = parentId ? (index.nodeById.get(parentId) ?? null) : null;
  const slotKey = index.slotKeyById.get(node.id);
  const fromIndex = index.indexInParentById.get(node.id) ?? -1;

  if (!cap?.draggable || (parentNode === null && isPinnedRootComponent(node, registry))) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: `"${node.name || node.type}" is a pinned component and cannot be reordered.`,
      document,
    };
  }

  const siblings: readonly EditorNode[] = parentNode
    ? slotKey
      ? (parentNode.slots?.[slotKey] ?? [])
      : parentNode.children
    : document.root;

  const toIndex =
    directionOrIndex === "up"
      ? fromIndex - 1
      : directionOrIndex === "down"
        ? fromIndex + 1
        : directionOrIndex;

  if (toIndex < 0 || toIndex >= siblings.length) {
    return {
      ok: false,
      code: "UNSUPPORTED_OPERATION",
      message:
        directionOrIndex === "up"
          ? `"${node.name || node.type}" is already at the top of its container.`
          : directionOrIndex === "down"
            ? `"${node.name || node.type}" is already at the bottom of its container.`
            : `Target reorder index ${toIndex} is out of bounds.`,
      document,
    };
  }

  if (toIndex === fromIndex) {
    return {
      ok: true,
      message: `"${node.name || node.type}" order unchanged.`,
      document,
      selectedNodeId: node.id,
      affectedNodeIds: [node.id],
    };
  }

  // At document.root, ensure no pinned root component (`CelestialScrollWorld`, `PlanetHero`, `StoreHeader`, `StoreFooter`)
  // lies between `fromIndex` and `toIndex` (inclusive of `toIndex`).
  if (parentNode === null) {
    const minIdx = Math.min(fromIndex, toIndex);
    const maxIdx = Math.max(fromIndex, toIndex);
    for (let i = minIdx; i <= maxIdx; i += 1) {
      if (i === fromIndex) continue;
      const sibling = siblings[i];
      if (sibling && isPinnedRootComponent(sibling, registry)) {
        return {
          ok: false,
          code: "PROTECTED_COMPONENT",
          message: `Cannot move "${node.name || node.type}" past pinned component "${sibling.name || sibling.type}".`,
          document,
        };
      }
    }
  }

  const updatedDoc = reorderChildNodes(document, parentId, fromIndex, toIndex, slotKey);
  const integrity = validateStructuralDocumentIntegrity(updatedDoc);
  if (!integrity.valid) {
    return {
      ok: false,
      code: integrity.code ?? "SCHEMA_VALIDATION_FAILED",
      message: integrity.message ?? "Reordering produced an invalid document structure.",
      document,
    };
  }

  const directionLabel =
    directionOrIndex === "up"
      ? "Moved up"
      : directionOrIndex === "down"
        ? "Moved down"
        : `Moved to position ${toIndex + 1}`;

  return {
    ok: true,
    message: `${directionLabel} "${node.name || node.type}".`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: node.id,
    affectedNodeIds: [node.id],
  };
}

export interface MoveNodeDestinationOptions {
  readonly slotName?: string;
  readonly index?: number;
}

/**
 * Moves an eligible `EditorNode` into a compatible parent container (or `null` for `document.root`)
 * and optional named slot (Prompt 11, Part 7, Sections 21–22).
 */
export function moveNodeToContainer(
  document: PageDocument,
  sourceTargetId: string,
  destinationParentId: string | null,
  options?: MoveNodeDestinationOptions,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StructuralOperationResult {
  const identity = parseStudioNodeIdentity(sourceTargetId);
  if (!identity) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      message: "Invalid source layer ID.",
      document,
    };
  }

  if (identity.kind === "global_chrome") {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: "Shared global storefront chrome cannot be moved into a container.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message: "Runtime catalog instances cannot be moved independently of their bound collection.",
      document,
    };
  }

  if (!identity.documentNodeId) {
    return {
      ok: false,
      code: "NODE_NOT_FOUND",
      message: "Source component was not found in the page document.",
      document,
    };
  }

  const index = getDocumentNodeLookupIndex(document);
  const sourceNode = index.nodeById.get(identity.documentNodeId);
  if (!sourceNode) {
    return {
      ok: false,
      code: "NODE_NOT_FOUND",
      message: `Source component "${identity.documentNodeId}" was not found.`,
      document,
    };
  }

  // 1. Check source lock state
  const sourceLock = isNodeEffectivelyLocked(document, sourceNode.id, index);
  if (sourceLock.locked) {
    return {
      ok: false,
      code: sourceLock.lockedAncestor ? "LOCKED_ANCESTOR" : "LOCKED_NODE",
      message: sourceLock.lockedAncestor
        ? `Cannot move "${sourceNode.name || sourceNode.type}" while parent "${sourceLock.lockedAncestor.name || sourceLock.lockedAncestor.type}" is locked.`
        : `Component "${sourceNode.name || sourceNode.type}" is locked.`,
      document,
    };
  }

  const sourceCap = registry.getTrustedCapabilities(sourceNode.type);
  if (!sourceCap?.draggable) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: `"${sourceNode.name || sourceNode.type}" is pinned and cannot be moved.`,
      document,
    };
  }

  // 2. Resolve destination parent
  let destParentNode: EditorNode | null = null;
  if (destinationParentId !== null) {
    const destIdentity = parseStudioNodeIdentity(destinationParentId);
    if (!destIdentity || destIdentity.kind !== "document_node" || !destIdentity.documentNodeId) {
      return {
        ok: false,
        code: "INVALID_PARENT",
        message: "Destination must be a valid container in the page document.",
        document,
      };
    }

    destParentNode = index.nodeById.get(destIdentity.documentNodeId) ?? null;
    if (!destParentNode) {
      return {
        ok: false,
        code: "NODE_NOT_FOUND",
        message: `Destination container "${destinationParentId}" was not found.`,
        document,
      };
    }

    // 3. Reject circular moves (into self or own descendant)
    if (destParentNode.id === sourceNode.id) {
      return {
        ok: false,
        code: "CIRCULAR_MOVE",
        message: `Cannot move "${sourceNode.name || sourceNode.type}" inside itself.`,
        document,
      };
    }

    const destAncestors = index.ancestorIdsById.get(destParentNode.id) ?? [];
    if (destAncestors.includes(sourceNode.id)) {
      return {
        ok: false,
        code: "CIRCULAR_MOVE",
        message: `Cannot move "${sourceNode.name || sourceNode.type}" into its own descendant "${destParentNode.name || destParentNode.type}".`,
        document,
      };
    }

    // 4. Check destination lock state
    const destLock = isNodeEffectivelyLocked(document, destParentNode.id, index);
    if (destLock.locked) {
      return {
        ok: false,
        code: destLock.lockedAncestor ? "LOCKED_ANCESTOR" : "LOCKED_NODE",
        message: destLock.lockedAncestor
          ? `Destination "${destParentNode.name || destParentNode.type}" is locked by ancestor "${destLock.lockedAncestor.name || destLock.lockedAncestor.type}".`
          : `Destination container "${destParentNode.name || destParentNode.type}" is locked.`,
        document,
      };
    }
  }

  const destSlotName = options?.slotName;

  // 5. Validate parent-child and slot compatibility
  const compat = validateParentChildCompatibility(
    destParentNode,
    sourceNode,
    destSlotName,
    registry,
    sourceNode.id,
  );
  if (!compat.valid) {
    return {
      ok: false,
      code: compat.code ?? "INVALID_PARENT",
      message: compat.reason ?? "Incompatible destination container or slot.",
      document,
    };
  }

  // 6. Validate resulting depth
  const destDepth = destParentNode ? (index.depthById.get(destParentNode.id) ?? 1) : 0;
  const sourceSubtreeHeight = getSubtreeHeight(sourceNode);
  if (destDepth + sourceSubtreeHeight > MAX_DOCUMENT_DEPTH) {
    return {
      ok: false,
      code: "INVALID_DEPTH",
      message: `Moving "${sourceNode.name || sourceNode.type}" into "${destParentNode?.name ?? "root"}" would exceed maximum nesting depth (${MAX_DOCUMENT_DEPTH}).`,
      document,
    };
  }

  const currentParentId = index.parentIdById.get(sourceNode.id) ?? null;
  const currentSlotKey = index.slotKeyById.get(sourceNode.id);

  // If moving within the same parent and same slot, delegate to reorderSiblingNode
  if (currentParentId === (destParentNode?.id ?? null) && currentSlotKey === destSlotName) {
    if (options?.index !== undefined) {
      return reorderSiblingNode(document, sourceNode.id, options.index, registry);
    }
    return {
      ok: true,
      message: `"${sourceNode.name || sourceNode.type}" is already inside "${destParentNode?.name ?? "Page Root"}".`,
      document,
      selectedNodeId: sourceNode.id,
      affectedNodeIds: [sourceNode.id],
    };
  }

  // If moving to root (`destParentNode === null`), ensure target index does not precede pinned root nodes
  const targetInsertIndex = options?.index;
  const docWithoutSource = removeNodeById(document, sourceNode.id);
  if (destParentNode === null && targetInsertIndex !== undefined) {
    let minAllowedRootIndex = 0;
    for (let i = 0; i < docWithoutSource.root.length; i += 1) {
      const rNode = docWithoutSource.root[i];
      if (isPinnedRootComponent(rNode, registry) && i === minAllowedRootIndex) {
        minAllowedRootIndex = i + 1;
      }
    }
    if (targetInsertIndex < minAllowedRootIndex) {
      return {
        ok: false,
        code: "PROTECTED_COMPONENT",
        message: "Cannot move section above pinned root background or hero components.",
        document,
      };
    }
  }

  const updatedDoc = insertChildNode(
    docWithoutSource,
    destParentNode ? destParentNode.id : null,
    sourceNode,
    targetInsertIndex,
    destSlotName,
  );

  const integrity = validateStructuralDocumentIntegrity(updatedDoc);
  if (!integrity.valid) {
    return {
      ok: false,
      code: integrity.code ?? "SCHEMA_VALIDATION_FAILED",
      message: integrity.message ?? "Move operation failed structural integrity validation.",
      document,
    };
  }

  const destLabel = destParentNode
    ? `${destParentNode.name || destParentNode.type}${destSlotName ? ` (${destSlotName})` : ""}`
    : "Page Root";

  return {
    ok: true,
    message: `Moved "${sourceNode.name || sourceNode.type}" to ${destLabel}.`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: sourceNode.id,
    affectedNodeIds: [sourceNode.id, ...(destParentNode ? [destParentNode.id] : [])],
    expandLayerIds: destParentNode ? [destParentNode.id] : [],
  };
}
