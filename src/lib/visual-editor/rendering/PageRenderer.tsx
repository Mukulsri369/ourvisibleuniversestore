import React, { useMemo } from "react";
import type { Category, ProductCardData } from "@/lib/store";
import type { PageDocument } from "../schema/page-document";
import type { EditorNode } from "../schema/nodes";
import type { EditorBreakpoint, NodeStyleBundle } from "../schema/responsive";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import {
  EMPTY_STOREFRONT_DATA_CATALOG,
  INTERACTION_POLICIES,
  PageRenderProvider,
  type PageRenderContextValue,
  type RenderMode,
  type StorefrontDataCatalog,
} from "./RenderContext";
import { RenderNode } from "./RenderNode";

export interface PageRendererProps {
  document: PageDocument;
  mode?: RenderMode;
  breakpoint?: EditorBreakpoint;
  dataCatalog?: StorefrontDataCatalog;
  registry?: VisualComponentRegistry;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  /**
   * Defaults to `false` so when `PageRenderer` is mounted inside `src/routes/_store.tsx`
   * (which already renders `<StoreHeader />` and `<StoreFooter />`), global chrome nodes
   * inside the document are not rendered a second time.
   */
  renderGlobalChromeInDocument?: boolean;
  /**
   * Optional reusable card templates (e.g. `ProductCard`, `ProductCardCompact`, `CategoryCard`).
   */
  cardTemplates?: Readonly<Record<string, NodeStyleBundle>>;
  onSelectNode?: (nodeId: string) => void;
  onHoverNode?: (nodeId: string | null) => void;
  onQuickPreviewProduct?: (product: ProductCardData) => void;
}

export function PageRenderer({
  document,
  mode = "public",
  breakpoint = "desktop",
  dataCatalog = EMPTY_STOREFRONT_DATA_CATALOG,
  registry = defaultComponentRegistry,
  selectedNodeId = null,
  hoveredNodeId = null,
  renderGlobalChromeInDocument = false,
  cardTemplates = {},
  onSelectNode,
  onHoverNode,
  onQuickPreviewProduct,
}: PageRendererProps) {
  const interactionPolicy = INTERACTION_POLICIES[mode];

  const contextValue = useMemo<PageRenderContextValue>(
    () => ({
      mode,
      breakpoint,
      interactionPolicy,
      dataCatalog,
      registry,
      selectedNodeId,
      hoveredNodeId,
      renderGlobalChromeInDocument,
      renderGlobalBackgroundInFlow: false,
      cardTemplates,
      onSelectNode,
      onHoverNode,
      onQuickPreviewProduct,
    }),
    [
      mode,
      breakpoint,
      interactionPolicy,
      dataCatalog,
      registry,
      selectedNodeId,
      hoveredNodeId,
      renderGlobalChromeInDocument,
      cardTemplates,
      onSelectNode,
      onHoverNode,
      onQuickPreviewProduct,
    ],
  );

  // Separate fixed global background layers (CelestialScrollWorld) from normal flow sections
  // so CelestialScrollWorld is never trapped inside an overflow-clipping container.
  const celestialWorldEnabled = document.settings?.celestialWorldEnabled !== false;
  const globalBackgroundNodes: EditorNode[] = [];
  const flowRootNodes: EditorNode[] = [];

  for (const rootNode of document.root) {
    if (rootNode.type === "CelestialScrollWorld") {
      if (celestialWorldEnabled) {
        globalBackgroundNodes.push(rootNode);
      }
    } else {
      flowRootNodes.push(rootNode);
    }
  }

  return (
    <PageRenderProvider value={contextValue}>
      {globalBackgroundNodes.map((bgNode) => (
        <RenderNode key={bgNode.id} node={bgNode} />
      ))}
      {flowRootNodes.map((node) => (
        <RenderNode key={node.id} node={node} />
      ))}
    </PageRenderProvider>
  );
}

export interface MiniComponentPreviewRendererProps {
  node: EditorNode;
  breakpoint?: EditorBreakpoint;
  dataCatalog?: StorefrontDataCatalog;
  registry?: VisualComponentRegistry;
  cardTemplates?: Readonly<Record<string, NodeStyleBundle>>;
  sampleProduct?: ProductCardData | null;
  sampleCategory?: Category | null;
}

/**
 * Reusable miniature preview renderer for the future properties inspector (Part 11).
 * Uses the exact same `VisualComponentRegistry` and real component adapters as `PageRenderer`
 * in `"mini_preview"` mode (never a separate fake DOM implementation).
 */
export function MiniComponentPreviewRenderer({
  node,
  breakpoint = "desktop",
  dataCatalog = EMPTY_STOREFRONT_DATA_CATALOG,
  registry = defaultComponentRegistry,
  cardTemplates = {},
  sampleProduct = null,
  sampleCategory = null,
}: MiniComponentPreviewRendererProps) {
  const interactionPolicy = INTERACTION_POLICIES.mini_preview;

  const contextValue = useMemo<PageRenderContextValue>(
    () => ({
      mode: "mini_preview",
      breakpoint,
      interactionPolicy,
      dataCatalog,
      registry,
      selectedNodeId: null,
      hoveredNodeId: null,
      renderGlobalChromeInDocument: true,
      renderGlobalBackgroundInFlow: true,
      cardTemplates,
      currentProductItem: sampleProduct,
      currentCategoryItem: sampleCategory,
    }),
    [
      breakpoint,
      interactionPolicy,
      dataCatalog,
      registry,
      cardTemplates,
      sampleProduct,
      sampleCategory,
    ],
  );

  return (
    <PageRenderProvider value={contextValue}>
      <div
        data-mini-preview-container="true"
        data-mini-preview-node-type={node.type}
        className="relative overflow-hidden"
      >
        <RenderNode node={node} />
      </div>
    </PageRenderProvider>
  );
}
