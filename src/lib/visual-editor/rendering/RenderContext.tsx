import React, { createContext, useContext, useMemo } from "react";
import type { Category, ProductCardData, Settings } from "@/lib/store";
import type { EditorBreakpoint, NodeStyleBundle } from "../schema/responsive";
import type { VisualComponentRegistry } from "../registry/component-registry";

export const RENDER_MODES = ["public", "editor", "preview", "mini_preview"] as const;
export type RenderMode = (typeof RENDER_MODES)[number];

export interface InteractionPolicy {
  readonly allowNavigation: boolean;
  readonly allowAffiliateRedirect: boolean;
  readonly allowOutboundClickTracking: boolean;
  readonly allowQuickPreviewModal: boolean;
  readonly interceptNodeClickForSelection: boolean;
  readonly emitEditorTelemetryAttributes: boolean;
  readonly disableHeavyMediaAndScrollEffects: boolean;
}

export const INTERACTION_POLICIES: Readonly<Record<RenderMode, InteractionPolicy>> = Object.freeze({
  public: Object.freeze({
    allowNavigation: true,
    allowAffiliateRedirect: true,
    allowOutboundClickTracking: true,
    allowQuickPreviewModal: true,
    interceptNodeClickForSelection: false,
    emitEditorTelemetryAttributes: false,
    disableHeavyMediaAndScrollEffects: false,
  }),
  editor: Object.freeze({
    allowNavigation: false,
    allowAffiliateRedirect: false,
    allowOutboundClickTracking: false,
    allowQuickPreviewModal: false,
    interceptNodeClickForSelection: true,
    emitEditorTelemetryAttributes: true,
    disableHeavyMediaAndScrollEffects: false,
  }),
  preview: Object.freeze({
    allowNavigation: false,
    allowAffiliateRedirect: false,
    allowOutboundClickTracking: false,
    allowQuickPreviewModal: true,
    interceptNodeClickForSelection: false,
    emitEditorTelemetryAttributes: false,
    disableHeavyMediaAndScrollEffects: false,
  }),
  mini_preview: Object.freeze({
    allowNavigation: false,
    allowAffiliateRedirect: false,
    allowOutboundClickTracking: false,
    allowQuickPreviewModal: false,
    interceptNodeClickForSelection: false,
    emitEditorTelemetryAttributes: false,
    disableHeavyMediaAndScrollEffects: true,
  }),
});

export interface StorefrontDataCatalog {
  readonly featuredProducts: readonly ProductCardData[];
  readonly newestProducts: readonly ProductCardData[];
  readonly festivalProducts: readonly ProductCardData[];
  readonly allProducts: readonly ProductCardData[];
  readonly categories: readonly Category[];
  readonly settings?: Partial<Settings> | null;
}

export const EMPTY_STOREFRONT_DATA_CATALOG: StorefrontDataCatalog = Object.freeze({
  featuredProducts: Object.freeze([]),
  newestProducts: Object.freeze([]),
  festivalProducts: Object.freeze([]),
  allProducts: Object.freeze([]),
  categories: Object.freeze([]),
  settings: null,
});

export interface PageRenderContextValue {
  readonly mode: RenderMode;
  readonly breakpoint: EditorBreakpoint;
  readonly interactionPolicy: InteractionPolicy;
  readonly dataCatalog: StorefrontDataCatalog;
  readonly registry: VisualComponentRegistry;
  readonly selectedNodeId: string | null;
  readonly hoveredNodeId: string | null;
  readonly renderGlobalChromeInDocument: boolean;
  readonly renderGlobalBackgroundInFlow: boolean;
  readonly cardTemplates: Readonly<Record<string, NodeStyleBundle>>;
  readonly currentProductItem?: ProductCardData | null;
  readonly currentCategoryItem?: Category | null;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onHoverNode?: (nodeId: string | null) => void;
  readonly onQuickPreviewProduct?: (product: ProductCardData) => void;
}

const PageRenderContext = createContext<PageRenderContextValue | null>(null);

export interface PageRenderProviderProps {
  value: PageRenderContextValue;
  children: React.ReactNode;
}

export function PageRenderProvider({ value, children }: PageRenderProviderProps) {
  return <PageRenderContext.Provider value={value}>{children}</PageRenderContext.Provider>;
}

export function usePageRenderContext(): PageRenderContextValue {
  const ctx = useContext(PageRenderContext);
  if (!ctx) {
    throw new Error(
      "usePageRenderContext must be used within a PageRenderProvider / PageRenderer.",
    );
  }
  return ctx;
}

export function useOptionalPageRenderContext(): PageRenderContextValue | null {
  return useContext(PageRenderContext);
}

export function useItemScopedRenderContext(overrides: {
  currentProductItem?: ProductCardData | null;
  currentCategoryItem?: Category | null;
}): PageRenderContextValue {
  const parent = usePageRenderContext();
  return useMemo(
    () => ({
      ...parent,
      ...(overrides.currentProductItem !== undefined
        ? { currentProductItem: overrides.currentProductItem }
        : {}),
      ...(overrides.currentCategoryItem !== undefined
        ? { currentCategoryItem: overrides.currentCategoryItem }
        : {}),
    }),
    [parent, overrides.currentProductItem, overrides.currentCategoryItem],
  );
}
