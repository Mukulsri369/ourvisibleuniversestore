import type { Category, ProductCardData } from "@/lib/store";
import { getCelestialSystemForCategory } from "@/lib/celestial-catalog";
import type {
  CategoryCollectionBinding,
  ProductCollectionBinding,
  ProductSortMode,
  RepeatedCategorySectionsBinding,
  SingleProductBinding,
} from "../schema/bindings";
import type { StorefrontDataCatalog } from "./RenderContext";

export interface ResolvedCategorySection {
  readonly category: Category;
  readonly products: ProductCardData[];
  readonly spotlightProduct: ProductCardData | null;
  readonly sectorLore: string;
}

/**
 * Deterministic Linear Congruential Generator (LCG) Fisher-Yates shuffle.
 * Guarantees reproducible product order in tests, previews, and deterministic collections
 * without mutating the source array.
 */
export function deterministicShuffleProducts<T>(items: readonly T[], seed = 42): T[] {
  let state = seed >>> 0 || 42;
  const nextRand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function sortProductCollection(
  items: readonly ProductCardData[],
  sortMode: ProductSortMode,
  deterministicSeed?: number,
): ProductCardData[] {
  const copy = [...items];
  switch (sortMode) {
    case "default_preserve_order":
      return copy;
    case "deterministic_shuffle":
      return deterministicShuffleProducts(copy, deterministicSeed ?? 42);
    case "featured_first":
      return copy.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    case "newest":
      return copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "price_asc":
      return copy.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    case "price_desc":
      return copy.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    case "name_asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}

function productMatchesCategory(
  product: ProductCardData,
  categoryId?: string,
  categorySlug?: string,
): boolean {
  if (categoryId) {
    if (product.category_id === categoryId) return true;
    if (product.category_ids?.includes(categoryId)) return true;
  }
  if (categorySlug) {
    if (product.category?.slug === categorySlug) return true;
  }
  return false;
}

/**
 * Resolves a product collection from `StorefrontDataCatalog` without making network calls
 * or mutating underlying product business data.
 */
export function resolveProductCollection(
  binding: ProductCollectionBinding | undefined,
  catalog: StorefrontDataCatalog,
  fallbackItems?: readonly ProductCardData[],
): ProductCardData[] {
  if (!binding) {
    return fallbackItems ? [...fallbackItems] : [...catalog.featuredProducts];
  }

  let baseList: readonly ProductCardData[] = [];

  switch (binding.source) {
    case "featured":
      baseList =
        catalog.featuredProducts.length > 0
          ? catalog.featuredProducts
          : catalog.allProducts.filter((p) => p.featured);
      break;
    case "new_arrivals":
      baseList = catalog.newestProducts.length > 0 ? catalog.newestProducts : catalog.allProducts;
      break;
    case "festival":
      baseList = catalog.festivalProducts;
      break;
    case "category": {
      const targetCat = catalog.categories.find(
        (c) =>
          (binding.categoryId && c.id === binding.categoryId) ||
          (binding.categorySlug && c.slug === binding.categorySlug),
      );
      const resolvedCatId = binding.categoryId ?? targetCat?.id;
      const resolvedCatSlug = binding.categorySlug ?? targetCat?.slug;
      const pool = catalog.allProducts.length > 0 ? catalog.allProducts : catalog.featuredProducts;
      baseList = pool.filter((p) => productMatchesCategory(p, resolvedCatId, resolvedCatSlug));
      break;
    }
    case "curated_ids": {
      const pool =
        catalog.allProducts.length > 0
          ? catalog.allProducts
          : [...catalog.featuredProducts, ...catalog.newestProducts, ...catalog.festivalProducts];
      const byId = new Map<string, ProductCardData>();
      for (const p of pool) {
        if (!byId.has(p.id)) byId.set(p.id, p);
      }
      const ordered: ProductCardData[] = [];
      for (const id of binding.curatedProductIds ?? []) {
        const found = byId.get(id);
        if (found) ordered.push(found);
      }
      baseList = ordered;
      break;
    }
    case "all_active":
      baseList = catalog.allProducts.length > 0 ? catalog.allProducts : catalog.featuredProducts;
      break;
  }

  const sorted = sortProductCollection(baseList, binding.sortMode, binding.deterministicSeed);
  return sorted.slice(0, binding.limit);
}

/**
 * Resolves a single product from `StorefrontDataCatalog` while preserving all protected business fields.
 */
export function resolveSingleProduct(
  binding: SingleProductBinding | undefined,
  catalog: StorefrontDataCatalog,
  contextualProduct?: ProductCardData | null,
): ProductCardData | null {
  if (contextualProduct && !binding) {
    return contextualProduct;
  }

  const pool =
    catalog.allProducts.length > 0
      ? catalog.allProducts
      : [...catalog.featuredProducts, ...catalog.newestProducts, ...catalog.festivalProducts];

  if (binding) {
    const found = pool.find((p) => p.id === binding.productId);
    if (found) return found;
    if (binding.fallbackToFirstFeatured !== false) {
      return catalog.featuredProducts[0] ?? pool[0] ?? contextualProduct ?? null;
    }
    return null;
  }

  return contextualProduct ?? catalog.featuredProducts[0] ?? pool[0] ?? null;
}

/**
 * Resolves a category collection respecting admin `sort_order` and non-empty filtering.
 */
export function resolveCategoryCollection(
  binding: CategoryCollectionBinding | undefined,
  catalog: StorefrontDataCatalog,
): Category[] {
  let categories = [...catalog.categories];

  if (binding?.mode === "selected_ids" && binding.selectedCategoryIds?.length) {
    const byId = new Map(categories.map((c) => [c.id, c]));
    categories = binding.selectedCategoryIds
      .map((id) => byId.get(id))
      .filter((c): c is Category => Boolean(c));
  } else if (binding?.respectDisplayOrder !== false) {
    categories.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  if (binding?.hideEmptyCategories && catalog.allProducts.length > 0) {
    categories = categories.filter((cat) =>
      catalog.allProducts.some((p) => productMatchesCategory(p, cat.id, cat.slug)),
    );
  }

  if (binding?.limit !== undefined) {
    categories = categories.slice(0, binding.limit);
  }

  return categories;
}

/**
 * Resolves the homepage's dynamic repeated category sections (CategorySpotlightHero + ProductScrollRail)
 * matching the exact logic in `src/routes/_store.index.tsx`.
 */
export function resolveRepeatedCategorySections(
  binding: RepeatedCategorySectionsBinding | undefined,
  catalog: StorefrontDataCatalog,
): ResolvedCategorySection[] {
  const categories = resolveCategoryCollection(
    binding
      ? {
          kind: "category_collection",
          mode: binding.mode === "selected_ids" ? "selected_ids" : "all_active",
          selectedCategoryIds: binding.selectedCategoryIds,
          respectDisplayOrder: binding.respectDisplayOrder,
          hideEmptyCategories: false,
          limit: binding.maxCategories,
        }
      : undefined,
    catalog,
  );

  const pool = catalog.allProducts.length > 0 ? catalog.allProducts : catalog.featuredProducts;
  const social =
    (catalog.settings?.social_links as Record<string, unknown> | null | undefined) ?? {};
  const categorySpotlights =
    (social.category_spotlights as Record<string, string> | undefined) ?? {};

  const sections: ResolvedCategorySection[] = [];

  for (const cat of categories) {
    const rawCatProducts = pool.filter((p) => productMatchesCategory(p, cat.id, cat.slug));
    if (rawCatProducts.length === 0) continue;

    const sortedProducts = sortProductCollection(
      rawCatProducts,
      binding?.railSortMode ?? "default_preserve_order",
    ).slice(0, binding?.productsPerRail ?? 24);

    const customSpotlightId = categorySpotlights[cat.id] || categorySpotlights[cat.slug];
    const spotlightProduct =
      binding?.useSpotlightForFirstProduct === false
        ? null
        : (customSpotlightId
            ? sortedProducts.find((p) => p.id === customSpotlightId) ||
              pool.find((p) => p.id === customSpotlightId)
            : null) ||
          sortedProducts.find((p) => p.featured) ||
          sortedProducts[0] ||
          null;

    const celestial = getCelestialSystemForCategory(cat.slug);

    sections.push({
      category: cat,
      products: sortedProducts,
      spotlightProduct,
      sectorLore: celestial.planetName,
    });
  }

  return binding?.maxCategories ? sections.slice(0, binding.maxCategories) : sections;
}
