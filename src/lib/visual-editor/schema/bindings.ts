import { z } from "zod/v3";

const SAFE_RECORD_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export const SafeEntityIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(SAFE_RECORD_ID_REGEX, "Invalid entity identifier");

export const PRODUCT_COLLECTION_SOURCES = [
  "featured",
  "new_arrivals",
  "festival",
  "category",
  "curated_ids",
  "all_active",
] as const;

export type ProductCollectionSource = (typeof PRODUCT_COLLECTION_SOURCES)[number];

export const PRODUCT_SORT_MODES = [
  "default_preserve_order",
  "featured_first",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
  "deterministic_shuffle",
] as const;

export type ProductSortMode = (typeof PRODUCT_SORT_MODES)[number];

export interface ProductCardDisplayOptions {
  showCategoryBadge?: boolean;
  showFeaturedStar?: boolean;
  showPrice?: boolean;
  showQuickPreviewButton?: boolean;
  showBuyButton?: boolean;
  enableHoverImageSlideshow?: boolean;
  compactMode?: boolean;
}

export const ProductCardDisplayOptionsSchema: z.ZodType<ProductCardDisplayOptions> = z
  .object({
    showCategoryBadge: z.boolean().optional(),
    showFeaturedStar: z.boolean().optional(),
    showPrice: z.boolean().optional(),
    showQuickPreviewButton: z.boolean().optional(),
    showBuyButton: z.boolean().optional(),
    enableHoverImageSlideshow: z.boolean().optional(),
    compactMode: z.boolean().optional(),
  })
  .strict();

export interface ProductCollectionBinding {
  kind: "product_collection";
  source: ProductCollectionSource;
  categoryId?: string;
  categorySlug?: string;
  curatedProductIds?: string[];
  sortMode: ProductSortMode;
  limit: number;
  deterministicSeed?: number;
  hideWhenEmpty?: boolean;
  cardDisplay?: ProductCardDisplayOptions;
}

export const ProductCollectionBindingSchema: z.ZodType<ProductCollectionBinding> = z
  .object({
    kind: z.literal("product_collection"),
    source: z.enum(PRODUCT_COLLECTION_SOURCES),
    categoryId: SafeEntityIdSchema.optional(),
    categorySlug: SafeEntityIdSchema.optional(),
    curatedProductIds: z.array(SafeEntityIdSchema).max(100).optional(),
    sortMode: z.enum(PRODUCT_SORT_MODES),
    limit: z.number().int().min(1).max(100),
    deterministicSeed: z.number().int().min(0).max(2147483647).optional(),
    hideWhenEmpty: z.boolean().optional(),
    cardDisplay: ProductCardDisplayOptionsSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.source === "category" && !val.categoryId && !val.categorySlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Category collection binding requires categoryId or categorySlug",
      });
    }
    if (
      val.source === "curated_ids" &&
      (!val.curatedProductIds || val.curatedProductIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["curatedProductIds"],
        message: "Curated product collection binding requires at least one product ID",
      });
    }
  });

export interface SingleProductBinding {
  kind: "single_product";
  productId: string;
  fallbackToFirstFeatured?: boolean;
  cardDisplay?: ProductCardDisplayOptions;
}

export const SingleProductBindingSchema: z.ZodType<SingleProductBinding> = z
  .object({
    kind: z.literal("single_product"),
    productId: SafeEntityIdSchema,
    fallbackToFirstFeatured: z.boolean().optional(),
    cardDisplay: ProductCardDisplayOptionsSchema.optional(),
  })
  .strict();

export interface CategoryCollectionBinding {
  kind: "category_collection";
  mode: "all_active" | "selected_ids";
  selectedCategoryIds?: string[];
  respectDisplayOrder: boolean;
  hideEmptyCategories: boolean;
  limit?: number;
}

export const CategoryCollectionBindingSchema: z.ZodType<CategoryCollectionBinding> = z
  .object({
    kind: z.literal("category_collection"),
    mode: z.enum(["all_active", "selected_ids"]),
    selectedCategoryIds: z.array(SafeEntityIdSchema).max(50).optional(),
    respectDisplayOrder: z.boolean(),
    hideEmptyCategories: z.boolean(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (
      val.mode === "selected_ids" &&
      (!val.selectedCategoryIds || val.selectedCategoryIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedCategoryIds"],
        message: "selected_ids mode requires at least one category ID",
      });
    }
  });

export interface RepeatedCategorySectionsBinding {
  kind: "repeated_category_sections";
  mode: "all_non_empty" | "selected_ids";
  selectedCategoryIds?: string[];
  respectDisplayOrder: boolean;
  maxCategories: number;
  productsPerRail: number;
  eagerLoadCount: number;
  useSpotlightForFirstProduct: boolean;
  railSortMode: ProductSortMode;
}

export const RepeatedCategorySectionsBindingSchema: z.ZodType<RepeatedCategorySectionsBinding> = z
  .object({
    kind: z.literal("repeated_category_sections"),
    mode: z.enum(["all_non_empty", "selected_ids"]),
    selectedCategoryIds: z.array(SafeEntityIdSchema).max(50).optional(),
    respectDisplayOrder: z.boolean(),
    maxCategories: z.number().int().min(1).max(50),
    productsPerRail: z.number().int().min(1).max(48),
    eagerLoadCount: z.number().int().min(0).max(12),
    useSpotlightForFirstProduct: z.boolean(),
    railSortMode: z.enum(PRODUCT_SORT_MODES),
  })
  .strict();

export type DataBinding =
  | ProductCollectionBinding
  | SingleProductBinding
  | CategoryCollectionBinding
  | RepeatedCategorySectionsBinding;

export const DataBindingSchema: z.ZodType<DataBinding> = z.union([
  ProductCollectionBindingSchema,
  SingleProductBindingSchema,
  CategoryCollectionBindingSchema,
  RepeatedCategorySectionsBindingSchema,
]);

/**
 * Protected business keys that must NEVER be stored inside visual node props or bindings
 * to prevent stale prices, tampered affiliate URLs, or unauthorized product mutations.
 */
export const FORBIDDEN_BUSINESS_DATA_KEYS = new Set([
  "affiliate_url",
  "amazon_url",
  "price",
  "currency",
  "click_events",
  "admin_email",
  "service_role_key",
]);
