import { z } from "zod/v3";

export const EASING_PRESETS = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "circOut",
  "backOut",
  "spring",
] as const;

export type EasingPreset = (typeof EASING_PRESETS)[number];

export const REDUCED_MOTION_POLICIES = ["respect_system", "always_reduce", "ignore"] as const;
export type ReducedMotionPolicy = (typeof REDUCED_MOTION_POLICIES)[number];

export interface EntranceAnimationConfig {
  enabled: boolean;
  preset: "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "scale-up";
  durationSec: number;
  delaySec?: number;
  easing?: EasingPreset;
  initialOpacity?: number;
  offsetPx?: number;
  initialScale?: number;
}

export const EntranceAnimationConfigSchema: z.ZodType<EntranceAnimationConfig> = z
  .object({
    enabled: z.boolean(),
    preset: z.enum([
      "none",
      "fade",
      "slide-up",
      "slide-down",
      "slide-left",
      "slide-right",
      "scale-up",
    ]),
    durationSec: z.number().finite().min(0).max(10),
    delaySec: z.number().finite().min(0).max(10).optional(),
    easing: z.enum(EASING_PRESETS).optional(),
    initialOpacity: z.number().finite().min(0).max(1).optional(),
    offsetPx: z.number().finite().min(-500).max(500).optional(),
    initialScale: z.number().finite().min(0.1).max(3).optional(),
  })
  .strict();

export interface HoverAnimationConfig {
  enabled: boolean;
  liftPx?: number;
  scale?: number;
  rotateDeg?: number;
  durationSec?: number;
  easing?: EasingPreset;
}

export const HoverAnimationConfigSchema: z.ZodType<HoverAnimationConfig> = z
  .object({
    enabled: z.boolean(),
    liftPx: z.number().finite().min(-64).max(64).optional(),
    scale: z.number().finite().min(0.5).max(2).optional(),
    rotateDeg: z.number().finite().min(-180).max(180).optional(),
    durationSec: z.number().finite().min(0).max(5).optional(),
    easing: z.enum(EASING_PRESETS).optional(),
  })
  .strict();

export interface ScrollEffectConfig {
  enabled: boolean;
  mode: "none" | "parallax-y" | "fade-in-on-scroll" | "scale-on-scroll";
  parallaxSpeed?: number;
  startProgress?: number;
  endProgress?: number;
}

export const ScrollEffectConfigSchema: z.ZodType<ScrollEffectConfig> = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(["none", "parallax-y", "fade-in-on-scroll", "scale-on-scroll"]),
    parallaxSpeed: z.number().finite().min(-2).max(2).optional(),
    startProgress: z.number().finite().min(0).max(1).optional(),
    endProgress: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

export interface LoopAnimationConfig {
  enabled: boolean;
  mode: "none" | "spin" | "float" | "pulse";
  durationSec: number;
  reverse?: boolean;
}

export const LoopAnimationConfigSchema: z.ZodType<LoopAnimationConfig> = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(["none", "spin", "float", "pulse"]),
    durationSec: z.number().finite().min(0.2).max(600),
    reverse: z.boolean().optional(),
  })
  .strict();

export interface PlanetHeroAnimationConfig {
  defaultPlanetId: "earth" | "venus" | "mars";
  enableVideoPlayback: boolean;
  titleSlideDurationSec: number;
  ledeFadeDurationSec: number;
  ruleScaleDurationSec: number;
  cutoutHoverScale: number;
}

export const PlanetHeroAnimationConfigSchema: z.ZodType<PlanetHeroAnimationConfig> = z
  .object({
    defaultPlanetId: z.enum(["earth", "venus", "mars"]),
    enableVideoPlayback: z.boolean(),
    titleSlideDurationSec: z.number().finite().min(0).max(5),
    ledeFadeDurationSec: z.number().finite().min(0).max(5),
    ruleScaleDurationSec: z.number().finite().min(0).max(5),
    cutoutHoverScale: z.number().finite().min(0.8).max(1.5),
  })
  .strict();

export interface CelestialScrollAnimationConfig {
  enabled: boolean;
  springStiffness: number;
  springDamping: number;
  springMass: number;
  showOrbitalRings: boolean;
  earthEnabled: boolean;
  venusEnabled: boolean;
  marsEnabled: boolean;
}

export const CelestialScrollAnimationConfigSchema: z.ZodType<CelestialScrollAnimationConfig> = z
  .object({
    enabled: z.boolean(),
    springStiffness: z.number().finite().min(5).max(500),
    springDamping: z.number().finite().min(1).max(200),
    springMass: z.number().finite().min(0.1).max(10),
    showOrbitalRings: z.boolean(),
    earthEnabled: z.boolean(),
    venusEnabled: z.boolean(),
    marsEnabled: z.boolean(),
  })
  .strict();

export interface ProductCardHoverAnimationConfig {
  enableImageSlideshow: boolean;
  slideshowIntervalMs: number;
  crossfadeDurationSec: number;
  imageHoverScale: number;
}

export const ProductCardHoverAnimationConfigSchema: z.ZodType<ProductCardHoverAnimationConfig> = z
  .object({
    enableImageSlideshow: z.boolean(),
    slideshowIntervalMs: z.number().int().min(400).max(15000),
    crossfadeDurationSec: z.number().finite().min(0).max(3),
    imageHoverScale: z.number().finite().min(1).max(1.5),
  })
  .strict();

export interface AnimationConfig {
  reducedMotionPolicy?: ReducedMotionPolicy;
  entrance?: EntranceAnimationConfig;
  hover?: HoverAnimationConfig;
  scroll?: ScrollEffectConfig;
  loop?: LoopAnimationConfig;
  planetHero?: PlanetHeroAnimationConfig;
  celestialScroll?: CelestialScrollAnimationConfig;
  productCardHover?: ProductCardHoverAnimationConfig;
}

export const AnimationConfigSchema: z.ZodType<AnimationConfig> = z
  .object({
    reducedMotionPolicy: z.enum(REDUCED_MOTION_POLICIES).optional(),
    entrance: EntranceAnimationConfigSchema.optional(),
    hover: HoverAnimationConfigSchema.optional(),
    scroll: ScrollEffectConfigSchema.optional(),
    loop: LoopAnimationConfigSchema.optional(),
    planetHero: PlanetHeroAnimationConfigSchema.optional(),
    celestialScroll: CelestialScrollAnimationConfigSchema.optional(),
    productCardHover: ProductCardHoverAnimationConfigSchema.optional(),
  })
  .strict();
