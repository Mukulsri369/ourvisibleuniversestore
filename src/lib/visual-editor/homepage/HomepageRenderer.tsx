import React, { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  shuffleArray,
  type Category,
  type HomeData,
  type ProductCardData,
  type Settings,
} from "@/lib/store";
import type { PageDocument } from "../schema/page-document";
import type { EditorBreakpoint, NodeStyleBundle } from "../schema/responsive";
import { PageRenderer } from "../rendering/PageRenderer";
import type { RenderMode, StorefrontDataCatalog } from "../rendering/RenderContext";
import {
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
  resolveValidatedHomepageDocument,
} from "./default-homepage-document";
import { LegacyHomepageView } from "./LegacyHomepageRenderer";

/**
 * Controlled migration feature flag (Part 9, Section 27).
 * - Defaults to `true` after parity & functional verification.
 * - Can be overridden via `forceLegacyFallback` prop or toggled to `false` for instant rollback.
 */
export const HOMEPAGE_SHARED_RENDERER_ENABLED = true;

interface HomepageErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface HomepageErrorBoundaryState {
  hasError: boolean;
}

class HomepageRenderErrorBoundary extends Component<
  HomepageErrorBoundaryProps,
  HomepageErrorBoundaryState
> {
  state: HomepageErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HomepageErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export interface HomepageRendererProps {
  home: HomeData;
  categories: Category[];
  settings: Settings | null;
  /**
   * Optional custom `PageDocument`. When omitted, uses `DEFAULT_HOMEPAGE_PAGE_DOCUMENT`.
   * If an invalid custom document is passed, automatically falls back to `DEFAULT_HOMEPAGE_PAGE_DOCUMENT`.
   */
  document?: PageDocument | unknown | null;
  mode?: RenderMode;
  breakpoint?: EditorBreakpoint;
  cardTemplates?: Readonly<Record<string, NodeStyleBundle>>;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  onHoverNode?: (nodeId: string | null) => void;
  onQuickPreviewProduct?: (product: ProductCardData) => void;
  /**
   * When `true`, bypasses `PageRenderer` and renders `LegacyHomepageView` directly.
   */
  forceLegacyFallback?: boolean;
  /**
   * When `true` (e.g. in deterministic parity tests or editor mode), preserves `home` arrays
   * without running client-side `shuffleArray` in `useEffect`.
   */
  disableClientShuffle?: boolean;
}

/**
 * Production homepage renderer bridging TanStack Query data (`home`, `categories`, `settings`)
 * into the shared `PageRenderer` + `VisualComponentRegistry` architecture.
 */
export function HomepageRenderer({
  home,
  categories,
  settings,
  document = DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
  mode = "public",
  breakpoint = "desktop",
  cardTemplates,
  selectedNodeId = null,
  hoveredNodeId = null,
  onSelectNode,
  onHoverNode,
  onQuickPreviewProduct,
  forceLegacyFallback = false,
  disableClientShuffle = false,
}: HomepageRendererProps) {
  // Stable initial state matching server-rendered HTML to prevent hydration mismatch
  const [shuffledData, setShuffledData] = useState<HomeData>(() => home);

  // Fresh product shuffle generated on every store visit / app load (runs client-side only after hydration)
  useEffect(() => {
    if (disableClientShuffle || mode !== "public") {
      setShuffledData(home);
      return;
    }
    setShuffledData({
      featured: shuffleArray(home.featured),
      newest: shuffleArray(home.newest),
      festival: shuffleArray(home.festival),
      allProducts: shuffleArray(home.allProducts),
    });
  }, [home, disableClientShuffle, mode]);

  // Validate document once per document reference change (never inside per-node or scroll hot paths)
  const resolvedDocResult = useMemo(() => resolveValidatedHomepageDocument(document), [document]);

  const dataCatalog = useMemo<StorefrontDataCatalog>(
    () => ({
      featuredProducts: shuffledData.featured,
      newestProducts: shuffledData.newest,
      festivalProducts: shuffledData.festival,
      allProducts: shuffledData.allProducts,
      categories,
      settings,
    }),
    [shuffledData, categories, settings],
  );

  const legacyFallbackElement = (
    <LegacyHomepageView homeData={shuffledData} categories={categories} settings={settings} />
  );

  if (!HOMEPAGE_SHARED_RENDERER_ENABLED || forceLegacyFallback) {
    return legacyFallbackElement;
  }

  return (
    <HomepageRenderErrorBoundary fallback={legacyFallbackElement}>
      <div className="store-homepage relative">
        <PageRenderer
          document={resolvedDocResult.document}
          mode={mode}
          breakpoint={breakpoint}
          dataCatalog={dataCatalog}
          renderGlobalChromeInDocument={false}
          cardTemplates={cardTemplates}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          onSelectNode={onSelectNode}
          onHoverNode={onHoverNode}
          onQuickPreviewProduct={onQuickPreviewProduct}
        />
      </div>
    </HomepageRenderErrorBoundary>
  );
}
