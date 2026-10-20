import { z } from "zod";
import { DimensionValueSchema, type DimensionValue } from "./geometry";

const SAFE_COLOR_REGEX =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?(\s*,\s*(0|1|0?\.\d+))?\s*\)|hsla?\(\s*\d+(\.\d+)?(deg)?\s*,\s*\d+(\.\d+)?%\s*,\s*\d+(\.\d+)?%(\s*,\s*(0|1|0?\.\d+))?\s*\)|oklch\(\s*[0-9.]+%?\s+[0-9.]+\s+[0-9.]+(\s*\/\s*[0-9.]+%?)?\s*\)|transparent|currentColor|token:[a-zA-Z0-9_-]{1,64})$/;

export const SafeColorValueSchema = z
  .string()
  .max(120)
  .regex(SAFE_COLOR_REGEX, "Invalid or unsafe CSS color value");

const SAFE_FONT_FAMILY_REGEX = /^[a-zA-Z0-9\s,'"-]{1,120}$/;

export const SafeFontFamilySchema = z
  .string()
  .max(120)
  .regex(SAFE_FONT_FAMILY_REGEX, "Unsafe font-family value")
  .refine(
    (val) => !/[;{}<>()\\]/.test(val),
    "Font family cannot contain CSS injection characters",
  );

export interface TypographyConfig {
  fontFamily?: string;
  fontSize?: DimensionValue;
  fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  lineHeight?: number;
  letterSpacingEm?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  color?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "line-through";
  fontStyle?: "normal" | "italic";
  lineClamp?: number;
}

export const TypographyConfigSchema: z.ZodType<TypographyConfig> = z
  .object({
    fontFamily: SafeFontFamilySchema.optional(),
    fontSize: DimensionValueSchema.optional(),
    fontWeight: z
      .union([
        z.literal(100),
        z.literal(200),
        z.literal(300),
        z.literal(400),
        z.literal(500),
        z.literal(600),
        z.literal(700),
        z.literal(800),
        z.literal(900),
      ])
      .optional(),
    lineHeight: z.number().finite().min(0.5).max(5).optional(),
    letterSpacingEm: z.number().finite().min(-0.5).max(2).optional(),
    textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
    color: SafeColorValueSchema.optional(),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
    textDecoration: z.enum(["none", "underline", "line-through"]).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    lineClamp: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export interface GradientStop {
  color: string;
  positionPercent: number;
}

export const GradientStopSchema: z.ZodType<GradientStop> = z
  .object({
    color: SafeColorValueSchema,
    positionPercent: z.number().finite().min(0).max(100),
  })
  .strict();

export interface GradientConfig {
  type: "linear" | "radial" | "conic";
  angleDeg?: number;
  stops: GradientStop[];
}

export const GradientConfigSchema: z.ZodType<GradientConfig> = z
  .object({
    type: z.enum(["linear", "radial", "conic"]),
    angleDeg: z.number().finite().min(0).max(360).optional(),
    stops: z.array(GradientStopSchema).min(2).max(12),
  })
  .strict();

export interface BorderConfig {
  widthPx: number;
  style: "none" | "solid" | "dashed" | "dotted" | "double";
  color: string;
}

export const BorderConfigSchema: z.ZodType<BorderConfig> = z
  .object({
    widthPx: z.number().finite().min(0).max(64),
    style: z.enum(["none", "solid", "dashed", "dotted", "double"]),
    color: SafeColorValueSchema,
  })
  .strict();

export const SHADOW_PRESETS = [
  "none",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "card",
  "glow",
  "planet",
  "custom",
] as const;

export type ShadowPreset = (typeof SHADOW_PRESETS)[number];

export interface ShadowConfig {
  preset: ShadowPreset;
  offsetX?: number;
  offsetY?: number;
  blurPx?: number;
  spreadPx?: number;
  color?: string;
  inset?: boolean;
}

export const ShadowConfigSchema: z.ZodType<ShadowConfig> = z
  .object({
    preset: z.enum(SHADOW_PRESETS),
    offsetX: z.number().finite().min(-200).max(200).optional(),
    offsetY: z.number().finite().min(-200).max(200).optional(),
    blurPx: z.number().finite().min(0).max(300).optional(),
    spreadPx: z.number().finite().min(-100).max(200).optional(),
    color: SafeColorValueSchema.optional(),
    inset: z.boolean().optional(),
  })
  .strict();

export interface VisualFilterConfig {
  blurPx?: number;
  backdropBlurPx?: number;
  brightnessPercent?: number;
  contrastPercent?: number;
  saturatePercent?: number;
  grayscalePercent?: number;
}

export const VisualFilterConfigSchema: z.ZodType<VisualFilterConfig> = z
  .object({
    blurPx: z.number().finite().min(0).max(100).optional(),
    backdropBlurPx: z.number().finite().min(0).max(100).optional(),
    brightnessPercent: z.number().finite().min(0).max(300).optional(),
    contrastPercent: z.number().finite().min(0).max(300).optional(),
    saturatePercent: z.number().finite().min(0).max(300).optional(),
    grayscalePercent: z.number().finite().min(0).max(100).optional(),
  })
  .strict();

export interface AppearanceConfig {
  typography?: TypographyConfig;
  backgroundColor?: string;
  backgroundGradient?: GradientConfig;
  border?: BorderConfig;
  shadow?: ShadowConfig;
  opacity?: number;
  filters?: VisualFilterConfig;
}

export const AppearanceConfigSchema: z.ZodType<AppearanceConfig> = z
  .object({
    typography: TypographyConfigSchema.optional(),
    backgroundColor: SafeColorValueSchema.optional(),
    backgroundGradient: GradientConfigSchema.optional(),
    border: BorderConfigSchema.optional(),
    shadow: ShadowConfigSchema.optional(),
    opacity: z.number().finite().min(0).max(1).optional(),
    filters: VisualFilterConfigSchema.optional(),
  })
  .strict();
