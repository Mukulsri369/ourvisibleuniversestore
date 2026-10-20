import { z } from "zod";
import { GeometryConfigSchema, type GeometryConfig } from "./geometry";
import { ShapeConfigSchema, type ShapeConfig } from "./shapes";
import {
  FlexItemConfigSchema,
  GridItemPlacementSchema,
  LayoutConfigSchema,
  type FlexItemConfig,
  type GridItemPlacement,
  type LayoutConfig,
} from "./layout";
import { AppearanceConfigSchema, type AppearanceConfig } from "./appearance";
import { AnimationConfigSchema, type AnimationConfig } from "./animation";

/**
 * Breakpoints aligned with the storefront's actual Tailwind v4 & src/styles.css conventions:
 * - `desktop`: Base authoring canvas (>= 1024px, reference 1440×900)
 * - `desktop_xl`: Large desktop override (>= 1536px, reference 1920×1080)
 * - `tablet`: Tablet override (640px–1023px, reference 768×1024)
 * - `mobile`: Common mobile override (< 640px, reference 390×844)
 * - `mobile_sm`: Small mobile override (< 380px, reference 360×800)
 */
export const EDITOR_BREAKPOINTS = [
  "desktop",
  "desktop_xl",
  "tablet",
  "mobile",
  "mobile_sm",
] as const;

export type EditorBreakpoint = (typeof EDITOR_BREAKPOINTS)[number];

export const OVERRIDE_BREAKPOINTS = ["desktop_xl", "tablet", "mobile", "mobile_sm"] as const;
export type OverrideBreakpoint = (typeof OVERRIDE_BREAKPOINTS)[number];

export interface BreakpointDescriptor {
  id: EditorBreakpoint;
  label: string;
  referenceWidthPx: number;
  referenceHeightPx: number;
  minWidthPx?: number;
  maxWidthPx?: number;
}

export const BREAKPOINT_DESCRIPTORS: Record<EditorBreakpoint, BreakpointDescriptor> = {
  desktop: {
    id: "desktop",
    label: "Desktop (Base)",
    referenceWidthPx: 1440,
    referenceHeightPx: 900,
    minWidthPx: 1024,
    maxWidthPx: 1535,
  },
  desktop_xl: {
    id: "desktop_xl",
    label: "Large Desktop",
    referenceWidthPx: 1920,
    referenceHeightPx: 1080,
    minWidthPx: 1536,
  },
  tablet: {
    id: "tablet",
    label: "Tablet",
    referenceWidthPx: 768,
    referenceHeightPx: 1024,
    minWidthPx: 640,
    maxWidthPx: 1023,
  },
  mobile: {
    id: "mobile",
    label: "Mobile",
    referenceWidthPx: 390,
    referenceHeightPx: 844,
    minWidthPx: 380,
    maxWidthPx: 639,
  },
  mobile_sm: {
    id: "mobile_sm",
    label: "Small Mobile",
    referenceWidthPx: 360,
    referenceHeightPx: 800,
    maxWidthPx: 379,
  },
};

export interface NodeStyleBundle {
  visible?: boolean;
  geometry?: GeometryConfig;
  shape?: ShapeConfig;
  layout?: LayoutConfig;
  gridItem?: GridItemPlacement;
  flexItem?: FlexItemConfig;
  appearance?: AppearanceConfig;
  animation?: AnimationConfig;
}

export const NodeStyleBundleSchema: z.ZodType<NodeStyleBundle> = z
  .object({
    visible: z.boolean().optional(),
    geometry: GeometryConfigSchema.optional(),
    shape: ShapeConfigSchema.optional(),
    layout: LayoutConfigSchema.optional(),
    gridItem: GridItemPlacementSchema.optional(),
    flexItem: FlexItemConfigSchema.optional(),
    appearance: AppearanceConfigSchema.optional(),
    animation: AnimationConfigSchema.optional(),
  })
  .strict();

export type ResponsiveOverrides = Partial<Record<OverrideBreakpoint, NodeStyleBundle>>;

export const ResponsiveOverridesSchema: z.ZodType<ResponsiveOverrides> = z
  .object({
    desktop_xl: NodeStyleBundleSchema.optional(),
    tablet: NodeStyleBundleSchema.optional(),
    mobile: NodeStyleBundleSchema.optional(),
    mobile_sm: NodeStyleBundleSchema.optional(),
  })
  .strict();
