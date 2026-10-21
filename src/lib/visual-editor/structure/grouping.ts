import { getDocumentNodeLookupIndex, parseStudioNodeIdentity } from "../interactions/index";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import { ROOT_ONLY_COMPONENT_TYPES, type EditorNode } from "../schema/nodes";
import { MAX_DOCUMENT_DEPTH, MAX_DOCUMENT_NODES, type PageDocument } from "../schema/page-document";
import { generateUniqueNodeId } from "../utils/ids";
import { insertChildNode, updateNodeById } from "../utils/node-tree";
import {
  getSubtreeHeight,
  isNodeEffectivelyLocked,
  validateParentChildCompatibility,
  validateStructuralDocumentIntegrity,
  withUpdatedStructuralTimestamp,
  type StructuralOperationResult,
} from "./structural-validation";

export type GroupingContainerType = "Container" | "Stack" | "Section";

/**
 * Wraps a supported `EditorNode` inside a new `Container` (or `Stack` / `Section`) at the exact same
 * position in its parent's `children` or `slots[slotKey]` array (Prompt 11, Part 12, Sections 37–38).
 *
 * Rules enforced:
 * - Applies clean, non-distorting layout defaults (`style: {}`) so wrapping does not force fixed widths,
 *   clip overflow, or inject unwanted margins.
 * - Rejects wrapping root-only components (`PlanetHero`, `CelestialScrollWorld`, `StoreHeader`, `StoreFooter`),
 *   dynamic category templates, or locked nodes.
 * - Validates `MAX_DOCUMENT_DEPTH` and `MAX_DOCUMENT_NODES`.
 */
export function wrapNodeInContainer(
  document: PageDocument,
  targetId: string,
  containerType: GroupingContainerType = "Container",
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
      message: "Shared global storefront chrome cannot be wrapped in a container.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message: "Runtime catalog instances cannot be wrapped individually.",
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
        ? `Cannot wrap "${node.name || node.type}" while parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}" is locked.`
        : `Component "${node.name || node.type}" is locked.`,
      document,
    };
  }

  const cap = registry.getTrustedCapabilities(node.type);
  if (cap?.isRootOnly || ROOT_ONLY_COMPONENT_TYPES.has(node.type) || cap?.isGlobalChrome) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: `Root-only component "${node.name || node.type}" cannot be wrapped inside a container.`,
      document,
    };
  }

  if (node.binding?.kind === "repeated_category_sections") {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: "Dynamic repeated category template must remain at the page root.",
      document,
    };
  }

  if (index.nodeById.size + 1 > MAX_DOCUMENT_NODES) {
    return {
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
      message: `Wrapping would exceed maximum document node count (${MAX_DOCUMENT_NODES}).`,
      document,
    };
  }

  const depth = index.depthById.get(node.id) ?? 1;
  const subtreeHeight = getSubtreeHeight(node);
  if (depth + subtreeHeight > MAX_DOCUMENT_DEPTH) {
    return {
      ok: false,
      code: "INVALID_DEPTH",
      message: `Wrapping "${node.name || node.type}" would exceed maximum nesting depth (${MAX_DOCUMENT_DEPTH}).`,
      document,
    };
  }

  const parentId = index.parentIdById.get(node.id) ?? null;
  const parentNode = parentId ? (index.nodeById.get(parentId) ?? null) : null;
  const slotKey = index.slotKeyById.get(node.id);
  const indexInParent = index.indexInParentById.get(node.id) ?? 0;

  const existingIds = new Set<string>(index.nodeById.keys());
  const wrapperId = generateUniqueNodeId(containerType, existingIds);

  const innerNode: EditorNode = node.slotName ? { ...node, slotName: undefined } : node;
  const wrapperNode: EditorNode = {
    id: wrapperId,
    type: containerType,
    name: `${node.name || node.type} ${containerType}`,
    ...(slotKey ? { slotName: slotKey } : {}),
    props: {},
    style: {},
    children: [innerNode],
  };

  // Validate that the parent accepts the new wrapper and the wrapper accepts `innerNode`
  const parentCompat = validateParentChildCompatibility(
    parentNode,
    wrapperNode,
    slotKey,
    registry,
    node.id,
  );
  if (!parentCompat.valid) {
    return {
      ok: false,
      code: parentCompat.code ?? "INVALID_PARENT",
      message: parentCompat.reason ?? `Cannot place "${containerType}" inside current parent.`,
      document,
    };
  }

  const childCompat = validateParentChildCompatibility(wrapperNode, innerNode, undefined, registry);
  if (!childCompat.valid) {
    return {
      ok: false,
      code: childCompat.code ?? "INVALID_PARENT",
      message: childCompat.reason ?? `Cannot wrap "${node.type}" inside "${containerType}".`,
      document,
    };
  }

  let updatedDoc: PageDocument;
  if (parentId === null) {
    const nextRoot = [...document.root];
    nextRoot[indexInParent] = wrapperNode;
    updatedDoc = { ...document, root: nextRoot };
  } else {
    updatedDoc = updateNodeById(document, parentId, (parent) => {
      if (slotKey && parent.slots?.[slotKey]) {
        const nextSlotList = [...parent.slots[slotKey]];
        nextSlotList[indexInParent] = wrapperNode;
        return {
          ...parent,
          slots: {
            ...parent.slots,
            [slotKey]: nextSlotList,
          },
        };
      }
      const nextChildren = [...parent.children];
      nextChildren[indexInParent] = wrapperNode;
      return {
        ...parent,
        children: nextChildren,
      };
    });
  }

  const integrity = validateStructuralDocumentIntegrity(updatedDoc);
  if (!integrity.valid) {
    return {
      ok: false,
      code: integrity.code ?? "SCHEMA_VALIDATION_FAILED",
      message: integrity.message ?? "Wrapping failed structural integrity validation.",
      document,
    };
  }

  return {
    ok: true,
    message: `Wrapped "${node.name || node.type}" in "${wrapperNode.name}".`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: wrapperNode.id,
    affectedNodeIds: [wrapperNode.id, node.id],
    expandLayerIds: [wrapperNode.id],
  };
}

/**
 * Unwraps a generic `Container` or `Stack`, moving its children into the container's parent
 * at the container's original index while preserving order (Prompt 11, Part 12, Section 39).
 */
export function unwrapContainer(
  document: PageDocument,
  containerTargetId: string,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StructuralOperationResult {
  const identity = parseStudioNodeIdentity(containerTargetId);
  if (!identity || identity.kind !== "document_node" || !identity.documentNodeId) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      message: "Only document Container or Stack layers can be unwrapped.",
      document,
    };
  }

  const index = getDocumentNodeLookupIndex(document);
  const containerNode = index.nodeById.get(identity.documentNodeId);
  if (!containerNode) {
    return {
      ok: false,
      code: "NODE_NOT_FOUND",
      message: `Container "${identity.documentNodeId}" was not found.`,
      document,
    };
  }

  const lockState = isNodeEffectivelyLocked(document, containerNode.id, index);
  if (lockState.locked) {
    return {
      ok: false,
      code: lockState.lockedAncestor ? "LOCKED_ANCESTOR" : "LOCKED_NODE",
      message: lockState.lockedAncestor
        ? `Cannot unwrap "${containerNode.name || containerNode.type}" while parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}" is locked.`
        : `Container "${containerNode.name || containerNode.type}" is locked.`,
      document,
    };
  }

  if (
    (containerNode.type !== "Container" &&
      containerNode.type !== "Stack" &&
      containerNode.type !== "Section") ||
    Boolean(containerNode.binding)
  ) {
    return {
      ok: false,
      code: "UNSUPPORTED_OPERATION",
      message: `Only generic "Container", "Stack", or "Section" layers can be unwrapped ("${containerNode.type}" is a specialized component).`,
      document,
    };
  }

  if (containerNode.children.length === 0) {
    return {
      ok: false,
      code: "UNSUPPORTED_OPERATION",
      message: `"${containerNode.name || containerNode.type}" has no child elements to unwrap. Remove the empty container instead.`,
      document,
    };
  }

  const parentId = index.parentIdById.get(containerNode.id) ?? null;
  const parentNode = parentId ? (index.nodeById.get(parentId) ?? null) : null;
  const slotKey = index.slotKeyById.get(containerNode.id);
  const indexInParent = index.indexInParentById.get(containerNode.id) ?? 0;

  for (const child of containerNode.children) {
    const compat = validateParentChildCompatibility(
      parentNode,
      child,
      slotKey,
      registry,
      containerNode.id,
    );
    if (!compat.valid) {
      return {
        ok: false,
        code: compat.code ?? "INVALID_PARENT",
        message:
          compat.reason ??
          `Child "${child.name || child.type}" is not compatible with parent "${parentNode?.type ?? "Page Root"}".`,
        document,
      };
    }
  }

  const promotedChildren: EditorNode[] = containerNode.children.map((child) =>
    slotKey
      ? { ...child, slotName: slotKey }
      : child.slotName
        ? { ...child, slotName: undefined }
        : child,
  );

  let updatedDoc: PageDocument;
  if (parentId === null) {
    const nextRoot = [...document.root];
    nextRoot.splice(indexInParent, 1, ...promotedChildren);
    updatedDoc = { ...document, root: nextRoot };
  } else {
    updatedDoc = updateNodeById(document, parentId, (parent) => {
      if (slotKey && parent.slots?.[slotKey]) {
        const nextSlotList = [...parent.slots[slotKey]];
        nextSlotList.splice(indexInParent, 1, ...promotedChildren);
        return {
          ...parent,
          slots: {
            ...parent.slots,
            [slotKey]: nextSlotList,
          },
        };
      }
      const nextChildren = [...parent.children];
      nextChildren.splice(indexInParent, 1, ...promotedChildren);
      return {
        ...parent,
        children: nextChildren,
      };
    });
  }

  const integrity = validateStructuralDocumentIntegrity(updatedDoc);
  if (!integrity.valid) {
    return {
      ok: false,
      code: integrity.code ?? "SCHEMA_VALIDATION_FAILED",
      message: integrity.message ?? "Unwrapping failed structural integrity validation.",
      document,
    };
  }

  const firstChildId = promotedChildren[0]?.id ?? parentId;

  return {
    ok: true,
    message: `Unwrapped "${containerNode.name || containerNode.type}" (${promotedChildren.length} child ${promotedChildren.length === 1 ? "element" : "elements"} promoted).`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: firstChildId,
    affectedNodeIds: promotedChildren.map((c) => c.id),
    expandLayerIds: parentId ? [parentId] : [],
    undoSnapshot: {
      description: `Restore container "${containerNode.name || containerNode.type}"`,
      previousDocument: document,
      previousSelectedNodeId: containerNode.id,
    },
  };
}

/**
 * Creates a new empty `Container` or `Stack` inside a compatible parent container (or at `document.root`)
 * so administrators can organize elements into containers (Prompt 11, Primary Objective #12 & Part 12, Section 37).
 */
export function createCompatibleContainer(
  document: PageDocument,
  parentTargetId: string | null,
  containerType: "Container" | "Stack" | "Section" = "Container",
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StructuralOperationResult {
  const index = getDocumentNodeLookupIndex(document);
  if (index.nodeById.size + 1 > MAX_DOCUMENT_NODES) {
    return {
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
      message: `Cannot add container: document has reached maximum node count (${MAX_DOCUMENT_NODES}).`,
      document,
    };
  }

  let parentNode: EditorNode | null = null;
  if (parentTargetId !== null) {
    const identity = parseStudioNodeIdentity(parentTargetId);
    if (!identity || identity.kind !== "document_node" || !identity.documentNodeId) {
      return {
        ok: false,
        code: "INVALID_PARENT",
        message: "Select a valid document section or container to insert into.",
        document,
      };
    }
    parentNode = index.nodeById.get(identity.documentNodeId) ?? null;
    if (!parentNode) {
      return {
        ok: false,
        code: "NODE_NOT_FOUND",
        message: `Parent "${parentTargetId}" was not found.`,
        document,
      };
    }

    const lockState = isNodeEffectivelyLocked(document, parentNode.id, index);
    if (lockState.locked) {
      return {
        ok: false,
        code: lockState.lockedAncestor ? "LOCKED_ANCESTOR" : "LOCKED_NODE",
        message: `Cannot add container inside locked component "${parentNode.name || parentNode.type}".`,
        document,
      };
    }

    const parentDepth = index.depthById.get(parentNode.id) ?? 1;
    if (parentDepth + 1 > MAX_DOCUMENT_DEPTH) {
      return {
        ok: false,
        code: "INVALID_DEPTH",
        message: `Adding a container inside "${parentNode.name || parentNode.type}" would exceed maximum nesting depth (${MAX_DOCUMENT_DEPTH}).`,
        document,
      };
    }
  }

  const existingIds = new Set<string>(index.nodeById.keys());
  const newId = generateUniqueNodeId(containerType, existingIds);
  const newContainer: EditorNode = {
    id: newId,
    type: containerType,
    name: `New ${containerType}`,
    props: {},
    style: {},
    children: [],
  };

  const compat = validateParentChildCompatibility(parentNode, newContainer, undefined, registry);
  if (!compat.valid) {
    return {
      ok: false,
      code: compat.code ?? "INVALID_PARENT",
      message:
        compat.reason ??
        `Cannot add "${containerType}" inside "${parentNode?.type ?? "Page Root"}".`,
      document,
    };
  }

  const updatedDoc = insertChildNode(document, parentNode ? parentNode.id : null, newContainer);
  const integrity = validateStructuralDocumentIntegrity(updatedDoc);
  if (!integrity.valid) {
    return {
      ok: false,
      code: integrity.code ?? "SCHEMA_VALIDATION_FAILED",
      message: integrity.message ?? "Creating container failed structural validation.",
      document,
    };
  }

  return {
    ok: true,
    message: `Created "${newContainer.name}".`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: newContainer.id,
    affectedNodeIds: [newContainer.id],
    expandLayerIds: parentNode ? [parentNode.id, newContainer.id] : [newContainer.id],
  };
}
