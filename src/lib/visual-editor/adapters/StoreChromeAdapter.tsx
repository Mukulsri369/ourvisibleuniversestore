import React from "react";
import { StoreFooter, StoreHeader } from "@/components/store/StoreChrome";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import { AdapterBoundary } from "./AdapterBoundary";

/**
 * Adapters for `StoreHeader` and `StoreFooter` from `src/components/store/StoreChrome.tsx`.
 *
 * CRITICAL COMPOSITION SAFEGUARD (Part 5, Requirement 17):
 * The storefront route layout (`src/routes/_store.tsx`) already renders `<StoreHeader />` and `<StoreFooter />`
 * around `<Outlet />`. Therefore, when `renderGlobalChromeInDocument` is `false` (the default for route-embedded
 * page rendering), `StoreHeaderAdapter` and `StoreFooterAdapter` return `null` in `"public"` mode so duplicate
 * headers or footers are NEVER rendered.
 * When `renderGlobalChromeInDocument` is `true` (e.g. standalone full-page canvas or explicit chrome test),
 * they render the real `<StoreHeader />` and `<StoreFooter />` components.
 */
export function StoreHeaderAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { renderGlobalChromeInDocument, interactionPolicy } = usePageRenderContext();

  if (interactionPolicy.disableHeavyMediaAndScrollEffects) {
    return (
      <div
        data-mini-preview-component="StoreHeader"
        className="flex h-10 items-center justify-between rounded-lg border border-border/60 bg-background/90 px-3 text-xs text-foreground"
      >
        <span className="font-display">Our Visible Universe</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Header
        </span>
      </div>
    );
  }

  if (!renderGlobalChromeInDocument) {
    return null;
  }

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <StoreHeader />
    </AdapterBoundary>
  );
}

export function StoreFooterAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { renderGlobalChromeInDocument, interactionPolicy } = usePageRenderContext();

  if (interactionPolicy.disableHeavyMediaAndScrollEffects) {
    return (
      <div
        data-mini-preview-component="StoreFooter"
        className="flex h-10 items-center justify-between rounded-lg border border-border/60 bg-background/90 px-3 text-xs text-muted-foreground"
      >
        <span>© Our Visible Universe</span>
        <span className="font-mono text-[9px] uppercase tracking-widest">Footer</span>
      </div>
    );
  }

  if (!renderGlobalChromeInDocument) {
    return null;
  }

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <StoreFooter />
    </AdapterBoundary>
  );
}
