import React from "react";
import { CategorySpotlightHero } from "@/components/store/CategorySpotlightHero";
import { getCelestialSystemForCategory } from "@/lib/celestial-catalog";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import { resolveProductCollection, resolveSingleProduct } from "../rendering/data-resolver";
import { AdapterBoundary } from "./AdapterBoundary";

/**
 * Adapter for `src/components/store/CategorySpotlightHero.tsx`.
 * - Preserves category/product bindings, quick-preview modal trigger, sector lore kicker,
 *   and collapsible long description toggle.
 */
export function CategorySpotlightAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { dataCatalog, currentProductItem, currentCategoryItem } = usePageRenderContext();

  let spotlightProduct = currentProductItem ?? null;

  if (node.binding?.kind === "single_product") {
    spotlightProduct = resolveSingleProduct(node.binding, dataCatalog, currentProductItem);
  } else if (node.binding?.kind === "product_collection") {
    const items = resolveProductCollection(node.binding, dataCatalog);
    spotlightProduct = items.find((p) => p.featured) ?? items[0] ?? null;
  } else if (!spotlightProduct) {
    spotlightProduct = dataCatalog.featuredProducts[0] ?? dataCatalog.allProducts[0] ?? null;
  }

  if (!spotlightProduct) {
    return null;
  }

  const category =
    currentCategoryItem ??
    dataCatalog.categories.find(
      (c) => c.id === spotlightProduct?.category_id || c.slug === spotlightProduct?.category?.slug,
    ) ??
    dataCatalog.categories[0];

  const categoryName =
    node.props.title ?? category?.name ?? spotlightProduct.category?.name ?? "Featured Sector";
  const categorySlug = category?.slug ?? spotlightProduct.category?.slug ?? "shop";
  const sectorLore = node.props.subtitle ?? getCelestialSystemForCategory(categorySlug).planetName;

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <CategorySpotlightHero
        product={spotlightProduct}
        categoryName={categoryName}
        categorySlug={categorySlug}
        sectorLore={sectorLore}
      />
    </AdapterBoundary>
  );
}
