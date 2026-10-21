import { getDocumentNodeLookupIndex, parseStudioNodeIdentity } from "../interactions/index";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import type { PageDocument } from "../schema/page-document";
import { updateNodeById } from "../utils/node-tree";
import {
  getLockedAncestorNode,
  withUpdatedStructuralTimestamp,
  type StructuralOperationResult,
} from "./structural-validation";

/**
 * Locks or unlocks a supported `EditorNode` in the working `PageDocument`
 * (Prompt 11, Part 10, Sections 30–32).
 *
 * Rules enforced:
 * - Global route chrome (`StoreHeader`, `StoreFooter`) and runtime instances cannot have their lock state changed.
 * - If an ancestor node is locked, descendants cannot be unlocked or modified independently (`LOCKED_ANCESTOR`).
 * - Does not write redundant `locked` flags onto every descendant; ancestor lock inheritance is resolved dynamically.
 */
export function setNodeLock(
  document: PageDocument,
  targetId: string,
  locked: boolean,
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
      message: "Shared global route chrome (Header/Footer) is permanently locked.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message:
        "Runtime product/category instances cannot be locked directly; lock the parent section instead.",
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

  const cap = registry.getTrustedCapabilities(node.type);
  if (cap?.isGlobalChrome) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: `"${node.name || node.type}" is global storefront chrome and cannot be unlocked.`,
      document,
    };
  }

  const lockedAncestor = getLockedAncestorNode(document, node.id, index);
  if (lockedAncestor) {
    return {
      ok: false,
      code: "LOCKED_ANCESTOR",
      message: `Cannot change lock state of "${node.name || node.type}" while parent "${lockedAncestor.name || lockedAncestor.type}" is locked.`,
      document,
    };
  }

  if (Boolean(node.locked) === locked) {
    return {
      ok: true,
      message: locked
        ? `Layer "${node.name || node.type}" is already locked.`
        : `Layer "${node.name || node.type}" is already unlocked.`,
      document,
      selectedNodeId: node.id,
      affectedNodeIds: [node.id],
    };
  }

  const updatedDoc = updateNodeById(document, node.id, (current) => ({
    ...current,
    locked,
  }));

  return {
    ok: true,
    message: locked
      ? `Locked "${node.name || node.type}".`
      : `Unlocked "${node.name || node.type}".`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: node.id,
    affectedNodeIds: [node.id],
  };
}
