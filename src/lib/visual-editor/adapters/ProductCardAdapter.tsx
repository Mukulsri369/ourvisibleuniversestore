import React from "react";
import { ProductCard } from "@/components/store/ProductCard";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import { resolveSingleProduct } from "../rendering/data-resolver";
import { AdapterBoundary } from "./AdapterBoundary";

/**
 * Adapter for `src/components/store/ProductCard.tsx`.
 * - Preserves 100% of product business data (`id`, `name`, `price`, `currency`, `affiliate_url`, `images`, `category`).
 * - Supports reusable card template styles via `cardTemplates["ProductCard"]` or `cardTemplates["ProductCardCompact"]`
 *   in `PageRenderContext` so updating a template updates all cards without mutating product records.
 * - Protects navigation and outbound affiliate clicks in `editor`, `preview`, and `mini_preview` modes.
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

  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      templateBaseStyle={templateBaseStyle}
    >
      <ProductCard
        p={product}
        compact={isCompact}
        onQuickPreview={
          interactionPolicy.allowQuickPreviewModal ? onQuickPreviewProduct : undefined
        }
      />
    </AdapterBoundary>
  );
}
