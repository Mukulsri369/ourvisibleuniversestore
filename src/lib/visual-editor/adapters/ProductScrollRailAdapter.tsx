import React from "react";
import { ProductScrollRail } from "@/components/store/ProductScrollRail";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import { resolveProductCollection } from "../rendering/data-resolver";
import { AdapterBoundary } from "./AdapterBoundary";

/**
 * Adapter for `src/components/store/ProductScrollRail.tsx`.
 * - Resolves product collections from `node.binding` (`product_collection`) via `resolveProductCollection`.
 * - Preserves horizontal snap scrolling, auto-hiding left/right chevrons, edge fades, and quick preview.
 */
export function ProductScrollRailAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { dataCatalog } = usePageRenderContext();

  const collectionBinding = node.binding?.kind === "product_collection" ? node.binding : undefined;

  const items = resolveProductCollection(collectionBinding, dataCatalog);

  if (items.length === 0 && collectionBinding?.hideWhenEmpty !== false) {
    return null;
  }

  const variant = node.props.variant === "festive" ? "festive" : "default";
  const count = node.props.showCountBadge ? items.length : undefined;

  const link =
    node.props.showViewAllLink !== false && node.props.viewAllHref
      ? {
          to: node.props.viewAllHref,
          label: node.props.viewAllLabel ?? "View all",
        }
      : undefined;

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <ProductScrollRail
        title={node.props.title}
        eyebrow={node.props.eyebrow}
        count={count}
        link={link}
        items={items}
        variant={variant}
      />
    </AdapterBoundary>
  );
}
