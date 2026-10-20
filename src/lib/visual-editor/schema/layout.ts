import { z } from "zod";
import { ALIGNMENT_MODES, type AlignmentMode } from "./geometry";

export const LAYOUT_MODES = [
  "block",
  "flex",
  "grid",
  "bento",
  "masonry",
  "carousel",
  "editorial",
  "freeform",
] as const;

export type LayoutMode = (typeof LAYOUT_MODES)[number];

export const JUSTIFY_CONTENT_MODES = [
  "start",
  "center",
  "end",
  "between",
  "around",
  "evenly",
  "stretch",
] as const;

export type JustifyContentMode = (typeof JUSTIFY_CONTENT_MODES)[number];

export interface GridTrackDefinition {
  unit: "fr" | "px" | "%" | "rem" | "auto" | "minmax";
  value?: number;
  minPx?: number;
  maxFr?: number;
}

export const GridTrackDefinitionSchema: z.ZodType<GridTrackDefinition> = z
  .object({
    unit: z.enum(["fr", "px", "%", "rem", "auto", "minmax"]),
    value: z.number().finite().min(0).max(10000).optional(),
    minPx: z.number().finite().min(0).max(5000).optional(),
    maxFr: z.number().finite().min(0.1).max(24).optional(),
  })
  .strict();

export interface CssGridConfig {
  columns: number;
  rows?: number;
  columnGapPx: number;
  rowGapPx: number;
  autoFlow?: "row" | "column" | "row dense" | "column dense";
  autoFit?: boolean;
  minColumnWidthPx?: number;
  alignItems?: AlignmentMode;
  justifyItems?: AlignmentMode;
  columnTracks?: GridTrackDefinition[];
  rowTracks?: GridTrackDefinition[];
}

export const CssGridConfigSchema: z.ZodType<CssGridConfig> = z
  .object({
    columns: z.number().int().min(1).max(24),
    rows: z.number().int().min(1).max(100).optional(),
    columnGapPx: z.number().finite().min(0).max(256),
    rowGapPx: z.number().finite().min(0).max(256),
    autoFlow: z.enum(["row", "column", "row dense", "column dense"]).optional(),
    autoFit: z.boolean().optional(),
    minColumnWidthPx: z.number().finite().min(40).max(2000).optional(),
    alignItems: z.enum(ALIGNMENT_MODES).optional(),
    justifyItems: z.enum(ALIGNMENT_MODES).optional(),
    columnTracks: z.array(GridTrackDefinitionSchema).max(24).optional(),
    rowTracks: z.array(GridTrackDefinitionSchema).max(100).optional(),
  })
  .strict();

export interface GridItemPlacement {
  colSpan?: number;
  rowSpan?: number;
  colStart?: number;
  rowStart?: number;
  alignSelf?: AlignmentMode;
  justifySelf?: AlignmentMode;
}

export const GridItemPlacementSchema: z.ZodType<GridItemPlacement> = z
  .object({
    colSpan: z.number().int().min(1).max(24).optional(),
    rowSpan: z.number().int().min(1).max(24).optional(),
    colStart: z.number().int().min(1).max(24).optional(),
    rowStart: z.number().int().min(1).max(100).optional(),
    alignSelf: z.enum(ALIGNMENT_MODES).optional(),
    justifySelf: z.enum(ALIGNMENT_MODES).optional(),
  })
  .strict();

export interface FlexboxConfig {
  direction: "row" | "row-reverse" | "column" | "column-reverse";
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
  justifyContent?: JustifyContentMode;
  alignItems?: AlignmentMode;
  columnGapPx?: number;
  rowGapPx?: number;
}

export const FlexboxConfigSchema: z.ZodType<FlexboxConfig> = z
  .object({
    direction: z.enum(["row", "row-reverse", "column", "column-reverse"]),
    wrap: z.enum(["nowrap", "wrap", "wrap-reverse"]).optional(),
    justifyContent: z.enum(JUSTIFY_CONTENT_MODES).optional(),
    alignItems: z.enum(ALIGNMENT_MODES).optional(),
    columnGapPx: z.number().finite().min(0).max(256).optional(),
    rowGapPx: z.number().finite().min(0).max(256).optional(),
  })
  .strict();

export interface FlexItemConfig {
  grow?: number;
  shrink?: number;
  basisPx?: number | "auto";
  order?: number;
  alignSelf?: AlignmentMode;
}

export const FlexItemConfigSchema: z.ZodType<FlexItemConfig> = z
  .object({
    grow: z.number().finite().min(0).max(24).optional(),
    shrink: z.number().finite().min(0).max(24).optional(),
    basisPx: z.union([z.number().finite().min(0).max(10000), z.literal("auto")]).optional(),
    order: z.number().int().min(-100).max(100).optional(),
    alignSelf: z.enum(ALIGNMENT_MODES).optional(),
  })
  .strict();

export interface CarouselLayoutConfig {
  visibleCards: number;
  gapPx: number;
  snapAlign?: "start" | "center" | "none";
  showArrows?: boolean;
  showEdgeFade?: boolean;
  loop?: boolean;
  autoPlayIntervalMs?: number;
}

export const CarouselLayoutConfigSchema: z.ZodType<CarouselLayoutConfig> = z
  .object({
    visibleCards: z.number().finite().min(1).max(12),
    gapPx: z.number().finite().min(0).max(128),
    snapAlign: z.enum(["start", "center", "none"]).optional(),
    showArrows: z.boolean().optional(),
    showEdgeFade: z.boolean().optional(),
    loop: z.boolean().optional(),
    autoPlayIntervalMs: z.number().int().min(1000).max(30000).optional(),
  })
  .strict();

export interface BentoCellSpan {
  itemIndex: number;
  colSpan: number;
  rowSpan: number;
}

export const BentoCellSpanSchema: z.ZodType<BentoCellSpan> = z
  .object({
    itemIndex: z.number().int().min(0).max(100),
    colSpan: z.number().int().min(1).max(12),
    rowSpan: z.number().int().min(1).max(12),
  })
  .strict();

export interface BentoLayoutConfig {
  columns: number;
  rowHeightPx: number;
  gapPx: number;
  cellSpans?: BentoCellSpan[];
}

export const BentoLayoutConfigSchema: z.ZodType<BentoLayoutConfig> = z
  .object({
    columns: z.number().int().min(1).max(12),
    rowHeightPx: z.number().finite().min(60).max(1200),
    gapPx: z.number().finite().min(0).max(128),
    cellSpans: z.array(BentoCellSpanSchema).max(100).optional(),
  })
  .strict();

export interface MasonryLayoutConfig {
  columns: number;
  gapPx: number;
}

export const MasonryLayoutConfigSchema: z.ZodType<MasonryLayoutConfig> = z
  .object({
    columns: z.number().int().min(1).max(12),
    gapPx: z.number().finite().min(0).max(128),
  })
  .strict();

export interface LayoutConfig {
  mode: LayoutMode;
  grid?: CssGridConfig;
  flex?: FlexboxConfig;
  carousel?: CarouselLayoutConfig;
  bento?: BentoLayoutConfig;
  masonry?: MasonryLayoutConfig;
}

export const LayoutConfigSchema: z.ZodType<LayoutConfig> = z
  .object({
    mode: z.enum(LAYOUT_MODES),
    grid: CssGridConfigSchema.optional(),
    flex: FlexboxConfigSchema.optional(),
    carousel: CarouselLayoutConfigSchema.optional(),
    bento: BentoLayoutConfigSchema.optional(),
    masonry: MasonryLayoutConfigSchema.optional(),
  })
  .strict();
