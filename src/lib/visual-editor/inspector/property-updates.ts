import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import { FORBIDDEN_BUSINESS_DATA_KEYS } from "../schema/bindings";
import type { EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import {
  EDITOR_BREAKPOINTS,
  NodeStyleBundleSchema,
  type EditorBreakpoint,
  type NodeStyleBundle,
  type ResponsiveOverrides,
} from "../schema/responsive";
import { isNodeEffectivelyLocked } from "../structure/index";
import { parseStudioNodeIdentity } from "../studio/studio-selection";
import { findNodeById, updateNodeById } from "../utils/node-tree";
import {
  evaluateInspectorStylePathSupport,
  getAllowedInspectorLayoutModes,
  type InspectorStylePath,
} from "./property-capabilities";
import {
  createInspectorErrorResult,
  type InspectorPropertyUpdateResult,
} from "./property-errors";
import { containsUnsafeCssOrScript } from "./property-validation";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Immutably sets a value at a dot-separated path inside a `NodeStyleBundle`.
 * Preserves all sibling properties and nested objects.
 */
export function setNestedPropertyInBundle(
  bundle: NodeStyleBundle | undefined,
  path: InspectorStylePath | string,
  value: unknown,
): NodeStyleBundle {
  if (value === undefined || value === null) {
    return unsetNestedPropertyInBundle(bundle, path);
  }

  const segments = path.split(".");
  const rootClone: Record<string, unknown> = { ...(bundle ?? {}) };

  let cursor: Record<string, unknown> = rootClone;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const existing = cursor[key];
    const nextChild: Record<string, unknown> = isPlainObject(existing) ? { ...existing } : {};
    cursor[key] = nextChild;
    cursor = nextChild;
  }

  const lastKey = segments[segments.length - 1];
  cursor[lastKey] = value;

  return rootClone as NodeStyleBundle;
}

/**
 * Immutably removes a property at a dot-separated path inside a `NodeStyleBundle`
 * and prunes empty intermediate objects without affecting sibling properties.
 */
export function unsetNestedPropertyInBundle(
  bundle: NodeStyleBundle | undefined,
  path: InspectorStylePath | string,
): NodeStyleBundle {
  if (!bundle) return {};
  const segments = path.split(".");

  const removeRecursive = (
    current: Record<string, unknown>,
    index: number,
  ): Record<string, unknown> => {
    const key = segments[index];
    if (!(key in current)) {
      return current;
    }

    if (index === segments.length - 1) {
      const next = { ...current };
      delete next[key];
      return next;
    }

    const child = current[key];
    if (!isPlainObject(child)) {
      return current;
    }

    const updatedChild = removeRecursive(child, index + 1);
    const next = { ...current };
    if (Object.keys(updatedChild).length === 0) {
      delete next[key];
    } else {
      next[key] = updatedChild;
    }
    return next;
  };

  return removeRecursive(bundle as Record<string, unknown>, 0) as NodeStyleBundle;
}

function isStyleBundleEmpty(bundle: NodeStyleBundle | undefined): boolean {
  if (!bundle) return true;
  return Object.entries(bundle).every(([, v]) => {
    if (v === undefined) return true;
    if (isPlainObject(v)) {
      return Object.keys(v).length === 0;
    }
    return false;
  });
}

function withUpdatedMetadataTimestamp(
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

interface VerifiedEditableNodeTarget {
  readonly ok: true;
  readonly targetNodeId: string;
  readonly targetNode: EditorNode;
}

function verifyEditableNodeTarget(
  document: PageDocument,
  selectedId: string,
): VerifiedEditableNodeTarget | InspectorPropertyUpdateResult {
  const identity = parseStudioNodeIdentity(selectedId);
  if (!identity) {
    return createInspectorErrorResult(
      document,
      "NODE_NOT_FOUND",
      `Target "${selectedId}" is not a valid Studio node identifier.`,
    );
  }

  if (identity.kind === "global_chrome") {
    return createInspectorErrorResult(
      document,
      "GLOBAL_CHROME_LOCKED",
      "Global Store Header and Footer layers are shared across all routes and locked in the page document.",
    );
  }

  if (
    identity.kind === "virtual_product" ||
    identity.kind === "virtual_category_card"
  ) {
    return createInspectorErrorResult(
      document,
      "RUNTIME_INSTANCE_READONLY",
      "Rendered catalog card instances are bound to live product/category data. Select the parent collection or a standalone card node to customize presentation.",
    );
  }

  const targetNodeId = identity.documentNodeId;
  const targetNode = findNodeById(document, targetNodeId);
  if (!targetNode) {
    return createInspectorErrorResult(
      document,
      "NODE_NOT_FOUND",
      `Node "${targetNodeId}" was not found in the PageDocument.`,
    );
  }

  const lockState = isNodeEffectivelyLocked(document, targetNodeId);
  if (lockState.locked) {
    if (lockState.lockedAncestor) {
      return createInspectorErrorResult(
        document,
        "ANCESTOR_LOCKED",
        `Component "${targetNode.name || targetNode.type}" is locked by parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}".`,
      );
    }
    return createInspectorErrorResult(
      document,
      "NODE_LOCKED",
      `Component "${targetNode.name || targetNode.type}" is locked.`,
    );
  }

  return {
    ok: true,
    targetNodeId,
    targetNode,
  };
}

function containsUnsafeDeepString(value: unknown): boolean {
  if (typeof value === "string") {
    return containsUnsafeCssOrScript(value);
  }
  if (typeof value === "number") {
    return !Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsUnsafeDeepString);
  }
  if (isPlainObject(value)) {
    return Object.values(value).some(containsUnsafeDeepString);
  }
  return false;
}

/**
 * Central authoritative property update pathway for any `InspectorStylePath`.
 * Enforces:
 * 1. Node existence, global chrome boundary, and runtime instance protection.
 * 2. Effective lock state (`isNodeEffectivelyLocked`, including ancestor locks).
 * 3. Protected business data blocklist (`FORBIDDEN_BUSINESS_DATA_KEYS`).
 * 4. Trusted component capability matrix (`evaluateInspectorStylePathSupport`).
 * 5. Component-specific layout mode restrictions (`getAllowedInspectorLayoutModes`).
 * 6. Deep safety check against non-finite numbers and unsafe CSS/script injection.
 * 7. `NodeStyleBundleSchema` Zod validation.
 * 8. `O(depth)` structural sharing via `updateNodeById`.
 */
export function updateInspectorStyleProperty(
  document: PageDocument,
  selectedId: string,
  path: InspectorStylePath | string,
  value: unknown,
  breakpoint: EditorBreakpoint = "desktop",
  registry: VisualComponentRegistry = defaultComponentRegistry,
): InspectorPropertyUpdateResult {
  if (!EDITOR_BREAKPOINTS.includes(breakpoint)) {
    return createInspectorErrorResult(
      document,
      "INVALID_PROPERTY_VALUE",
      `Invalid responsive breakpoint "${String(breakpoint)}".`,
      path,
    );
  }

  const lastSegment = path.split(".").pop() ?? path;
  if (FORBIDDEN_BUSINESS_DATA_KEYS.has(path) || FORBIDDEN_BUSINESS_DATA_KEYS.has(lastSegment)) {
    return createInspectorErrorResult(
      document,
      "FORBIDDEN_BUSINESS_PROPERTY",
      `Protected business property "${path}" cannot be modified through visual style controls.`,
      path,
    );
  }

  // Delegate `null` / `undefined` to path-level reset
  if (value === undefined || value === null) {
    return resetInspectorStyleProperty(document, selectedId, path, breakpoint, registry);
  }

  const verified = verifyEditableNodeTarget(document, selectedId);
  if (!verified.ok) {
    return verified;
  }

  const { targetNodeId, targetNode } = verified;
  const capabilities = registry.getTrustedCapabilities(targetNode.type);
  const supportEval = evaluateInspectorStylePathSupport(targetNode.type, path, capabilities);

  if (!supportEval.supported) {
    const isBlockedByList = capabilities?.unsupportedStylePaths.some(
      (b) => path === b || path.startsWith(`${b}.`),
    );
    return createInspectorErrorResult(
      document,
      isBlockedByList ? "UNSUPPORTED_STYLE_PATH" : "UNSUPPORTED_COMPONENT_CAPABILITY",
      supportEval.reason ??
        `Style path "${path}" is not supported on component "${targetNode.type}".`,
      path,
    );
  }

  // Validate layout.mode against allowed modes for this component adapter
  if (path === "layout.mode" || (path === "layout" && isPlainObject(value) && "mode" in value)) {
    const requestedMode =
      path === "layout.mode"
        ? String(value)
        : String((value as Record<string, unknown>).mode);
    const allowedModes = getAllowedInspectorLayoutModes(targetNode.type);
    if (!allowedModes.includes(requestedMode as never)) {
      return createInspectorErrorResult(
        document,
        "UNSUPPORTED_LAYOUT_MODE",
        `Component "${targetNode.type}" does not support layout mode "${requestedMode}". Allowed modes: ${allowedModes.length > 0 ? allowedModes.join(", ") : "none"}.`,
        path,
      );
    }
  }

  // Deep check for NaN/Infinity or unsafe CSS/script strings
  if (containsUnsafeDeepString(value)) {
    return createInspectorErrorResult(
      document,
      "UNSAFE_VALUE_REJECTED",
      `Property "${path}" contains non-finite numbers or unsafe CSS/script expressions.`,
      path,
    );
  }

  // Special handling for `visible` at base desktop level vs responsive breakpoint
  if (path === "visible") {
    if (typeof value !== "boolean") {
      return createInspectorErrorResult(
        document,
        "INVALID_PROPERTY_VALUE",
        "Visibility must be a boolean value.",
        path,
      );
    }

    const updatedDoc = updateNodeById(document, targetNodeId, (node) => {
      if (breakpoint === "desktop") {
        return {
          ...node,
          hidden: !value,
        };
      }
      const currentBpBundle = node.responsive?.[breakpoint] ?? {};
      return {
        ...node,
        responsive: {
          ...node.responsive,
          [breakpoint]: {
            ...currentBpBundle,
            visible: value,
          },
        },
      };
    });

    return {
      ok: true,
      document: withUpdatedMetadataTimestamp(document, updatedDoc),
    };
  }

  const currentTargetBundle: NodeStyleBundle =
    breakpoint === "desktop"
      ? (targetNode.style ?? {})
      : (targetNode.responsive?.[breakpoint] ?? {});

  // If value is a partial nested object (e.g., updating `appearance.typography` or `layout.flex` or `layout.grid`),
  // merge with existing object at that path unless it is an atomic value object (`DimensionValue`, `SpacingBox`, `CornerRadiusConfig`).
  let nextBundle: NodeStyleBundle;
  const existingAtPath =
    path.split(".").reduce<unknown>((acc, seg) => (isPlainObject(acc) ? acc[seg] : undefined), currentTargetBundle);

  if (
    isPlainObject(value) &&
    isPlainObject(existingAtPath) &&
    !("unit" in value) &&
    path !== "geometry.padding" &&
    path !== "geometry.margin" &&
    path !== "shape.cornerRadius" &&
    path !== "appearance.backgroundGradient"
  ) {
    nextBundle = setNestedPropertyInBundle(currentTargetBundle, path, {
      ...existingAtPath,
      ...value,
    });
  } else {
    nextBundle = setNestedPropertyInBundle(currentTargetBundle, path, value);
  }

  const parsedBundle = NodeStyleBundleSchema.safeParse(nextBundle);
  if (!parsedBundle.success) {
    const issue = parsedBundle.error.issues[0];
    return createInspectorErrorResult(
      document,
      "INVALID_PROPERTY_VALUE",
      issue?.message ?? `Invalid style configuration for "${path}".`,
      path,
    );
  }

  const updatedDoc = updateNodeById(document, targetNodeId, (node) => {
    if (breakpoint === "desktop") {
      return {
        ...node,
        style: parsedBundle.data,
      };
    }

    return {
      ...node,
      responsive: {
        ...(node.responsive ?? {}),
        [breakpoint]: parsedBundle.data,
      },
    };
  });

  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}

/**
 * Resets a single style property path at the target `breakpoint` without erasing
 * sibling properties in `node.style` or `node.responsive[breakpoint]`.
 */
export function resetInspectorStyleProperty(
  document: PageDocument,
  selectedId: string,
  path: InspectorStylePath | string,
  breakpoint: EditorBreakpoint = "desktop",
  registry: VisualComponentRegistry = defaultComponentRegistry,
): InspectorPropertyUpdateResult {
  const verified = verifyEditableNodeTarget(document, selectedId);
  if (!verified.ok) {
    return verified;
  }

  const { targetNodeId, targetNode } = verified;
  void registry;

  if (path === "visible") {
    const updatedDoc = updateNodeById(document, targetNodeId, (node) => {
      if (breakpoint === "desktop") {
        if (!node.hidden) return node;
        return {
          ...node,
          hidden: false,
        };
      }
      const currentBp = node.responsive?.[breakpoint];
      if (!currentBp || currentBp.visible === undefined) return node;
      const nextBp = unsetNestedPropertyInBundle(currentBp, "visible");
      const nextResponsive: ResponsiveOverrides = { ...(node.responsive ?? {}) };
      if (isStyleBundleEmpty(nextBp)) {
        delete nextResponsive[breakpoint];
      } else {
        nextResponsive[breakpoint] = nextBp;
      }
      return {
        ...node,
        responsive: Object.keys(nextResponsive).length > 0 ? nextResponsive : undefined,
      };
    });

    return {
      ok: true,
      document: withUpdatedMetadataTimestamp(document, updatedDoc),
    };
  }

  const updatedDoc = updateNodeById(document, targetNodeId, (node) => {
    if (breakpoint === "desktop") {
      const nextStyle = unsetNestedPropertyInBundle(node.style, path);
      return {
        ...node,
        style: nextStyle,
      };
    }

    const currentBp = node.responsive?.[breakpoint];
    if (!currentBp) return node;

    const nextBp = unsetNestedPropertyInBundle(currentBp, path);
    const nextResponsive: ResponsiveOverrides = { ...(node.responsive ?? {}) };
    if (isStyleBundleEmpty(nextBp)) {
      delete nextResponsive[breakpoint];
    } else {
      nextResponsive[breakpoint] = nextBp;
    }

    return {
      ...node,
      responsive: Object.keys(nextResponsive).length > 0 ? nextResponsive : undefined,
    };
  });

  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}

/**
 * Resets all style overrides at a specific `breakpoint` on `selectedId`.
 */
export function resetInspectorBreakpointOverrides(
  document: PageDocument,
  selectedId: string,
  breakpoint: EditorBreakpoint,
): InspectorPropertyUpdateResult {
  const verified = verifyEditableNodeTarget(document, selectedId);
  if (!verified.ok) {
    return verified;
  }

  const { targetNodeId } = verified;

  const updatedDoc = updateNodeById(document, targetNodeId, (node) => {
    if (breakpoint === "desktop") {
      return {
        ...node,
        style: {},
      };
    }

    if (!node.responsive || !node.responsive[breakpoint]) {
      return node;
    }

    const nextResponsive: ResponsiveOverrides = { ...node.responsive };
    delete nextResponsive[breakpoint];

    return {
      ...node,
      responsive: Object.keys(nextResponsive).length > 0 ? nextResponsive : undefined,
    };
  });

  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}
