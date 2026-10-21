import React from "react";
import { CategoryCard } from "@/components/store/CategoryCard";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import { resolveCategoryCollection } from "../rendering/data-resolver";
import {
  resolveImageCropCssProperties,
  resolveNodeCssProperties,
} from "../rendering/style-resolver";
import type { NodeStyleBundle } from "../schema/responsive";
import { AdapterBoundary } from "./AdapterBoundary";

/**
 * Adapter for `src/components/store/CategoryCard.tsx`.
 * - Preserves cosmic icon mapping, procedural starfield fallback, and category routing.
 * - Supports reusable `cardTemplates["CategoryCard"]` presentation overrides and passes
 *   card surface styles directly to the rendered `<Link>` card element.
 */
export function CategoryCardAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { dataCatalog, currentCategoryItem, cardTemplates } = usePageRenderContext();

  let category = currentCategoryItem ?? null;

  if (!category && node.binding?.kind === "category_collection") {
    const resolved = resolveCategoryCollection(node.binding, dataCatalog);
    category = resolved[0] ?? null;
  }

  if (!category) {
    category = dataCatalog.categories[0] ?? null;
  }

  if (!category) {
    return null;
  }

  const templateBaseStyle = cardTemplates.CategoryCard;
  const mergedStyleBundle: NodeStyleBundle = templateBaseStyle
    ? {
        ...templateBaseStyle,
        ...resolvedStyle,
        geometry: { ...templateBaseStyle.geometry, ...resolvedStyle.geometry },
        shape: { ...templateBaseStyle.shape, ...resolvedStyle.shape },
        layout: { ...templateBaseStyle.layout, ...resolvedStyle.layout },
        appearance: { ...templateBaseStyle.appearance, ...resolvedStyle.appearance },
      }
    : resolvedStyle;

  const cardSurfaceStyle = resolveNodeCssProperties(mergedStyleBundle);
  const imageCropStyle = resolveImageCropCssProperties(mergedStyleBundle.shape?.imageCrop);

  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      templateBaseStyle={cardTemplates.CategoryCard}
    >
      <CategoryCard c={category} style={cardSurfaceStyle} imageStyle={imageCropStyle} />
    </AdapterBoundary>
  );
}
