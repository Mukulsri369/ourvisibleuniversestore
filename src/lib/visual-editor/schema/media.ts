import { z } from "zod/v3";
import { AspectRatioValueSchema, type AspectRatioValue } from "./geometry";
import { FocalPointSchema, OBJECT_FIT_MODES, type FocalPoint, type ObjectFitMode } from "./shapes";

export const MEDIA_ASSET_TYPES = [
  "image",
  "video",
  "poster",
  "icon",
  "background",
  "decorative",
] as const;

export type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];

export const LOADING_PRIORITIES = ["eager", "lazy", "auto"] as const;
export type LoadingPriority = (typeof LOADING_PRIORITIES)[number];

/**
 * Validates asset URLs/paths:
 * - Allows root-relative paths (`/api/public/images/...`, `/assets/...`, `/images/...`)
 * - Allows `https://` URLs without embedded credentials
 * - Rejects `javascript:`, `data:`, `vbscript:`, `file:`, `http://` (non-TLS), or embedded `user:pass@`
 */
export const SafeAssetUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((val) => {
    const trimmed = val.trim();
    if (trimmed !== val) return false;
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:") ||
      lower.startsWith("file:") ||
      lower.startsWith("blob:")
    ) {
      return false;
    }
    if (trimmed.startsWith("/")) {
      return !trimmed.startsWith("//") && !/[\s<>"{}|\\^`]/.test(trimmed);
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") return false;
      if (parsed.username || parsed.password) return false;
      return true;
    } catch {
      return false;
    }
  }, "Unsafe or invalid media asset URL; only root-relative paths or https:// URLs without credentials are allowed");

export interface ResponsiveMediaVariant {
  url: string;
  widthPx?: number;
  heightPx?: number;
  mimeType?: "image/webp" | "image/avif" | "image/png" | "image/jpeg" | "video/mp4" | "video/webm";
}

export const ResponsiveMediaVariantSchema: z.ZodType<ResponsiveMediaVariant> = z
  .object({
    url: SafeAssetUrlSchema,
    widthPx: z.number().int().positive().max(10000).optional(),
    heightPx: z.number().int().positive().max(10000).optional(),
    mimeType: z
      .enum(["image/webp", "image/avif", "image/png", "image/jpeg", "video/mp4", "video/webm"])
      .optional(),
  })
  .strict();

export interface MediaAssetRef {
  assetId?: string;
  mediaType: MediaAssetType;
  url: string;
  altText: string;
  posterUrl?: string;
  aspectRatio?: AspectRatioValue | "auto";
  objectFit?: ObjectFitMode;
  focalPoint?: FocalPoint;
  loadingPriority?: LoadingPriority;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  variants?: {
    mobile?: ResponsiveMediaVariant;
    tablet?: ResponsiveMediaVariant;
    desktop?: ResponsiveMediaVariant;
  };
}

export const MediaAssetRefSchema: z.ZodType<MediaAssetRef> = z
  .object({
    assetId: z
      .string()
      .max(128)
      .regex(/^[a-zA-Z0-9._-]+$/)
      .optional(),
    mediaType: z.enum(MEDIA_ASSET_TYPES),
    url: SafeAssetUrlSchema,
    altText: z
      .string()
      .max(500)
      .refine((s) => !/<script/i.test(s), "Invalid characters in altText"),
    posterUrl: SafeAssetUrlSchema.optional(),
    aspectRatio: z.union([AspectRatioValueSchema, z.literal("auto")]).optional(),
    objectFit: z.enum(OBJECT_FIT_MODES).optional(),
    focalPoint: FocalPointSchema.optional(),
    loadingPriority: z.enum(LOADING_PRIORITIES).optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    autoplay: z.boolean().optional(),
    variants: z
      .object({
        mobile: ResponsiveMediaVariantSchema.optional(),
        tablet: ResponsiveMediaVariantSchema.optional(),
        desktop: ResponsiveMediaVariantSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
