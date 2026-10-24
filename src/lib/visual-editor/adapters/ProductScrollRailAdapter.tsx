import { FeaturedCollectionIntro } from "@/components/store/FeaturedCollectionIntro";
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
  const { dataCatalog, interactionPolicy } = usePageRenderContext();

  const collectionBinding = node.binding?.kind === "product_collection" ? node.binding : undefined;

  const items = resolveProductCollection(collectionBinding, dataCatalog);

  if (items.length === 0 && collectionBinding?.hideWhenEmpty !== false) {
    return null;
  }

  const variant = node.props.variant === "festive" ? "festive" : "default";
  const count = node.props.showCountBadge ? items.length : undefined;

  const searchSort = node.props.customAttributes?.linkSearchSort;
  const searchFeatured = node.props.customAttributes?.linkSearchFeatured;
  const searchParams: Record<string, unknown> | undefined =
    typeof searchSort === "string" && searchSort
      ? { sort: searchSort }
      : searchFeatured === true
        ? { featured: true }
        : undefined;

  const link =
    node.props.showViewAllLink !== false && node.props.viewAllHref
      ? {
          to: node.props.viewAllHref,
          ...(searchParams ? { search: searchParams } : {}),
          label: node.props.viewAllLabel ?? "View all",
        }
      : undefined;

  const wrapInStoreSection = node.props.customAttributes?.wrapInStoreSection === true;
  const railClassName =
    wrapInStoreSection || node.props.customAttributes?.railClassName === "my-0"
      ? "my-0"
      : undefined;

  const railGapPx =
    resolvedStyle.layout?.flex?.columnGapPx ?? resolvedStyle.layout?.grid?.columnGapPx;

  const railElement = (
    <ProductScrollRail
      title={node.props.title}
      eyebrow={node.props.eyebrow}
      count={count}
      link={link}
      items={items}
      variant={variant}
      className={railClassName}
      railGapPx={railGapPx}
      editorParentNodeId={interactionPolicy.emitEditorTelemetryAttributes ? node.id : undefined}
    />
  );

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      {wrapInStoreSection ? (
        <section
          id={node.props.scrollTargetId}
          className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:py-10 sm:px-6"
        >
          {node.props.scrollTargetId === "featured-products" && <FeaturedCollectionIntro />}
          {railElement}
        </section>
      ) : (
        railElement
      )}
    </AdapterBoundary>
  );
}
