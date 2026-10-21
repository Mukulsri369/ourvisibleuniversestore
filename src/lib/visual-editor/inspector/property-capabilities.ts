import {
  TRUSTED_COMPONENT_CAPABILITIES,
  type SupportedLayoutProperties,
  type SupportedVisualProperties,
  type TrustedComponentCapabilities as ComponentCapabilityProfile,
} from "../registry/component-capabilities";
import type { LayoutMode } from "../schema/layout";
import type { EditorComponentType } from "../schema/nodes";

export type InspectorStylePath =
  | "visible"
  | "geometry"
  | "geometry.width"
  | "geometry.height"
  | "geometry.minWidth"
  | "geometry.maxWidth"
  | "geometry.minHeight"
  | "geometry.maxHeight"
  | "geometry.aspectRatio"
  | "geometry.padding"
  | "geometry.margin"
  | "geometry.overflowX"
  | "geometry.overflowY"
  | "geometry.position"
  | "geometry.zIndex"
  | "layout"
  | "layout.mode"
  | "layout.flex"
  | "layout.flex.direction"
  | "layout.flex.wrap"
  | "layout.flex.justifyContent"
  | "layout.flex.alignItems"
  | "layout.flex.columnGapPx"
  | "layout.flex.rowGapPx"
  | "layout.grid"
  | "layout.grid.columns"
  | "layout.grid.rows"
  | "layout.grid.columnGapPx"
  | "layout.grid.rowGapPx"
  | "layout.grid.autoFlow"
  | "layout.grid.alignItems"
  | "layout.grid.justifyItems"
  | "flexItem"
  | "flexItem.grow"
  | "flexItem.shrink"
  | "flexItem.basisPx"
  | "flexItem.alignSelf"
  | "gridItem"
  | "gridItem.colSpan"
  | "gridItem.rowSpan"
  | "gridItem.colStart"
  | "gridItem.rowStart"
  | "gridItem.alignSelf"
  | "gridItem.justifySelf"
  | "appearance"
  | "appearance.backgroundColor"
  | "appearance.backgroundGradient"
  | "appearance.border"
  | "appearance.shadow"
  | "appearance.opacity"
  | "appearance.filters"
  | "appearance.typography"
  | "appearance.typography.fontFamily"
  | "appearance.typography.fontSize"
  | "appearance.typography.fontWeight"
  | "appearance.typography.lineHeight"
  | "appearance.typography.letterSpacingEm"
  | "appearance.typography.textAlign"
  | "appearance.typography.color"
  | "appearance.typography.textTransform"
  | "appearance.typography.textDecoration"
  | "appearance.typography.fontStyle"
  | "shape"
  | "shape.shapeType"
  | "shape.cornerRadius"
  | "shape.clipPreset"
  | "shape.clipOverflow"
  | "shape.imageCrop";

export interface StylePathSupportEvaluation {
  readonly supported: boolean;
  readonly reason?: string;
}

/**
 * Returns the layout modes genuinely supported by the component's adapter in Phase 3.
 * Restricts `bento`, `masonry`, `carousel`, and `freeform` mode switches unless the
 * underlying component adapter actually implements them.
 */
export function getAllowedInspectorLayoutModes(
  componentType: EditorComponentType,
): readonly LayoutMode[] {
  switch (componentType) {
    case "Section":
    case "Container":
    case "Stack":
    case "Grid":
      return ["block", "flex", "stack", "grid"];
    case "ProductScrollRail":
    case "FestivalSection":
    case "FeaturedCollection":
      return ["carousel"];
    case "ProductGrid":
    case "CategoryGrid":
      return ["grid"];
    default:
      return [];
  }
}

/**
 * Checks whether a style path is explicitly blocked by `capabilities.unsupportedStylePaths`.
 */
export function isStylePathBlockedByUnsupportedList(
  path: string,
  unsupportedStylePaths: readonly string[],
): boolean {
  for (const blocked of unsupportedStylePaths) {
    if (path === blocked || path.startsWith(`${blocked}.`) || blocked.startsWith(`${path}.`)) {
      if (blocked === path || path.startsWith(`${blocked}.`)) {
        return true;
      }
    }
  }
  return false;
}

const STYLE_PATH_CAPABILITY_REQUIREMENTS: Record<
  string,
  | { kind: "always" }
  | { kind: "layout"; flag: keyof SupportedLayoutProperties }
  | { kind: "visual"; flag: keyof SupportedVisualProperties }
  | { kind: "anyLayout"; flags: readonly (keyof SupportedLayoutProperties)[] }
  | { kind: "anyVisual"; flags: readonly (keyof SupportedVisualProperties)[] }
> = {
  visible: { kind: "always" },
  geometry: {
    kind: "anyLayout",
    flags: ["dimensions", "padding", "margin", "position", "aspectRatio", "overflow"],
  },
  "geometry.width": { kind: "layout", flag: "dimensions" },
  "geometry.height": { kind: "layout", flag: "dimensions" },
  "geometry.minWidth": { kind: "layout", flag: "dimensions" },
  "geometry.maxWidth": { kind: "layout", flag: "dimensions" },
  "geometry.minHeight": { kind: "layout", flag: "dimensions" },
  "geometry.maxHeight": { kind: "layout", flag: "dimensions" },
  "geometry.aspectRatio": {
    kind: "anyLayout",
    flags: ["aspectRatio", "dimensions"],
  },
  "geometry.padding": { kind: "layout", flag: "padding" },
  "geometry.margin": { kind: "layout", flag: "margin" },
  "geometry.overflowX": {
    kind: "anyLayout",
    flags: ["overflow", "dimensions", "padding"],
  },
  "geometry.overflowY": {
    kind: "anyLayout",
    flags: ["overflow", "dimensions", "padding"],
  },
  "geometry.position": {
    kind: "anyLayout",
    flags: ["position", "dimensions", "padding", "margin"],
  },
  "geometry.zIndex": {
    kind: "anyLayout",
    flags: ["position", "dimensions", "padding", "margin"],
  },
  layout: {
    kind: "anyLayout",
    flags: ["layoutMode", "padding"],
  },
  "layout.mode": {
    kind: "layout",
    flag: "layoutMode",
  },
  "layout.flex": {
    kind: "anyLayout",
    flags: ["layoutMode", "padding"],
  },
  "layout.flex.direction": { kind: "layout", flag: "layoutMode" },
  "layout.flex.wrap": { kind: "layout", flag: "layoutMode" },
  "layout.flex.justifyContent": { kind: "layout", flag: "layoutMode" },
  "layout.flex.alignItems": { kind: "layout", flag: "layoutMode" },
  "layout.flex.columnGapPx": {
    kind: "anyLayout",
    flags: ["layoutMode", "padding"],
  },
  "layout.flex.rowGapPx": {
    kind: "anyLayout",
    flags: ["layoutMode", "padding"],
  },
  "layout.grid": {
    kind: "anyLayout",
    flags: ["layoutMode", "padding"],
  },
  "layout.grid.columns": { kind: "layout", flag: "layoutMode" },
  "layout.grid.rows": { kind: "layout", flag: "layoutMode" },
  "layout.grid.columnGapPx": {
    kind: "anyLayout",
    flags: ["layoutMode", "padding"],
  },
  "layout.grid.rowGapPx": {
    kind: "anyLayout",
    flags: ["layoutMode", "padding"],
  },
  "layout.grid.autoFlow": { kind: "layout", flag: "layoutMode" },
  "layout.grid.alignItems": { kind: "layout", flag: "layoutMode" },
  "layout.grid.justifyItems": { kind: "layout", flag: "layoutMode" },
  flexItem: {
    kind: "anyLayout",
    flags: ["flexItem", "dimensions", "gridPlacement"],
  },
  "flexItem.grow": {
    kind: "anyLayout",
    flags: ["flexItem", "dimensions", "gridPlacement"],
  },
  "flexItem.shrink": {
    kind: "anyLayout",
    flags: ["flexItem", "dimensions", "gridPlacement"],
  },
  "flexItem.basisPx": {
    kind: "anyLayout",
    flags: ["flexItem", "dimensions", "gridPlacement"],
  },
  "flexItem.alignSelf": {
    kind: "anyLayout",
    flags: ["flexItem", "dimensions", "gridPlacement"],
  },
  gridItem: { kind: "layout", flag: "gridPlacement" },
  "gridItem.colSpan": { kind: "layout", flag: "gridPlacement" },
  "gridItem.rowSpan": { kind: "layout", flag: "gridPlacement" },
  "gridItem.colStart": { kind: "layout", flag: "gridPlacement" },
  "gridItem.rowStart": { kind: "layout", flag: "gridPlacement" },
  "gridItem.alignSelf": { kind: "layout", flag: "gridPlacement" },
  "gridItem.justifySelf": { kind: "layout", flag: "gridPlacement" },
  appearance: {
    kind: "anyVisual",
    flags: [
      "backgroundColor",
      "backgroundGradient",
      "border",
      "shadow",
      "opacity",
      "filters",
      "typography",
    ],
  },
  "appearance.backgroundColor": { kind: "visual", flag: "backgroundColor" },
  "appearance.backgroundGradient": { kind: "visual", flag: "backgroundGradient" },
  "appearance.border": { kind: "visual", flag: "border" },
  "appearance.shadow": { kind: "visual", flag: "shadow" },
  "appearance.opacity": { kind: "visual", flag: "opacity" },
  "appearance.filters": { kind: "visual", flag: "filters" },
  "appearance.typography": { kind: "visual", flag: "typography" },
  "appearance.typography.fontFamily": { kind: "visual", flag: "typography" },
  "appearance.typography.fontSize": { kind: "visual", flag: "typography" },
  "appearance.typography.fontWeight": { kind: "visual", flag: "typography" },
  "appearance.typography.lineHeight": { kind: "visual", flag: "typography" },
  "appearance.typography.letterSpacingEm": { kind: "visual", flag: "typography" },
  "appearance.typography.textAlign": { kind: "visual", flag: "typography" },
  "appearance.typography.color": { kind: "visual", flag: "typography" },
  "appearance.typography.textTransform": { kind: "visual", flag: "typography" },
  "appearance.typography.textDecoration": { kind: "visual", flag: "typography" },
  "appearance.typography.fontStyle": { kind: "visual", flag: "typography" },
  "appearance.typography.lineClamp": { kind: "visual", flag: "typography" },
  shape: {
    kind: "anyVisual",
    flags: ["cornerRadius", "shapeType", "clipPreset", "imageCrop"],
  },
  "shape.shapeType": {
    kind: "anyVisual",
    flags: ["shapeType", "cornerRadius", "clipPreset"],
  },
  "shape.cornerRadius": { kind: "visual", flag: "cornerRadius" },
  "shape.clipPreset": { kind: "visual", flag: "clipPreset" },
  "shape.clipOverflow": {
    kind: "anyVisual",
    flags: ["cornerRadius", "shapeType", "clipPreset"],
  },
  "shape.imageCrop": { kind: "visual", flag: "imageCrop" },
};

/**
 * Evaluates whether a given style property path is supported for a component type
 * according to `TRUSTED_COMPONENT_CAPABILITIES` and `unsupportedStylePaths`.
 */
export function evaluateInspectorStylePathSupport(
  componentType: EditorComponentType,
  path: InspectorStylePath | string,
  capabilitiesOverride?: ComponentCapabilityProfile | null,
): StylePathSupportEvaluation {
  const capabilities =
    capabilitiesOverride ?? TRUSTED_COMPONENT_CAPABILITIES[componentType] ?? null;

  if (!capabilities) {
    return {
      supported: false,
      reason: `Unknown component type "${componentType}".`,
    };
  }

  if (capabilities.isGlobalChrome) {
    return {
      supported: false,
      reason: `Global route chrome "${componentType}" cannot be styled in the page editor.`,
    };
  }

  if (isStylePathBlockedByUnsupportedList(path, capabilities.unsupportedStylePaths)) {
    return {
      supported: false,
      reason: `Style path "${path}" is explicitly restricted on "${componentType}" to preserve storefront fidelity.`,
    };
  }

  const req = STYLE_PATH_CAPABILITY_REQUIREMENTS[path];
  if (!req) {
    return {
      supported: false,
      reason: `Unrecognized style property path "${path}".`,
    };
  }

  if (req.kind === "always") {
    return { supported: true };
  }

  if (req.kind === "layout") {
    if (!capabilities.layoutSupport[req.flag]) {
      return {
        supported: false,
        reason: `Component "${componentType}" does not support layout capability "${req.flag}".`,
      };
    }
    return { supported: true };
  }

  if (req.kind === "visual") {
    if (!capabilities.visualSupport[req.flag]) {
      return {
        supported: false,
        reason: `Component "${componentType}" does not support visual capability "${req.flag}".`,
      };
    }
    return { supported: true };
  }

  if (req.kind === "anyLayout") {
    const anyMatch = req.flags.some((f) => capabilities.layoutSupport[f]);
    if (!anyMatch) {
      return {
        supported: false,
        reason: `Component "${componentType}" does not support required layout capabilities (${req.flags.join(", ")}).`,
      };
    }
    return { supported: true };
  }

  if (req.kind === "anyVisual") {
    const anyMatch = req.flags.some((f) => capabilities.visualSupport[f]);
    if (!anyMatch) {
      return {
        supported: false,
        reason: `Component "${componentType}" does not support required visual capabilities (${req.flags.join(", ")}).`,
      };
    }
    return { supported: true };
  }

  return { supported: false };
}

export function isInspectorStylePathSupported(
  componentType: EditorComponentType,
  path: InspectorStylePath | string,
  capabilitiesOverride?: ComponentCapabilityProfile | null,
): boolean {
  return evaluateInspectorStylePathSupport(componentType, path, capabilitiesOverride).supported;
}

export interface ComponentPropertySupportSummary {
  readonly componentType: EditorComponentType;
  readonly displayName: string;
  readonly supportedStylePaths: readonly InspectorStylePath[];
  readonly unsupportedStylePaths: readonly string[];
  readonly editableContentProps: readonly string[];
  readonly allowedLayoutModes: readonly LayoutMode[];
}

const ALL_INSPECTOR_STYLE_PATHS: readonly InspectorStylePath[] = [
  "visible",
  "geometry.width",
  "geometry.height",
  "geometry.minWidth",
  "geometry.maxWidth",
  "geometry.minHeight",
  "geometry.maxHeight",
  "geometry.aspectRatio",
  "geometry.padding",
  "geometry.margin",
  "geometry.overflowX",
  "geometry.overflowY",
  "layout.mode",
  "layout.flex",
  "layout.grid",
  "layout.flex.columnGapPx",
  "layout.flex.rowGapPx",
  "flexItem",
  "gridItem",
  "appearance.backgroundColor",
  "appearance.backgroundGradient",
  "appearance.border",
  "appearance.shadow",
  "appearance.opacity",
  "appearance.filters",
  "appearance.typography",
  "shape.shapeType",
  "shape.cornerRadius",
  "shape.clipPreset",
  "shape.imageCrop",
];

/**
 * Builds the verified component-property matrix across all registered component types.
 */
export function buildVerifiedComponentPropertyMatrix(): Record<
  EditorComponentType,
  ComponentPropertySupportSummary
> {
  const result = {} as Record<EditorComponentType, ComponentPropertySupportSummary>;

  for (const [typeKey, cap] of Object.entries(TRUSTED_COMPONENT_CAPABILITIES)) {
    const compType = typeKey as EditorComponentType;
    const supportedPaths = ALL_INSPECTOR_STYLE_PATHS.filter((p) =>
      isInspectorStylePathSupported(compType, p, cap),
    );
    result[compType] = {
      componentType: compType,
      displayName: cap.displayName,
      supportedStylePaths: supportedPaths,
      unsupportedStylePaths: cap.unsupportedStylePaths,
      editableContentProps: cap.editableProps,
      allowedLayoutModes: getAllowedInspectorLayoutModes(compType),
    };
  }

  return result;
}
