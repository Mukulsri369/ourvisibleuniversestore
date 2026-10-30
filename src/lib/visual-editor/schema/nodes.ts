import { z } from "zod/v3";
import { MediaAssetRefSchema, type MediaAssetRef } from "./media";
import { DataBindingSchema, type DataBinding } from "./bindings";
import {
  NodeStyleBundleSchema,
  ResponsiveOverridesSchema,
  type NodeStyleBundle,
  type ResponsiveOverrides,
} from "./responsive";

export const GENERIC_COMPONENT_TYPES = [
  "Section",
  "Container",
  "Stack",
  "Grid",
  "GridItem",
  "Text",
  "Heading",
  "Image",
  "Video",
  "Button",
  "Icon",
  "Divider",
  "Spacer",
  "Shape",
  "Overlay",
] as const;

export type GenericComponentType = (typeof GENERIC_COMPONENT_TYPES)[number];

export const STOREFRONT_COMPONENT_TYPES = [
  "PlanetHero",
  "CelestialScrollWorld",
  "ProductScrollRail",
  "ProductGrid",
  "ProductCard",
  "CategorySpotlightHero",
  "CategoryGrid",
  "CategoryCard",
  "FestivalSection",
  "FeaturedCollection",
  "PromotionalBanner",
  "InterestSection",
  "BenefitsSection",
  "InstagramSection",
  "StoreHeader",
  "StoreFooter",
] as const;

export type StorefrontComponentType = (typeof STOREFRONT_COMPONENT_TYPES)[number];

export const COMPONENT_TYPES = [...GENERIC_COMPONENT_TYPES, ...STOREFRONT_COMPONENT_TYPES] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];
export type EditorComponentType = ComponentType;

export const ComponentTypeSchema = z.enum(COMPONENT_TYPES);

/**
 * Leaf component types that must not contain arbitrary nested child nodes.
 */
export const LEAF_COMPONENT_TYPES = new Set<ComponentType>([
  "Text",
  "Heading",
  "Image",
  "Video",
  "Button",
  "Icon",
  "Divider",
  "Spacer",
  "ProductCard",
  "CategoryCard",
  "CelestialScrollWorld",
  "StoreHeader",
  "StoreFooter",
]);

/**
 * Root-only structural chrome components that can only be placed at depth 0 (`document.root`).
 */
export const ROOT_ONLY_COMPONENT_TYPES = new Set<ComponentType>([
  "StoreHeader",
  "StoreFooter",
  "CelestialScrollWorld",
  "PlanetHero",
]);

/**
 * Safe link target validation: allows internal routes (`/shop`, `/category/...`, `/search?q=...`)
 * or `https://` URLs without script injection.
 */
export const SafeHrefSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((val) => {
    const trimmed = val.trim();
    if (trimmed !== val) return false;
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:") ||
      lower.startsWith("file:")
    ) {
      return false;
    }
    if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
      return !trimmed.startsWith("//") && !/<script/i.test(trimmed);
    }
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, "Unsafe or invalid href target");

export type SafePrimitiveValue = string | number | boolean | null;

export interface SafeComponentProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  description?: string;
  text?: string;
  label?: string;
  href?: string;
  openInNewTab?: boolean;
  headingLevel?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  variant?: "default" | "festive" | "outline" | "ghost" | "glass" | "planet" | "secondary";
  iconName?: string;
  compact?: boolean;
  showCountBadge?: boolean;
  showViewAllLink?: boolean;
  viewAllLabel?: string;
  viewAllHref?: string;
  brandTitle?: string;
  brandHighlight?: string;
  scrollTargetId?: string;
  instagramHandle?: string;
  customAttributes?: Record<string, SafePrimitiveValue>;
}

const SafeStringProp = (maxLen = 2000) =>
  z
    .string()
    .max(maxLen)
    .refine(
      (s) => !/<script/i.test(s) && !/javascript:/i.test(s) && !/on[a-z]+\s*=/i.test(s),
      "Unsafe HTML or script pattern rejected in component text property",
    );

export const SafeComponentPropsSchema: z.ZodType<SafeComponentProps> = z
  .object({
    title: SafeStringProp(300).optional(),
    subtitle: SafeStringProp(500).optional(),
    eyebrow: SafeStringProp(160).optional(),
    description: SafeStringProp(3000).optional(),
    text: SafeStringProp(5000).optional(),
    label: SafeStringProp(200).optional(),
    href: SafeHrefSchema.optional(),
    openInNewTab: z.boolean().optional(),
    headingLevel: z.enum(["h1", "h2", "h3", "h4", "h5", "h6"]).optional(),
    variant: z
      .enum(["default", "festive", "outline", "ghost", "glass", "planet", "secondary"])
      .optional(),
    iconName: z
      .string()
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    compact: z.boolean().optional(),
    showCountBadge: z.boolean().optional(),
    showViewAllLink: z.boolean().optional(),
    viewAllLabel: SafeStringProp(120).optional(),
    viewAllHref: SafeHrefSchema.optional(),
    brandTitle: SafeStringProp(120).optional(),
    brandHighlight: SafeStringProp(120).optional(),
    scrollTargetId: z
      .string()
      .max(80)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    instagramHandle: SafeStringProp(100).optional(),
    customAttributes: z
      .record(
        z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),
        z.union([SafeStringProp(500), z.number().finite(), z.boolean(), z.null()]),
      )
      .optional(),
  })
  .strict();

export interface EditorNode {
  id: string;
  type: ComponentType;
  name: string;
  locked?: boolean;
  hidden?: boolean;
  slotName?: string;
  props: SafeComponentProps;
  style: NodeStyleBundle;
  responsive?: ResponsiveOverrides;
  binding?: DataBinding;
  media?: Record<string, MediaAssetRef>;
  children: EditorNode[];
  slots?: Record<string, EditorNode[]>;
}

export const NodeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/, "Invalid node ID format");

export const EditorNodeSchema: z.ZodType<EditorNode> = z.lazy(() =>
  z
    .object({
      id: NodeIdSchema,
      type: ComponentTypeSchema,
      name: SafeStringProp(160),
      locked: z.boolean().optional(),
      hidden: z.boolean().optional(),
      slotName: z
        .string()
        .max(64)
        .regex(/^[a-zA-Z0-9_-]+$/)
        .optional(),
      props: SafeComponentPropsSchema,
      style: NodeStyleBundleSchema,
      responsive: ResponsiveOverridesSchema.optional(),
      binding: DataBindingSchema.optional(),
      media: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), MediaAssetRefSchema).optional(),
      children: z.array(EditorNodeSchema),
      slots: z
        .record(z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), z.array(EditorNodeSchema))
        .optional(),
    })
    .strict(),
);
