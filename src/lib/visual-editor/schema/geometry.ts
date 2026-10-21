import { z } from "zod";

export const NUMERIC_DIMENSION_UNITS = ["px", "%", "rem", "vw", "vh"] as const;
export const KEYWORD_DIMENSION_UNITS = [
  "auto",
  "min-content",
  "max-content",
  "fit-content",
] as const;

export const DIMENSION_UNITS = [...NUMERIC_DIMENSION_UNITS, ...KEYWORD_DIMENSION_UNITS] as const;

export type NumericDimensionUnit = (typeof NUMERIC_DIMENSION_UNITS)[number];
export type KeywordDimensionUnit = (typeof KEYWORD_DIMENSION_UNITS)[number];
export type DimensionUnit = NumericDimensionUnit | KeywordDimensionUnit;

export type DimensionValue =
  { unit: NumericDimensionUnit; value: number } | { unit: KeywordDimensionUnit; value?: undefined };

export const NumericDimensionSchema = z
  .object({
    unit: z.enum(NUMERIC_DIMENSION_UNITS),
    value: z.number().finite().min(-10000).max(20000),
  })
  .strict();

export const KeywordDimensionSchema = z
  .object({
    unit: z.enum(KEYWORD_DIMENSION_UNITS),
  })
  .strict();

export const DimensionValueSchema: z.ZodType<DimensionValue> = z.union([
  NumericDimensionSchema,
  KeywordDimensionSchema,
]);

export const NonNegativeDimensionSchema: z.ZodType<DimensionValue> = z.union([
  z
    .object({
      unit: z.enum(NUMERIC_DIMENSION_UNITS),
      value: z.number().finite().min(0).max(20000),
    })
    .strict(),
  KeywordDimensionSchema,
]);

export interface SpacingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit?: "px" | "rem";
}

export const SpacingBoxSchema: z.ZodType<SpacingBox> = z
  .object({
    top: z.number().finite().min(-2000).max(4000),
    right: z.number().finite().min(-2000).max(4000),
    bottom: z.number().finite().min(-2000).max(4000),
    left: z.number().finite().min(-2000).max(4000),
    unit: z.enum(["px", "rem"]).optional(),
  })
  .strict();

export const POSITION_MODES = ["static", "relative", "absolute", "sticky"] as const;
export type PositionMode = (typeof POSITION_MODES)[number];

export const OVERFLOW_MODES = ["visible", "hidden", "clip", "scroll", "auto"] as const;
export type OverflowMode = (typeof OVERFLOW_MODES)[number];

export const ALIGNMENT_MODES = ["start", "center", "end", "stretch", "baseline"] as const;
export type AlignmentMode = (typeof ALIGNMENT_MODES)[number];

export interface PositionOffsets {
  top?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
}

export const PositionOffsetsSchema: z.ZodType<PositionOffsets> = z
  .object({
    top: DimensionValueSchema.optional(),
    right: DimensionValueSchema.optional(),
    bottom: DimensionValueSchema.optional(),
    left: DimensionValueSchema.optional(),
  })
  .strict();

export interface Transform2D {
  translateX?: DimensionValue;
  translateY?: DimensionValue;
  rotateDeg?: number;
  scaleX?: number;
  scaleY?: number;
}

export const Transform2DSchema: z.ZodType<Transform2D> = z
  .object({
    translateX: DimensionValueSchema.optional(),
    translateY: DimensionValueSchema.optional(),
    rotateDeg: z.number().finite().min(-3600).max(3600).optional(),
    scaleX: z.number().finite().min(0.05).max(10).optional(),
    scaleY: z.number().finite().min(0.05).max(10).optional(),
  })
  .strict();

export const ASPECT_RATIO_PRESETS = [
  "auto",
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
] as const;

export type AspectRatioPreset = (typeof ASPECT_RATIO_PRESETS)[number];

export interface AspectRatioValue {
  width: number;
  height: number;
}

export const AspectRatioValueSchema: z.ZodType<AspectRatioValue> = z
  .object({
    width: z.number().finite().positive().max(100),
    height: z.number().finite().positive().max(100),
  })
  .strict();

export interface GeometryConfig {
  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: DimensionValue;
  maxWidth?: DimensionValue;
  minHeight?: DimensionValue;
  maxHeight?: DimensionValue;
  aspectRatio?: AspectRatioValue | AspectRatioPreset;
  padding?: SpacingBox;
  margin?: SpacingBox;
  position?: PositionMode;
  offsets?: PositionOffsets;
  zIndex?: number;
  alignSelf?: AlignmentMode;
  justifySelf?: AlignmentMode;
  overflowX?: OverflowMode;
  overflowY?: OverflowMode;
  transform?: Transform2D;
}

export const GeometryConfigSchema: z.ZodType<GeometryConfig> = z
  .object({
    width: NonNegativeDimensionSchema.optional(),
    height: NonNegativeDimensionSchema.optional(),
    minWidth: NonNegativeDimensionSchema.optional(),
    maxWidth: NonNegativeDimensionSchema.optional(),
    minHeight: NonNegativeDimensionSchema.optional(),
    maxHeight: NonNegativeDimensionSchema.optional(),
    aspectRatio: z.union([AspectRatioValueSchema, z.enum(ASPECT_RATIO_PRESETS)]).optional(),
    padding: SpacingBoxSchema.optional(),
    margin: SpacingBoxSchema.optional(),
    position: z.enum(POSITION_MODES).optional(),
    offsets: PositionOffsetsSchema.optional(),
    zIndex: z.number().int().min(-100).max(1000).optional(),
    alignSelf: z.enum(ALIGNMENT_MODES).optional(),
    justifySelf: z.enum(ALIGNMENT_MODES).optional(),
    overflowX: z.enum(OVERFLOW_MODES).optional(),
    overflowY: z.enum(OVERFLOW_MODES).optional(),
    transform: Transform2DSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (
      val.minWidth &&
      val.maxWidth &&
      "value" in val.minWidth &&
      "value" in val.maxWidth &&
      val.minWidth.unit === val.maxWidth.unit &&
      val.minWidth.value !== undefined &&
      val.maxWidth.value !== undefined &&
      val.minWidth.value > val.maxWidth.value
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minWidth"],
        message: "minWidth cannot exceed maxWidth when using the same unit",
      });
    }
    if (
      val.minHeight &&
      val.maxHeight &&
      "value" in val.minHeight &&
      "value" in val.maxHeight &&
      val.minHeight.unit === val.maxHeight.unit &&
      val.minHeight.value !== undefined &&
      val.maxHeight.value !== undefined &&
      val.minHeight.value > val.maxHeight.value
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minHeight"],
        message: "minHeight cannot exceed maxHeight when using the same unit",
      });
    }
  });

export function formatDimensionValue(dim: DimensionValue): string {
  if ("value" in dim && typeof dim.value === "number") {
    return `${dim.value}${dim.unit}`;
  }
  return dim.unit;
}
