import { getDocumentNodeLookupIndex, parseStudioNodeIdentity } from "../interactions/index";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import type { PageDocument } from "../schema/page-document";
import type { EditorBreakpoint } from "../schema/responsive";
import { updateNodeById } from "../utils/node-tree";
import {
  isNodeEffectivelyLocked,
  withUpdatedStructuralTimestamp,
  type StructuralOperationResult,
} from "./structural-validation";

export interface SetVisibilityOptions {
  /**
   * When omitted or `"desktop"`, updates global node visibility (`node.hidden = !visible`).
   * When `"tablet"` or `"mobile"`, updates responsive visibility override (`node.responsive[breakpoint].visible = visible`)
   * without mutating global `node.hidden` (Prompt 11, Part 9, Section 28).
   */
  readonly breakpoint?: EditorBreakpoint;
}

/**
 * Shows or hides a supported `EditorNode` in the working `PageDocument`
 * (Prompt 11, Part 9, Sections 27–29).
 *
 * Rules enforced:
 * - Global route chrome (`StoreHeader`, `StoreFooter`) and `CelestialScrollWorld` cannot be hidden.
 * - Locked nodes or descendants of locked ancestors cannot be hidden/shown until unlocked.
 * - Preserves underlying node, children, and product/category bindings without deleting data.
 */
export function setNodeVisibility(
  document: PageDocument,
  targetId: string,
  visible: boolean,
  options?: SetVisibilityOptions,
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
        "Shared global route chrome (Header/Footer, including required legal affiliate disclosures) cannot be hidden.",
      document,
    };
  }

  if (identity.isRuntimeInstance) {
    return {
      ok: false,
      code: "RUNTIME_INSTANCE_PROTECTED",
      message:
        "Individual runtime catalog instances cannot be hidden from the page tree; hide the parent section template instead.",
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
      message: "Global storefront chrome and legal disclosure sections cannot be hidden.",
      document,
    };
  }

  if (cap?.isGlobalBackgroundLayer) {
    return {
      ok: false,
      code: "PROTECTED_COMPONENT",
      message: "Global celestial background layer visibility is protected.",
      document,
    };
  }

  const lockState = isNodeEffectivelyLocked(document, node.id, index);
  if (lockState.locked) {
    if (lockState.lockedAncestor) {
      return {
        ok: false,
        code: "LOCKED_ANCESTOR",
        message: `Cannot change visibility of "${node.name || node.type}" while parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}" is locked.`,
        document,
      };
    }
    return {
      ok: false,
      code: "LOCKED_NODE",
      message: `Component "${node.name || node.type}" is locked. Unlock it before changing visibility.`,
      document,
    };
  }

  const breakpoint = options?.breakpoint;
  const isResponsiveOverride = breakpoint !== undefined && breakpoint !== "desktop";

  const updatedDoc = updateNodeById(document, node.id, (current) => {
    if (!isResponsiveOverride) {
      const nextHidden = !visible;
      if (Boolean(current.hidden) === nextHidden) {
        return current;
      }
      return {
        ...current,
        hidden: nextHidden,
      };
    }

    const currentBpBundle = current.responsive?.[breakpoint] ?? {};
    if (currentBpBundle.visible === visible) {
      return current;
    }
    return {
      ...current,
      responsive: {
        ...current.responsive,
        [breakpoint]: {
          ...currentBpBundle,
          visible,
        },
      },
    };
  });

  const actionLabel = visible ? "Shown" : "Hidden";
  const scopeLabel = isResponsiveOverride ? ` on ${breakpoint}` : "";

  return {
    ok: true,
    message: `${actionLabel} "${node.name || node.type}"${scopeLabel}.`,
    document: withUpdatedStructuralTimestamp(document, updatedDoc),
    selectedNodeId: node.id,
    affectedNodeIds: [node.id],
  };
}
