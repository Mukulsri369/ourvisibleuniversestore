import { getDocumentNodeLookupIndex, parseStudioNodeIdentity } from "../interactions/index";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import type { EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import type { EditorBreakpoint } from "../schema/responsive";
import { removeNodeById, updateNodeById } from "../utils/node-tree";
import { duplicateNode } from "./duplicate-node";
import {
  createCompatibleContainer,
  unwrapContainer,
  wrapNodeInContainer,
  type GroupingContainerType,
} from "./grouping";
import { setNodeLock } from "./locking";
import { moveNodeToContainer, reorderSiblingNode } from "./move-node";
import {
  countSubtreeDescendants,
  isNodeEffectivelyLocked,
  validateStructuralDocumentIntegrity,
  withUpdatedStructuralTimestamp,
  type StructuralOperationResult,
} from "./structural-validation";
import { setNodeVisibility } from "./visibility";

export type StructuralCommand =
  | {
      readonly type: "RenameNode";
      readonly targetId: string;
      readonly newName: string;
    }
  | {
      readonly type: "ReorderNode";
      readonly targetId: string;
      readonly direction: "up" | "down" | number;
    }
  | {
      readonly type: "MoveNode";
      readonly targetId: string;
      readonly destinationParentId: string | null;
      readonly slotName?: string;
      readonly index?: number;
    }
  | {
      readonly type: "DuplicateNode";
      readonly targetId: string;
    }
  | {
      readonly type: "SetVisibility";
      readonly targetId: string;
      readonly visible: boolean;
      readonly breakpoint?: EditorBreakpoint;
    }
  | {
      readonly type: "SetLock";
      readonly targetId: string;
      readonly locked: boolean;
    }
  | {
      readonly type: "RemoveNode";
      readonly targetId: string;
    }
  | {
      readonly type: "WrapNodeInContainer";
      readonly targetId: string;
      readonly containerType?: GroupingContainerType;
    }
  | {
      readonly type: "UnwrapContainer";
      readonly targetId: string;
    }
  | {
      readonly type: "CreateContainer";
      readonly parentTargetId: string | null;
      readonly containerType?: GroupingContainerType;
    };

export interface DeletionImpactSummary {
  readonly canDelete: boolean;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly componentType: string;
  readonly kindLabel: "design element" | "page section" | "container with nested elements";
  readonly descendantCount: number;
  readonly requiresConfirmation: boolean;
  readonly confirmationTitle: string;
  readonly confirmationMessage: string;
}

const UNSAFE_NAME_PATTERN = /<script|javascript:|on[a-z]+\s*=/i;

/**
 * Renames a supported `EditorNode` layer in the working `PageDocument`
 * (Prompt 11, Part 4, Sections 12–13).
 *
 * Rules enforced:
 * - Updates only `node.name` (editor/document layer metadata); never modifies product titles,
 *   category records, affiliate URLs, route slugs, or visible customer-facing heading props.
 * - Rejects empty strings, strings > 120 characters, or unsafe HTML/script patterns.
 * - Rejects renaming locked nodes or descendants of locked ancestors.
 */
export function renameLayerNode(
  document: PageDocument,
  targetId: string,
  newName: string,
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
      message: "Global route chrome layers are locked and cannot be renamed in the page document.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message:
        "Runtime product/category instances derive their names from catalog records and cannot be renamed in the layer tree.",
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

  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > 120) {
    return {
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
      message: "Layer name must be between 1 and 120 characters.",
      document,
    };
  }

  if (UNSAFE_NAME_PATTERN.test(trimmed)) {
    return {
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
      message: "Layer name contains unsafe HTML or script patterns.",
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

  const cap = registry.getTrustedCapabilities(node.type);
  if (cap?.isGlobalChrome) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: "Global storefront chrome layers cannot be renamed.",
      document,
    };
  }

  const lockState = isNodeEffectivelyLocked(document, node.id, index);
  if (lockState.locked) {
    return {
      ok: false,
      code: lockState.lockedAncestor ? "LOCKED_ANCESTOR" : "LOCKED_NODE",
      message: lockState.lockedAncestor
        ? `Cannot rename "${node.name || node.type}" while parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}" is locked.`
        : `Component "${node.name || node.type}" is locked. Unlock it before renaming.`,
      document,
    };
  }

  if (node.name === trimmed) {
    return {
      ok: true,
      message: `Layer name unchanged ("${trimmed}").`,
      document,
      selectedNodeId: node.id,
      affectedNodeIds: [node.id],
    };
  }

  const updatedDoc = updateNodeById(document, node.id, (current) => ({
    ...current,
    name: trimmed,
  }));

  return {
    ok: true,
    message: `Renamed layer to "${trimmed}".`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: node.id,
    affectedNodeIds: [node.id],
  };
}

/**
 * Computes a clear, specific deletion impact summary so confirmation dialogs state whether
 * the user is removing a design element, a complete page section, or a container with nested elements
 * (Prompt 11, Part 11, Section 34).
 */
export function describeDeletionImpact(
  document: PageDocument,
  targetId: string,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): DeletionImpactSummary | null {
  const identity = parseStudioNodeIdentity(targetId);
  if (!identity || identity.kind !== "document_node" || !identity.documentNodeId) {
    return null;
  }

  const index = getDocumentNodeLookupIndex(document);
  const node = index.nodeById.get(identity.documentNodeId);
  if (!node) return null;

  const cap = registry.getTrustedCapabilities(node.type);
  const lockState = isNodeEffectivelyLocked(document, node.id, index);
  const descendantCount = countSubtreeDescendants(node);
  const parentId = index.parentIdById.get(node.id) ?? null;

  const isSectionLevel =
    parentId === null ||
    cap?.category === "section" ||
    node.type === "Section" ||
    node.type === "FeaturedCollection" ||
    node.type === "FestivalSection" ||
    node.type === "ProductScrollRail" ||
    node.type === "ProductGrid" ||
    node.type === "CategoryGrid" ||
    node.type === "InterestSection" ||
    node.type === "BenefitsSection" ||
    node.type === "InstagramSection" ||
    node.type === "PromotionalBanner";

  const kindLabel: DeletionImpactSummary["kindLabel"] =
    descendantCount > 0
      ? "container with nested elements"
      : isSectionLevel
        ? "page section"
        : "design element";

  const canDelete =
    !lockState.locked &&
    Boolean(cap?.deletable) &&
    !cap?.isGlobalChrome &&
    !cap?.isGlobalBackgroundLayer &&
    !cap?.isRootOnly &&
    node.binding?.kind !== "repeated_category_sections";

  const nodeName = node.name || cap?.displayName || node.type;

  const confirmationTitle =
    kindLabel === "container with nested elements"
      ? `Remove "${nodeName}" and ${descendantCount} nested ${descendantCount === 1 ? "element" : "elements"}?`
      : kindLabel === "page section"
        ? `Remove page section "${nodeName}"?`
        : `Remove design element "${nodeName}"?`;

  const confirmationMessage =
    kindLabel === "container with nested elements"
      ? `This will remove container "${nodeName}" (${node.type}) along with ${descendantCount} nested child ${descendantCount === 1 ? "element" : "elements"} from the current working draft. Storefront product/category database records and media assets will not be deleted.`
      : kindLabel === "page section"
        ? `This will remove the "${nodeName}" (${node.type}) section from the current working draft. Storefront product/category database records and published live pages remain untouched until you publish.`
        : `This will remove the "${nodeName}" (${node.type}) design element from the current working draft.`;

  return {
    canDelete,
    nodeId: node.id,
    nodeName,
    componentType: node.type,
    kindLabel,
    descendantCount,
    requiresConfirmation: isSectionLevel || descendantCount > 0,
    confirmationTitle,
    confirmationMessage,
  };
}

/**
 * Safely removes a supported `EditorNode` (and its subtree) from the working `PageDocument`,
 * computing an appropriate surviving selection target and recording a reversible `undoSnapshot`
 * (Prompt 11, Part 11, Sections 33–36).
 */
export function removeLayerNode(
  document: PageDocument,
  targetId: string,
  currentSelectedId: string | null = null,
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
      message: "Shared global route chrome (Header/Footer) is required and cannot be deleted.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message:
        "Runtime product/category instances are bound to catalog records and cannot be deleted from the page editor.",
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
        ? `Cannot remove "${node.name || node.type}" while parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}" is locked.`
        : `Component "${node.name || node.type}" is locked. Unlock it before removing.`,
      document,
    };
  }

  const cap = registry.getTrustedCapabilities(node.type);
  if (
    !cap ||
    !cap.deletable ||
    cap.isGlobalChrome ||
    cap.isGlobalBackgroundLayer ||
    cap.isRootOnly
  ) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: `"${cap?.displayName ?? node.type}" is a protected core component and cannot be removed.`,
      document,
    };
  }

  if (node.binding?.kind === "repeated_category_sections") {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message:
        "Dynamic repeated category template is required for storefront category sectors. Hide it instead if needed.",
      document,
    };
  }

  const parentId = index.parentIdById.get(node.id) ?? null;
  const parentNode = parentId ? (index.nodeById.get(parentId) ?? null) : null;
  const slotKey = index.slotKeyById.get(node.id);
  const indexInParent = index.indexInParentById.get(node.id) ?? 0;

  // Determine whether the active selection was on `node`, a descendant of `node`, or a runtime instance of `node`
  let selectionWasRemoved = false;
  if (currentSelectedId) {
    const selIdentity = parseStudioNodeIdentity(currentSelectedId);
    if (selIdentity?.documentNodeId) {
      if (selIdentity.documentNodeId === node.id) {
        selectionWasRemoved = true;
      } else {
        const selAncestors = index.ancestorIdsById.get(selIdentity.documentNodeId) ?? [];
        if (selAncestors.includes(node.id)) {
          selectionWasRemoved = true;
        }
      }
    }
  }

  // Compute surviving selection fallback (nearest sibling or surviving parent)
  let nextSelectedId: string | null = currentSelectedId;
  if (selectionWasRemoved || currentSelectedId === node.id) {
    const siblings: readonly EditorNode[] = parentNode
      ? slotKey
        ? (parentNode.slots?.[slotKey] ?? [])
        : parentNode.children
      : document.root;

    const remainingSiblings = siblings.filter((s) => s.id !== node.id);
    if (parentId !== null) {
      // Prefer surviving parent when a nested child is removed, or adjacent sibling
      const fallbackSibling =
        remainingSiblings[Math.min(indexInParent, remainingSiblings.length - 1)];
      nextSelectedId = fallbackSibling?.id ?? parentId;
    } else {
      const fallbackRootSibling =
        remainingSiblings[Math.min(indexInParent, remainingSiblings.length - 1)];
      nextSelectedId = fallbackRootSibling?.id ?? null;
    }
  }

  const updatedDoc = removeNodeById(document, node.id);
  const integrity = validateStructuralDocumentIntegrity(updatedDoc);
  if (!integrity.valid) {
    return {
      ok: false,
      code: integrity.code ?? "SCHEMA_VALIDATION_FAILED",
      message: integrity.message ?? "Removal failed document integrity validation.",
      document,
    };
  }

  const descendantCount = countSubtreeDescendants(node);
  const removedSuffix =
    descendantCount > 0
      ? ` and ${descendantCount} nested ${descendantCount === 1 ? "element" : "elements"}`
      : "";

  return {
    ok: true,
    message: `Removed "${node.name || node.type}"${removedSuffix}.`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: nextSelectedId,
    affectedNodeIds: [node.id],
    undoSnapshot: {
      description: `Restore "${node.name || node.type}"`,
      previousDocument: document,
      previousSelectedNodeId: currentSelectedId ?? node.id,
    },
  };
}

/**
 * Centralized atomic structural command dispatcher (Prompt 11, Part 13, Sections 40–42).
 * All layer tree buttons, context menus, and keyboard shortcuts route through this function.
 */
export function executeStructuralCommand(
  document: PageDocument,
  command: StructuralCommand,
  currentSelectedId: string | null = null,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StructuralOperationResult {
  switch (command.type) {
    case "RenameNode":
      return renameLayerNode(document, command.targetId, command.newName, registry);

    case "ReorderNode":
      return reorderSiblingNode(document, command.targetId, command.direction, registry);

    case "MoveNode":
      return moveNodeToContainer(
        document,
        command.targetId,
        command.destinationParentId,
        {
          slotName: command.slotName,
          index: command.index,
        },
        registry,
      );

    case "DuplicateNode":
      return duplicateNode(document, command.targetId, registry);

    case "SetVisibility":
      return setNodeVisibility(
        document,
        command.targetId,
        command.visible,
        { breakpoint: command.breakpoint },
        registry,
      );

    case "SetLock":
      return setNodeLock(document, command.targetId, command.locked, registry);

    case "RemoveNode":
      return removeLayerNode(document, command.targetId, currentSelectedId, registry);

    case "WrapNodeInContainer":
      return wrapNodeInContainer(
        document,
        command.targetId,
        command.containerType ?? "Container",
        registry,
      );

    case "UnwrapContainer":
      return unwrapContainer(document, command.targetId, registry);

    case "CreateContainer":
      return createCompatibleContainer(
        document,
        command.parentTargetId,
        command.containerType ?? "Container",
        registry,
      );
  }
}
