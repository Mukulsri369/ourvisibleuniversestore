import { FORBIDDEN_BUSINESS_DATA_KEYS } from "../schema/bindings";
import type { SpacingBox } from "../schema/geometry";
import { SafeComponentPropsSchema, type SafeComponentProps } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import {
  NodeStyleBundleSchema,
  type EditorBreakpoint,
  type NodeStyleBundle,
} from "../schema/responsive";
import { isNodeEffectivelyLocked } from "../structure/index";
import { findNodeById, updateNodeById } from "../utils/node-tree";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import { parseStudioNodeIdentity } from "./studio-selection";

export interface StudioPropertyEditResult {
  readonly ok: boolean;
  readonly document: PageDocument;
  readonly error?: string;
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

function resolveEditableTargetNodeId(selectedId: string): string | null {
  const identity = parseStudioNodeIdentity(selectedId);
  if (!identity || identity.kind === "global_chrome") return null;
  return identity.documentNodeId;
}

/**
 * Checks whether the working document has diverged from the last persisted document.
 * Fast-paths reference equality in O(1) time.
 */
export function isDocumentDirty(
  workingDocument: PageDocument,
  persistedDocument: PageDocument,
): boolean {
  if (workingDocument === persistedDocument) return false;
  return (
    JSON.stringify(workingDocument.root) !== JSON.stringify(persistedDocument.root) ||
    workingDocument.name !== persistedDocument.name ||
    JSON.stringify(workingDocument.settings) !== JSON.stringify(persistedDocument.settings)
  );
}

/**
 * Updates a node's human-readable layer display name (`node.name`).
 */
export function updateStudioNodeName(
  document: PageDocument,
  selectedId: string,
  newName: string,
): StudioPropertyEditResult {
  const targetId = resolveEditableTargetNodeId(selectedId);
  if (!targetId) {
    return {
      ok: false,
      document,
      error: "Global route chrome layers are locked and cannot be renamed in the page document.",
    };
  }

  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > 120) {
    return {
      ok: false,
      document,
      error: "Layer name must be between 1 and 120 characters.",
    };
  }

  if (/<script|javascript:|on[a-z]+\s*=/i.test(trimmed)) {
    return {
      ok: false,
      document,
      error: "Layer name contains unsafe HTML or script patterns.",
    };
  }

  const targetNode = findNodeById(document, targetId);
  if (!targetNode) {
    return { ok: false, document, error: `Node "${targetId}" was not found.` };
  }

  const lockState = isNodeEffectivelyLocked(document, targetId);
  if (lockState.locked) {
    return {
      ok: false,
      document,
      error: lockState.lockedAncestor
        ? `Component "${targetNode.name || targetNode.type}" is locked by parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}".`
        : `Component "${targetNode.name || targetNode.type}" is locked.`,
    };
  }

  if (targetNode.name === trimmed) {
    return { ok: true, document };
  }

  const updatedDoc = updateNodeById(document, targetId, (node) => ({
    ...node,
    name: trimmed,
  }));

  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}

/**
 * Updates a node's visibility (`node.hidden` at base level or `node.responsive[breakpoint].visible`).
 */
export function updateStudioNodeVisibility(
  document: PageDocument,
  selectedId: string,
  visible: boolean,
  breakpoint?: EditorBreakpoint,
): StudioPropertyEditResult {
  const targetId = resolveEditableTargetNodeId(selectedId);
  if (!targetId) {
    return {
      ok: false,
      document,
      error: "Global route chrome visibility cannot be modified from a page draft.",
    };
  }

  const targetNode = findNodeById(document, targetId);
  if (!targetNode) {
    return { ok: false, document, error: `Node "${targetId}" was not found.` };
  }

  const lockState = isNodeEffectivelyLocked(document, targetId);
  if (lockState.locked) {
    return {
      ok: false,
      document,
      error: lockState.lockedAncestor
        ? `Component "${targetNode.name || targetNode.type}" is locked by parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}".`
        : `Component "${targetNode.name || targetNode.type}" is locked.`,
    };
  }

  const updatedDoc = updateNodeById(document, targetId, (node) => {
    if (!breakpoint || breakpoint === "desktop") {
      return {
        ...node,
        hidden: !visible,
      };
    }

    const currentBpStyle = node.responsive?.[breakpoint] ?? {};
    return {
      ...node,
      responsive: {
        ...node.responsive,
        [breakpoint]: {
          ...currentBpStyle,
          visible,
        },
      },
    };
  });

  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}

/**
 * Updates a validated content property in `node.props` strictly checking:
 * 1. Protected business-data field blocklist (`FORBIDDEN_BUSINESS_DATA_KEYS`).
 * 2. Trusted component registry `editableProps` allowlist.
 * 3. `SafeComponentPropsSchema` Zod validation.
 */
export function updateStudioNodeProp<K extends keyof SafeComponentProps>(
  document: PageDocument,
  selectedId: string,
  propKey: K,
  propValue: SafeComponentProps[K],
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StudioPropertyEditResult {
  if (FORBIDDEN_BUSINESS_DATA_KEYS.has(String(propKey))) {
    return {
      ok: false,
      document,
      error: `Protected business property "${String(propKey)}" cannot be edited in the Design Studio.`,
    };
  }

  const targetId = resolveEditableTargetNodeId(selectedId);
  if (!targetId) {
    return {
      ok: false,
      document,
      error: "Global route chrome properties are managed in Store Settings.",
    };
  }

  const targetNode = findNodeById(document, targetId);
  if (!targetNode) {
    return { ok: false, document, error: `Node "${targetId}" was not found.` };
  }

  const lockState = isNodeEffectivelyLocked(document, targetId);
  if (lockState.locked) {
    return {
      ok: false,
      document,
      error: lockState.lockedAncestor
        ? `Component "${targetNode.name || targetNode.type}" is locked by parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}".`
        : `Component "${targetNode.name || targetNode.type}" is locked.`,
    };
  }

  const capabilities = registry.getTrustedCapabilities(targetNode.type);
  if (!capabilities || !capabilities.editableProps.includes(propKey)) {
    return {
      ok: false,
      document,
      error: `Property "${String(propKey)}" is not supported on component type "${targetNode.type}".`,
    };
  }

  const candidateProps: SafeComponentProps = {
    ...targetNode.props,
    [propKey]: propValue,
  };

  if (propValue === undefined || propValue === "") {
    delete candidateProps[propKey];
  }

  const parsedProps = SafeComponentPropsSchema.safeParse(candidateProps);
  if (!parsedProps.success) {
    return {
      ok: false,
      document,
      error: parsedProps.error.issues[0]?.message ?? "Invalid property value.",
    };
  }

  const updatedDoc = updateNodeById(document, targetId, (node) => ({
    ...node,
    props: parsedProps.data,
  }));

  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}

function applyStyleBundleUpdate(
  node: PageDocument["root"][number],
  breakpoint: EditorBreakpoint | undefined,
  updater: (current: NodeStyleBundle) => NodeStyleBundle,
): PageDocument["root"][number] {
  if (!breakpoint || breakpoint === "desktop") {
    const nextStyle = updater(node.style ?? {});
    return {
      ...node,
      style: nextStyle,
    };
  }

  const currentBpBundle = node.responsive?.[breakpoint] ?? {};
  const nextBpBundle = updater(currentBpBundle);
  return {
    ...node,
    responsive: {
      ...node.responsive,
      [breakpoint]: nextBpBundle,
    },
  };
}

/**
 * Updates a node's padding or margin `SpacingBox` in `style.geometry` (or responsive breakpoint override).
 * Enforces `capabilities.layoutSupport.padding` / `margin` and `NodeStyleBundleSchema`.
 */
export function updateStudioNodeSpacing(
  document: PageDocument,
  selectedId: string,
  field: "padding" | "margin",
  box: SpacingBox | undefined,
  breakpoint?: EditorBreakpoint,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StudioPropertyEditResult {
  const targetId = resolveEditableTargetNodeId(selectedId);
  if (!targetId) {
    return {
      ok: false,
      document,
      error: "Global route chrome spacing cannot be edited in the page document.",
    };
  }

  const targetNode = findNodeById(document, targetId);
  if (!targetNode) {
    return { ok: false, document, error: `Node "${targetId}" was not found.` };
  }

  const lockState = isNodeEffectivelyLocked(document, targetId);
  if (lockState.locked) {
    return {
      ok: false,
      document,
      error: lockState.lockedAncestor
        ? `Component "${targetNode.name || targetNode.type}" is locked by parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}".`
        : `Component "${targetNode.name || targetNode.type}" is locked.`,
    };
  }

  const capabilities = registry.getTrustedCapabilities(targetNode.type);
  if (!capabilities || !capabilities.layoutSupport[field]) {
    return {
      ok: false,
      document,
      error: `Component "${targetNode.type}" does not support ${field} overrides.`,
    };
  }

  const updatedNode = applyStyleBundleUpdate(targetNode, breakpoint, (bundle) => {
    const nextGeo = { ...bundle.geometry };
    if (box === undefined) {
      delete nextGeo[field];
    } else {
      nextGeo[field] = box;
    }
    return {
      ...bundle,
      geometry: nextGeo,
    };
  });

  const targetBundle =
    !breakpoint || breakpoint === "desktop"
      ? updatedNode.style
      : updatedNode.responsive?.[breakpoint];
  const validated = NodeStyleBundleSchema.safeParse(targetBundle);
  if (!validated.success) {
    return {
      ok: false,
      document,
      error: validated.error.issues[0]?.message ?? `Invalid ${field} spacing configuration.`,
    };
  }

  const updatedDoc = updateNodeById(document, targetId, () => updatedNode);
  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}

export interface StudioAppearancePatch {
  backgroundColor?: string | null;
  opacity?: number | null;
  cornerRadiusPx?: number | null;
}

/**
 * Updates a node's visual appearance (`backgroundColor`, `opacity`, or uniform `cornerRadius`)
 * in `style` (or responsive breakpoint override).
 * Enforces `capabilities.visualSupport` and `NodeStyleBundleSchema`.
 */
export function updateStudioNodeAppearance(
  document: PageDocument,
  selectedId: string,
  patch: StudioAppearancePatch,
  breakpoint?: EditorBreakpoint,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): StudioPropertyEditResult {
  const targetId = resolveEditableTargetNodeId(selectedId);
  if (!targetId) {
    return {
      ok: false,
      document,
      error: "Global route chrome appearance cannot be edited in the page document.",
    };
  }

  const targetNode = findNodeById(document, targetId);
  if (!targetNode) {
    return { ok: false, document, error: `Node "${targetId}" was not found.` };
  }

  const lockState = isNodeEffectivelyLocked(document, targetId);
  if (lockState.locked) {
    return {
      ok: false,
      document,
      error: lockState.lockedAncestor
        ? `Component "${targetNode.name || targetNode.type}" is locked by parent "${lockState.lockedAncestor.name || lockState.lockedAncestor.type}".`
        : `Component "${targetNode.name || targetNode.type}" is locked.`,
    };
  }

  const capabilities = registry.getTrustedCapabilities(targetNode.type);
  if (!capabilities) {
    return {
      ok: false,
      document,
      error: `Unknown component capabilities for "${targetNode.type}".`,
    };
  }

  if (patch.backgroundColor !== undefined && !capabilities.visualSupport.backgroundColor) {
    return {
      ok: false,
      document,
      error: `Component "${targetNode.type}" does not support background color overrides.`,
    };
  }

  if (patch.opacity !== undefined && !capabilities.visualSupport.opacity) {
    return {
      ok: false,
      document,
      error: `Component "${targetNode.type}" does not support opacity overrides.`,
    };
  }

  if (patch.cornerRadiusPx !== undefined && !capabilities.visualSupport.cornerRadius) {
    return {
      ok: false,
      document,
      error: `Component "${targetNode.type}" does not support corner radius overrides.`,
    };
  }

  const updatedNode = applyStyleBundleUpdate(targetNode, breakpoint, (bundle) => {
    const nextAppearance = { ...bundle.appearance };
    const nextShape = { ...bundle.shape };

    if (patch.backgroundColor !== undefined) {
      if (patch.backgroundColor === null || patch.backgroundColor === "") {
        delete nextAppearance.backgroundColor;
      } else {
        nextAppearance.backgroundColor = patch.backgroundColor;
      }
    }

    if (patch.opacity !== undefined) {
      if (patch.opacity === null) {
        delete nextAppearance.opacity;
      } else {
        nextAppearance.opacity = patch.opacity;
      }
    }

    if (patch.cornerRadiusPx !== undefined) {
      if (patch.cornerRadiusPx === null) {
        delete nextShape.cornerRadius;
      } else {
        nextShape.cornerRadius = {
          mode: "uniform",
          uniform: patch.cornerRadiusPx,
          unit: "px",
        };
      }
    }

    return {
      ...bundle,
      appearance: nextAppearance,
      shape: nextShape,
    };
  });

  const targetBundle =
    !breakpoint || breakpoint === "desktop"
      ? updatedNode.style
      : updatedNode.responsive?.[breakpoint];
  const validated = NodeStyleBundleSchema.safeParse(targetBundle);
  if (!validated.success) {
    return {
      ok: false,
      document,
      error: validated.error.issues[0]?.message ?? "Invalid appearance value.",
    };
  }

  const updatedDoc = updateNodeById(document, targetId, () => updatedNode);
  return {
    ok: true,
    document: withUpdatedMetadataTimestamp(document, updatedDoc),
  };
}
