import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoreFooter, StoreHeader } from "@/components/store/StoreChrome";
import { ProductQuickPreviewModal } from "@/components/store/ProductQuickPreviewModal";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import {
  findNodeElementInStage,
  type ElementGeometryMeasurement,
} from "@/lib/visual-editor/geometry";
import { resolveHitTestTarget, type StudioSelectionSource } from "@/lib/visual-editor/interactions";
import { CanvasScrollProvider } from "@/lib/visual-editor/rendering/CanvasScrollContext";
import { PageRenderer } from "@/lib/visual-editor/rendering/PageRenderer";
import type {
  RenderMode,
  StorefrontDataCatalog,
} from "@/lib/visual-editor/rendering/RenderContext";
import type { PageDocument } from "@/lib/visual-editor/schema/page-document";
import type { EditorBreakpoint } from "@/lib/visual-editor/schema/responsive";
import { GLOBAL_CHROME_FOOTER_ID, GLOBAL_CHROME_HEADER_ID } from "@/lib/visual-editor/studio";
import { StudioSelectionOverlay } from "./StudioSelectionOverlay";

export interface StudioCanvasProps {
  document: PageDocument;
  home: HomeData;
  categories: readonly Category[];
  settings: Settings | null;
  renderMode: Extract<RenderMode, "editor" | "preview">;
  breakpoint: EditorBreakpoint;
  viewportWidthPx: number;
  zoomScale: number;
  selectedNodeId: string | null;
  selectedLabel: string | null;
  selectedType: string | null;
  selectedLocked?: boolean;
  selectedIsRuntimeInstance?: boolean;
  hoveredNodeId: string | null;
  hoveredLabel: string | null;
  showRulers?: boolean;
  scrollRequestNodeId: { nodeId: string; seq: number } | null;
  onSelectNode: (nodeId: string | null, source?: StudioSelectionSource) => void;
  onHoverNode: (nodeId: string | null) => void;
  onSelectedGeometryChange?: (measurement: ElementGeometryMeasurement | null) => void;
  onAvailableContainerWidthChange?: (widthPx: number) => void;
}

const RULER_TICKS = [0, 200, 390, 640, 768, 1024, 1280, 1440, 1600, 1920] as const;

export function StudioCanvas({
  document,
  home,
  categories,
  settings,
  renderMode,
  breakpoint,
  viewportWidthPx,
  zoomScale,
  selectedNodeId,
  selectedLabel,
  selectedType,
  selectedLocked = false,
  selectedIsRuntimeInstance = false,
  hoveredNodeId,
  hoveredLabel,
  showRulers = true,
  scrollRequestNodeId,
  onSelectNode,
  onHoverNode,
  onSelectedGeometryChange,
  onAvailableContainerWidthChange,
}: StudioCanvasProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [unscaledStageHeight, setUnscaledStageHeight] = useState<number>(1200);
  const [quickPreviewProduct, setQuickPreviewProduct] = useState<ProductCardData | null>(null);

  const hoverRafRef = useRef<number | null>(null);
  const lastHoverTargetRef = useRef<string | null>(hoveredNodeId);
  lastHoverTargetRef.current = hoveredNodeId;

  const handleRenderedNodeSelect = useCallback(
    (id: string) => onSelectNode(id, "canvas_click"),
    [onSelectNode],
  );
  const dataCatalog = useMemo<StorefrontDataCatalog>(
    () => ({
      featuredProducts: home.featured,
      newestProducts: home.newest,
      festivalProducts: home.festival,
      allProducts: home.allProducts,
      categories,
      settings,
    }),
    [home, categories, settings],
  );

  const canvasScrollValue = useMemo(
    () => ({
      scrollContainerRef,
      isIsolatedStudioCanvas: true,
    }),
    [],
  );

  // Measure outer scroll container width for Fit-to-Workspace zoom and stage height for scaled scroll container
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const stageEl = stageRef.current;
    if (!scrollEl || !stageEl) return;

    const updateMeasurements = () => {
      if (scrollEl.clientWidth > 0) {
        onAvailableContainerWidthChange?.(scrollEl.clientWidth);
      }
      if (stageEl.scrollHeight > 0) {
        setUnscaledStageHeight(stageEl.scrollHeight);
      }
    };

    updateMeasurements();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateMeasurements();
      });
      ro.observe(scrollEl);
      ro.observe(stageEl);
    }

    window.addEventListener("resize", updateMeasurements, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [onAvailableContainerWidthChange, viewportWidthPx, document]);

  // Smooth scroll to selected element (both EditorNode and runtime instances) when triggered from Layer Tree or Breadcrumb
  useEffect(() => {
    if (!scrollRequestNodeId || !stageRef.current) return;
    const targetEl = findNodeElementInStage(stageRef.current, scrollRequestNodeId.nodeId);
    if (targetEl && typeof targetEl.scrollIntoView === "function") {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [scrollRequestNodeId]);

  useEffect(() => {
    return () => {
      if (
        hoverRafRef.current !== null &&
        typeof window !== "undefined" &&
        window.cancelAnimationFrame
      ) {
        window.cancelAnimationFrame(hoverRafRef.current);
      }
    };
  }, []);

  const hasExplicitHeader = document.root.some((n) => n.type === "StoreHeader");
  const hasExplicitFooter = document.root.some((n) => n.type === "StoreFooter");

  /**
   * Centralized capture-phase click interception on `stageRef` (Prompt 10, Part 4, Sections 9–11 & Part 12, Sections 34–35).
   * - Intercepts clicks BEFORE any child `<a>`, `<button>`, `ProductCard`, or `BuyButton` can navigate or log outbound clicks.
   * - Resolves the most specific eligible registered node or runtime instance via `resolveHitTestTarget`.
   * - Supports container-first vs. drill-down selection (`Alt`/`Cmd`/`Ctrl` or clicking inside an already-selected container)
   *   and `Alt+Click` ancestor cycling.
   */
  const handleStageClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const stageEl = stageRef.current;
      const target = e.target as Element | null;
      if (!stageEl || !target) return;

      if (renderMode === "editor") {
        e.preventDefault();
        e.stopPropagation();

        const drillDownModifier = Boolean(e.altKey || e.metaKey || e.ctrlKey || e.detail >= 2);
        const hit = resolveHitTestTarget(target, {
          document,
          stageEl,
          currentSelectedId: selectedNodeId,
          drillDownModifier,
          cycleAncestorOnRepeatClick: Boolean(e.altKey),
          mode: "select",
        });

        onSelectNode(hit.targetId, "canvas_click");
        return;
      }

      // In Customer Preview Mode, block external affiliate redirects and route navigation links
      // while allowing safe in-canvas interactions (such as quick preview modal triggers)
      const anchorOrSubmit = target.closest?.("a, button[type='submit']");
      if (anchorOrSubmit) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [renderMode, document, selectedNodeId, onSelectNode],
  );

  /**
   * Centralized rAF-batched pointer hover controller on `stageRef` (Prompt 10, Part 10, Sections 28–30).
   */
  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
      if (renderMode !== "editor") return;
      const stageEl = stageRef.current;
      const target = e.target as Element | null;
      if (!stageEl || !target) return;

      const drillDownModifier = Boolean(e.altKey || e.metaKey || e.ctrlKey);

      const applyHover = () => {
        hoverRafRef.current = null;
        if (!stageRef.current) return;
        const hit = resolveHitTestTarget(target, {
          document,
          stageEl: stageRef.current,
          currentSelectedId: selectedNodeId,
          drillDownModifier,
          mode: "hover",
        });

        if (hit.targetId !== lastHoverTargetRef.current) {
          lastHoverTargetRef.current = hit.targetId;
          onHoverNode(hit.targetId);
        }
      };

      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        if (hoverRafRef.current !== null) {
          window.cancelAnimationFrame(hoverRafRef.current);
        }
        hoverRafRef.current = window.requestAnimationFrame(applyHover);
      } else {
        applyHover();
      }
    },
    [renderMode, document, selectedNodeId, onHoverNode],
  );

  const handleStageMouseLeave = useCallback(() => {
    if (
      hoverRafRef.current !== null &&
      typeof window !== "undefined" &&
      window.cancelAnimationFrame
    ) {
      window.cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    if (lastHoverTargetRef.current !== null) {
      lastHoverTargetRef.current = null;
      onHoverNode(null);
    }
  }, [onHoverNode]);

  const scaledHeightPx = Math.max(640, Math.round(unscaledStageHeight * zoomScale));
  const scaledWidthPx = Math.round(viewportWidthPx * zoomScale);

  return (
    <div
      ref={scrollContainerRef}
      data-testid="studio-canvas-scroll-container"
      onClick={(e) => {
        if (e.target === e.currentTarget && renderMode === "editor") {
          onSelectNode(null, "canvas_click");
        }
      }}
      className="relative flex-1 overflow-auto bg-[#070913] p-4 sm:p-6"
    >
      <div className="mx-auto flex flex-col items-center">
        {/* Optional Canvas Width Ruler Foundation (Part 5, Section 10) */}
        {showRulers && (
          <div
            data-testid="studio-canvas-ruler"
            style={{ width: `${scaledWidthPx}px` }}
            className="mb-2 flex h-5 items-center justify-between overflow-hidden rounded border border-border/60 bg-card/80 px-2 font-mono text-[10px] tabular-nums text-muted-foreground select-none"
          >
            <span>0px</span>
            <div className="flex items-center gap-3 overflow-hidden">
              {RULER_TICKS.filter((t) => t > 0 && t < viewportWidthPx).map((tick) => (
                <span key={tick} className="hidden sm:inline opacity-65">
                  {tick}px
                </span>
              ))}
            </div>
            <span className="font-semibold text-foreground">{viewportWidthPx}px</span>
          </div>
        )}

        {/* Scaled Layout Footprint Wrapper */}
        <div
          data-testid="studio-canvas-scale-footprint"
          style={{
            width: `${scaledWidthPx}px`,
            height: `${scaledHeightPx}px`,
          }}
          className="relative transition-[width] duration-150 ease-out motion-reduce:transition-none"
        >
          {/* Actual Storefront Page Viewport Stage */}
          <div
            ref={stageRef}
            data-testid="studio-canvas-stage"
            data-studio-viewport-width={viewportWidthPx}
            data-studio-breakpoint={breakpoint}
            data-studio-zoom-scale={zoomScale}
            data-studio-render-mode={renderMode}
            onClickCapture={handleStageClickCapture}
            onPointerMove={renderMode === "editor" ? handleStagePointerMove : undefined}
            onMouseOver={renderMode === "editor" ? handleStagePointerMove : undefined}
            onMouseLeave={renderMode === "editor" ? handleStageMouseLeave : undefined}
            style={{
              width: `${viewportWidthPx}px`,
              transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
              transformOrigin: "top left",
            }}
            className="cosmic-store relative flex min-h-[760px] flex-col rounded-lg border border-border/80 bg-background text-foreground shadow-2xl"
          >
            <CanvasScrollProvider value={canvasScrollValue}>
              {/* Shared Store Header (Part 14, Section 35 — never duplicated) */}
              {!hasExplicitHeader && (
                <div
                  data-editor-node-id={
                    renderMode === "editor" ? GLOBAL_CHROME_HEADER_ID : undefined
                  }
                  data-editor-node-type={renderMode === "editor" ? "StoreHeader" : undefined}
                  data-editor-locked={renderMode === "editor" ? "true" : undefined}
                >
                  <StoreHeader />
                </div>
              )}

              {/* Real Shared PageRenderer Canvas */}
              <main className="relative flex-1">
                <PageRenderer
                  document={document}
                  mode={renderMode}
                  breakpoint={breakpoint}
                  dataCatalog={dataCatalog}
                  renderGlobalChromeInDocument={hasExplicitHeader || hasExplicitFooter}
                  selectedNodeId={selectedNodeId}
                  hoveredNodeId={hoveredNodeId}
                  onSelectNode={handleRenderedNodeSelect}
                  onHoverNode={onHoverNode}
                  onQuickPreviewProduct={
                    renderMode === "preview" ? setQuickPreviewProduct : undefined
                  }
                />
              </main>

              {/* Shared Store Footer (Part 14, Section 35 — never duplicated) */}
              {!hasExplicitFooter && (
                <div
                  data-editor-node-id={
                    renderMode === "editor" ? GLOBAL_CHROME_FOOTER_ID : undefined
                  }
                  data-editor-node-type={renderMode === "editor" ? "StoreFooter" : undefined}
                  data-editor-locked={renderMode === "editor" ? "true" : undefined}
                >
                  <StoreFooter />
                </div>
              )}
            </CanvasScrollProvider>

            {/* Non-layout-affecting Selection & Hover Overlays (Edit Mode Only) */}
            <StudioSelectionOverlay
              stageRef={stageRef}
              scrollContainerRef={scrollContainerRef}
              selectedNodeId={selectedNodeId}
              selectedLabel={selectedLabel}
              selectedType={selectedType}
              selectedLocked={selectedLocked}
              selectedIsRuntimeInstance={selectedIsRuntimeInstance}
              hoveredNodeId={hoveredNodeId}
              hoveredLabel={hoveredLabel}
              zoomScale={zoomScale}
              viewportWidthPx={viewportWidthPx}
              enabled={renderMode === "editor"}
              onSelectedGeometryChange={onSelectedGeometryChange}
            />
          </div>
        </div>
      </div>

      {/* Customer Preview Mode Quick Preview Modal */}
      {renderMode === "preview" && quickPreviewProduct && (
        <ProductQuickPreviewModal
          product={quickPreviewProduct}
          onClose={() => setQuickPreviewProduct(null)}
        />
      )}
    </div>
  );
}
