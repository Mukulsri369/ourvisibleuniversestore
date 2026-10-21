import { getDocumentNodeLookupIndex, parseStudioNodeIdentity } from "../interactions/index";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import { MAX_DOCUMENT_NODES, type PageDocument } from "../schema/page-document";
import { cloneSubtreeWithFreshIds, insertChildNode } from "../utils/node-tree";
import {
  countSubtreeDescendants,
  isNodeEffectivelyLocked,
  validateParentChildCompatibility,
  validateStructuralDocumentIntegrity,
  withUpdatedStructuralTimestamp,
  type StructuralOperationResult,
} from "./structural-validation";

/**
 * Duplicates a supported `EditorNode` and all its nested descendants with fresh unique IDs,
 * inserting the clone immediately adjacent (`indexInParent + 1`) to the original
 * (Prompt 11, Part 8, Sections 23–26).
 *
 * Rules enforced:
 * - Global storefront chrome (`StoreHeader`, `StoreFooter`), `CelestialScrollWorld`, `PlanetHero`,
 *   `FestivalSection` (`duplicable: false`), and `repeated_category_sections` templates cannot be duplicated.
 * - Runtime catalog instances (`virtual_product`, `virtual_category`, `virtual_category_card`) cannot be duplicated
 *   so product/category database records and affiliate links are never duplicated or mutated.
 * - Locked nodes and descendants of locked ancestors cannot be duplicated.
 */
export function duplicateNode(
  document: PageDocument,
  targetId: string,
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
        "Shared global storefront chrome (Header/Footer) is a singleton and cannot be duplicated.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message:
        "Runtime product/category instances are bound to catalog records and cannot be duplicated in the page editor.",
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
        ? `Cannot duplicate "${node.name || node.type}" while parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}" is locked.`
        : `Component "${node.name || node.type}" is locked. Unlock it before duplicating.`,
      document,
    };
  }

  const cap = registry.getTrustedCapabilities(node.type);
  if (
    !cap ||
    !cap.duplicable ||
    cap.isGlobalChrome ||
    cap.isGlobalBackgroundLayer ||
    cap.isRootOnly
  ) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: `"${cap?.displayName ?? node.type}" is a protected singleton component and cannot be duplicated.`,
      document,
    };
  }

  if (node.binding?.kind === "repeated_category_sections") {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: "Dynamic repeated category template cannot be duplicated in the page document.",
      document,
    };
  }

  const totalNodesToClone = 1 + countSubtreeDescendants(node);
  if (index.nodeById.size + totalNodesToClone > MAX_DOCUMENT_NODES) {
    return {
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
      message: `Duplicating "${node.name || node.type}" would exceed maximum document node count (${MAX_DOCUMENT_NODES}).`,
      document,
    };
  }

  const parentId = index.parentIdById.get(node.id) ?? null;
  const parentNode = parentId ? (index.nodeById.get(parentId) ?? null) : null;
  const slotKey = index.slotKeyById.get(node.id);
  const indexInParent = index.indexInParentById.get(node.id) ?? 0;

  // Verify slot maxChildren if duplicating inside a named slot
  if (parentNode && slotKey) {
    const compat = validateParentChildCompatibility(parentNode, node, slotKey, registry);
    if (!compat.valid) {
      return {
        ok: false,
        code: compat.code ?? "INVALID_SLOT",
        message: compat.reason ?? `Cannot duplicate inside slot "${slotKey}".`,
        document,
      };
    }
  }

  const existingIds = new Set<string>(index.nodeById.keys());
  const clonedSubtree = cloneSubtreeWithFreshIds(node, existingIds);

  const updatedDoc = insertChildNode(document, parentId, clonedSubtree, indexInParent + 1, slotKey);

  const integrity = validateStructuralDocumentIntegrity(updatedDoc);
  if (!integrity.valid) {
    return {
      ok: false,
      code: integrity.code ?? "SCHEMA_VALIDATION_FAILED",
      message: integrity.message ?? "Duplication failed document integrity validation.",
      document,
    };
  }

  return {
    ok: true,
    message: `Duplicated "${node.name || node.type}" as "${clonedSubtree.name}".`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: clonedSubtree.id,
    affectedNodeIds: [clonedSubtree.id],
    expandLayerIds: parentId ? [parentId] : [],
  };
}
