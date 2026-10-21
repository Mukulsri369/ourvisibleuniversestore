import React from "react";
import { ProductCard } from "@/components/store/ProductCard";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import { resolveSingleProduct } from "../rendering/data-resolver";
import {
  resolveImageCropCssProperties,
  resolveNodeCssProperties,
} from "../rendering/style-resolver";
import type { NodeStyleBundle } from "../schema/responsive";
import { AdapterBoundary } from "./AdapterBoundary";

/**
 * Adapter for `src/components/store/ProductCard.tsx`.
 * - Preserves 100% of product business data (`id`, `name`, `price`, `currency`, `affiliate_url`, `images`, `category`).
 * - Supports reusable card template styles via `cardTemplates["ProductCard"]` or `cardTemplates["ProductCardCompact"]`
 *   in `PageRenderContext` so updating a template updates all cards without mutating product records.
 * - Passes card-level visual overrides (`borderRadius`, `clipPath`, `backgroundColor`, `border`, `boxShadow`, `padding`, `imageCrop`)
 *   directly to the rendered `<article>` and `<ProductImage>` so the actual card visually updates while preserving image clipping.
 */
export function ProductCardAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const {
    dataCatalog,
    currentProductItem,
    cardTemplates,
    interactionPolicy,
    onQuickPreviewProduct,
  } = usePageRenderContext();

  const singleBinding = node.binding?.kind === "single_product" ? node.binding : undefined;

  const product = resolveSingleProduct(singleBinding, dataCatalog, currentProductItem);

  if (!product) {
    return null;
  }

  const isCompact = Boolean(node.props.compact) || Boolean(singleBinding?.cardDisplay?.compactMode);

  const templateKey = isCompact ? "ProductCardCompact" : "ProductCard";
  const templateBaseStyle = cardTemplates[templateKey] ?? cardTemplates.ProductCard;

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
      templateBaseStyle={templateBaseStyle}
    >
      <ProductCard
        p={product}
        compact={isCompact}
        style={cardSurfaceStyle}
        imageStyle={imageCropStyle}
        onQuickPreview={
          interactionPolicy.allowQuickPreviewModal ? onQuickPreviewProduct : undefined
        }
      />
    </AdapterBoundary>
  );
}
