import type { ComponentCapabilityProfile } from "../registry/component-capabilities";
import { DIMENSION_UNITS, type DimensionUnit } from "../schema/geometry";
import type { EditorComponentType, EditorNode } from "../schema/nodes";
import { CORNER_RADIUS_UNITS } from "../schema/shapes";
import { isInspectorStylePathSupported, type InspectorStylePath } from "./property-capabilities";

export type InspectorPropertyGroup =
  | "general"
  | "geometry"
  | "spacing"
  | "layout"
  | "appearance"
  | "shape"
  | "typography"
  | "media"
  | "responsive"
  | "advanced";

export type InspectorControlType =
  | "dimension"
  | "aspect_ratio"
  | "spacing_box"
  | "gap"
  | "flex_container"
  | "grid_container"
  | "flex_item"
  | "grid_item"
  | "color"
  | "gradient"
  | "border"
  | "shadow"
  | "opacity"
  | "filters"
  | "shape_preset"
  | "corner_radius"
  | "typography"
  | "media_crop"
  | "select"
  | "toggle";

export interface InspectorPropertyDefinition {
  readonly id: InspectorStylePath;
  readonly label: string;
  readonly group: InspectorPropertyGroup;
  readonly controlType: InspectorControlType;
  readonly supportedUnits?: readonly string[];
  readonly responsiveSupported: boolean;
  readonly tooltip: string;
  readonly defaultBehaviorDescription: string;
}

export const INSPECTOR_PROPERTY_DEFINITIONS: readonly InspectorPropertyDefinition[] = [
  // GEOMETRY
  {
    id: "geometry.width",
    label: "Width",
    group: "geometry",
    controlType: "dimension",
    supportedUnits: DIMENSION_UNITS,
    responsiveSupported: true,
    tooltip: "Explicit width constraint. Leave unset to preserve fluid storefront sizing.",
    defaultBehaviorDescription: "Fluid / Component Native",
  },
  {
    id: "geometry.height",
    label: "Height",
    group: "geometry",
    controlType: "dimension",
    supportedUnits: DIMENSION_UNITS,
    responsiveSupported: true,
    tooltip: "Explicit height constraint. Leave unset for content-driven height.",
    defaultBehaviorDescription: "Auto (Content-Driven)",
  },
  {
    id: "geometry.minWidth",
    label: "Min Width",
    group: "geometry",
    controlType: "dimension",
    supportedUnits: DIMENSION_UNITS,
    responsiveSupported: true,
    tooltip: "Minimum allowed width before wrapping or scrolling.",
    defaultBehaviorDescription: "None",
  },
  {
    id: "geometry.maxWidth",
    label: "Max Width",
    group: "geometry",
    controlType: "dimension",
    supportedUnits: DIMENSION_UNITS,
    responsiveSupported: true,
    tooltip: "Maximum container width constraint (e.g., 1280px).",
    defaultBehaviorDescription: "Component Default",
  },
  {
    id: "geometry.minHeight",
    label: "Min Height",
    group: "geometry",
    controlType: "dimension",
    supportedUnits: DIMENSION_UNITS,
    responsiveSupported: true,
    tooltip: "Minimum vertical height of the element.",
    defaultBehaviorDescription: "None",
  },
  {
    id: "geometry.maxHeight",
    label: "Max Height",
    group: "geometry",
    controlType: "dimension",
    supportedUnits: DIMENSION_UNITS,
    responsiveSupported: true,
    tooltip: "Maximum vertical height before clipping or scrolling.",
    defaultBehaviorDescription: "None",
  },
  {
    id: "geometry.aspectRatio",
    label: "Aspect Ratio",
    group: "geometry",
    controlType: "aspect_ratio",
    responsiveSupported: true,
    tooltip: "Proportional width-to-height ratio (e.g., 1:1, 16:9, 4:3).",
    defaultBehaviorDescription: "Auto",
  },

  // SPACING
  {
    id: "geometry.padding",
    label: "Padding",
    group: "spacing",
    controlType: "spacing_box",
    supportedUnits: ["px", "rem"] satisfies readonly DimensionUnit[],
    responsiveSupported: true,
    tooltip: "Inner breathing room between the component border and its content.",
    defaultBehaviorDescription: "Component Native Padding",
  },
  {
    id: "geometry.margin",
    label: "Margin",
    group: "spacing",
    controlType: "spacing_box",
    supportedUnits: ["px", "rem"] satisfies readonly DimensionUnit[],
    responsiveSupported: true,
    tooltip: "Outer spacing separating this element from neighboring layers.",
    defaultBehaviorDescription: "Component Native Margin",
  },
  {
    id: "layout.flex.columnGapPx",
    label: "Column / Horizontal Gap",
    group: "spacing",
    controlType: "gap",
    supportedUnits: ["px"],
    responsiveSupported: true,
    tooltip: "Horizontal gap between child items in a flex, grid, or carousel container.",
    defaultBehaviorDescription: "Component Default Gap",
  },
  {
    id: "layout.flex.rowGapPx",
    label: "Row / Vertical Gap",
    group: "spacing",
    controlType: "gap",
    supportedUnits: ["px"],
    responsiveSupported: true,
    tooltip: "Vertical gap between rows in a flex, stack, or grid container.",
    defaultBehaviorDescription: "Component Default Gap",
  },

  // LAYOUT (FLEX / GRID)
  {
    id: "layout.mode",
    label: "Container Layout Mode",
    group: "layout",
    controlType: "select",
    responsiveSupported: true,
    tooltip: "Display layout model for child elements (Block, Flex, Stack, or CSS Grid).",
    defaultBehaviorDescription: "Component Default",
  },
  {
    id: "layout.flex",
    label: "Flexbox Alignment & Wrap",
    group: "layout",
    controlType: "flex_container",
    responsiveSupported: true,
    tooltip:
      "Configure flex direction, wrapping, main-axis justification, and cross-axis alignment.",
    defaultBehaviorDescription: "Row / Start",
  },
  {
    id: "layout.grid",
    label: "CSS Grid Configuration",
    group: "layout",
    controlType: "grid_container",
    responsiveSupported: true,
    tooltip: "Configure CSS Grid column count, auto-flow, and cell alignment.",
    defaultBehaviorDescription: "Component Default Columns",
  },
  {
    id: "flexItem",
    label: "Flex Child Sizing",
    group: "layout",
    controlType: "flex_item",
    responsiveSupported: true,
    tooltip:
      "Configure flex-grow, flex-shrink, flex-basis, and self-alignment inside a Flex parent.",
    defaultBehaviorDescription: "Auto",
  },
  {
    id: "gridItem",
    label: "Grid Cell Span & Placement",
    group: "layout",
    controlType: "grid_item",
    responsiveSupported: true,
    tooltip: "Configure column span, row span, and explicit grid placement.",
    defaultBehaviorDescription: "1 × 1 Span",
  },

  // APPEARANCE
  {
    id: "appearance.backgroundColor",
    label: "Background Color",
    group: "appearance",
    controlType: "color",
    responsiveSupported: true,
    tooltip: "Solid surface background color or global theme token.",
    defaultBehaviorDescription: "Component Native Surface",
  },
  {
    id: "appearance.backgroundGradient",
    label: "Background Gradient",
    group: "appearance",
    controlType: "gradient",
    responsiveSupported: true,
    tooltip: "Linear, radial, or conic multi-stop surface gradient.",
    defaultBehaviorDescription: "None",
  },
  {
    id: "appearance.border",
    label: "Border",
    group: "appearance",
    controlType: "border",
    supportedUnits: ["px"],
    responsiveSupported: true,
    tooltip: "Border stroke width, style (solid/dashed/dotted), and color.",
    defaultBehaviorDescription: "Component Native Border",
  },
  {
    id: "appearance.shadow",
    label: "Shadow & Glow",
    group: "appearance",
    controlType: "shadow",
    responsiveSupported: true,
    tooltip: "Elevation drop shadow, cosmic glow preset, or custom shadow geometry.",
    defaultBehaviorDescription: "Component Default Shadow",
  },
  {
    id: "appearance.opacity",
    label: "Layer Opacity",
    group: "appearance",
    controlType: "opacity",
    supportedUnits: ["%"],
    responsiveSupported: true,
    tooltip: "Overall transparency of the component (0% to 100%).",
    defaultBehaviorDescription: "100% (Opaque)",
  },
  {
    id: "appearance.filters",
    label: "Visual Filters & Backdrop Blur",
    group: "appearance",
    controlType: "filters",
    responsiveSupported: true,
    tooltip: "Safe GPU-bounded blur, backdrop blur, brightness, contrast, and saturation filters.",
    defaultBehaviorDescription: "None",
  },

  // SHAPE & CORNER RADIUS
  {
    id: "shape.shapeType",
    label: "Shape Preset",
    group: "shape",
    controlType: "shape_preset",
    responsiveSupported: true,
    tooltip:
      "Geometric silhouette preset (Square, Rounded, Pill, Circle, Hexagon, Octagon, Diamond, Arch).",
    defaultBehaviorDescription: "Rounded Rectangle (Default)",
  },
  {
    id: "shape.cornerRadius",
    label: "Corner Radius",
    group: "shape",
    controlType: "corner_radius",
    supportedUnits: CORNER_RADIUS_UNITS,
    responsiveSupported: true,
    tooltip:
      "Uniform or independent per-corner rounding (Top-Left, Top-Right, Bottom-Right, Bottom-Left).",
    defaultBehaviorDescription: "Component Default Radius",
  },

  // TYPOGRAPHY
  {
    id: "appearance.typography",
    label: "Typography",
    group: "typography",
    controlType: "typography",
    responsiveSupported: true,
    tooltip:
      "Font family, size, weight, line height, letter spacing, alignment, transform, and text color.",
    defaultBehaviorDescription: "Theme Typography",
  },

  // MEDIA PRESENTATION
  {
    id: "shape.imageCrop",
    label: "Media Fit & Focal Point",
    group: "media",
    controlType: "media_crop",
    responsiveSupported: true,
    tooltip: "Non-destructive image object-fit, aspect ratio, and focal point positioning.",
    defaultBehaviorDescription: "Cover (Centered)",
  },
];

export function getSupportedInspectorPropertyDefinitions(
  componentType: EditorComponentType,
  capabilities?: ComponentCapabilityProfile | null,
): readonly InspectorPropertyDefinition[] {
  return INSPECTOR_PROPERTY_DEFINITIONS.filter((def) =>
    isInspectorStylePathSupported(componentType, def.id, capabilities),
  );
}

export function getSupportedInspectorGroupsForNode(
  nodeOrType: Pick<EditorNode, "type"> | EditorComponentType,
  capabilities?: ComponentCapabilityProfile | null,
): ReadonlySet<InspectorPropertyGroup> {
  const compType = typeof nodeOrType === "string" ? nodeOrType : nodeOrType.type;
  const groups = new Set<InspectorPropertyGroup>(["general", "responsive", "advanced"]);
  const defs = getSupportedInspectorPropertyDefinitions(compType, capabilities);
  for (const def of defs) {
    groups.add(def.group);
  }
  return groups;
}
