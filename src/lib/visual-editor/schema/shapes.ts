import { z } from "zod/v3";
import {
  ASPECT_RATIO_PRESETS,
  AspectRatioValueSchema,
  type AspectRatioPreset,
  type AspectRatioValue,
} from "./geometry";

export const SHAPE_TYPES = [
  "square",
  "rectangle",
  "rounded-rectangle",
  "pill",
  "circle",
  "ellipse",
  "hexagon",
  "octagon",
  "diamond",
  "arch",
] as const;

export type ShapeType = (typeof SHAPE_TYPES)[number];

export const CLIP_PRESETS = [
  "none",
  "circle",
  "ellipse",
  "inset-rounded",
  "hexagon",
  "octagon",
  "diamond",
  "arch",
] as const;

export const CLIP_SHAPE_PRESETS = CLIP_PRESETS;

export type ClipPreset = (typeof CLIP_PRESETS)[number];
export type ClipShapePreset = ClipPreset;

export const CORNER_RADIUS_MODES = ["uniform", "independent"] as const;
export type CornerRadiusMode = (typeof CORNER_RADIUS_MODES)[number];

export const CORNER_RADIUS_UNITS = ["px", "%", "rem"] as const;
export type CornerRadiusUnit = (typeof CORNER_RADIUS_UNITS)[number];

export interface CornerRadiusConfig {
  mode: CornerRadiusMode;
  unit: CornerRadiusUnit;
  uniform?: number;
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

export const CornerRadiusConfigSchema: z.ZodType<CornerRadiusConfig> = z
  .object({
    mode: z.enum(CORNER_RADIUS_MODES),
    unit: z.enum(CORNER_RADIUS_UNITS),
    uniform: z.number().finite().min(0).max(9999).optional(),
    topLeft: z.number().finite().min(0).max(9999).optional(),
    topRight: z.number().finite().min(0).max(9999).optional(),
    bottomRight: z.number().finite().min(0).max(9999).optional(),
    bottomLeft: z.number().finite().min(0).max(9999).optional(),
  })
  .strict();

export const OBJECT_FIT_MODES = ["cover", "contain", "fill", "scale-down", "none"] as const;
export type ObjectFitMode = (typeof OBJECT_FIT_MODES)[number];

export interface FocalPoint {
  xPercent: number;
  yPercent: number;
}

export const FocalPointSchema: z.ZodType<FocalPoint> = z
  .object({
    xPercent: z.number().finite().min(0).max(100),
    yPercent: z.number().finite().min(0).max(100),
  })
  .strict();

export interface ImageCropConfig {
  aspectRatio?: AspectRatioValue | AspectRatioPreset;
  objectFit?: ObjectFitMode;
  focalPoint?: FocalPoint;
  zoom?: number;
}

export const ImageCropConfigSchema: z.ZodType<ImageCropConfig> = z
  .object({
    aspectRatio: z.union([AspectRatioValueSchema, z.enum(ASPECT_RATIO_PRESETS)]).optional(),
    objectFit: z.enum(OBJECT_FIT_MODES).optional(),
    focalPoint: FocalPointSchema.optional(),
    zoom: z.number().finite().min(0.5).max(4).optional(),
  })
  .strict();

export interface ShapeConfig {
  shapeType?: ShapeType;
  cornerRadius?: CornerRadiusConfig;
  clipPreset?: ClipPreset;
  imageCrop?: ImageCropConfig;
  clipOverflow?: boolean;
}

export const ShapeConfigSchema: z.ZodType<ShapeConfig> = z
  .object({
    shapeType: z.enum(SHAPE_TYPES).optional(),
    cornerRadius: CornerRadiusConfigSchema.optional(),
    clipPreset: z.enum(CLIP_PRESETS).optional(),
    imageCrop: ImageCropConfigSchema.optional(),
    clipOverflow: z.boolean().optional(),
  })
  .strict();
