import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "../homepage/default-homepage-document";
import {
  computeClippingState,
  computeSmartLabelPlacement,
  computeUnionViewportRect,
  extractConfiguredDesignGeometry,
  measureElementGeometry,
  toViewportRect,
  viewportRectToCanvasLocalRect,
  viewportRectToDocumentRect,
} from "../geometry/index";
import { resolveStudioViewportState } from "../studio/studio-viewport";

describe("Prompt 10 — Element Geometry Engine, Coordinate Spaces, Zoom/Viewport Math & Smart Label Placement", () => {
  it("accurately converts ViewportRect to CanvasLocalRect across all required viewport widths (360, 390, 768, 1024, 1440, 1920) and zoom levels (25%, 50%, 75%, 100%, Fit)", () => {
    const viewportWidths = [360, 390, 768, 1024, 1440, 1920] as const;
    const zoomPercents = [25, 50, 75, 100] as const;

    for (const widthPx of viewportWidths) {
      for (const zoomPercent of zoomPercents) {
        const vp = resolveStudioViewportState({
          devicePreset: "custom",
          viewportWidthPx: widthPx,
          zoomMode: "manual",
          zoomPercent,
        });

        const scale = vp.zoomScale;
        const stageViewportRect = toViewportRect({
          top: 80,
          left: 240,
          width: widthPx * scale,
          height: 900 * scale,
        });

        // Suppose a component sits at (top: 120, left: 24, width: widthPx - 48, height: 360) in unscaled canvas-local coordinates
        const expectedLocalTop = 120;
        const expectedLocalLeft = 24;
        const expectedLocalWidth = widthPx - 48;
        const expectedLocalHeight = 360;

        const targetViewportRect = toViewportRect({
          top: stageViewportRect.top + expectedLocalTop * scale,
          left: stageViewportRect.left + expectedLocalLeft * scale,
          width: expectedLocalWidth * scale,
          height: expectedLocalHeight * scale,
        });

        const localRect = viewportRectToCanvasLocalRect(
          targetViewportRect,
          stageViewportRect,
          scale,
        );

        expect(localRect.top).toBeCloseTo(expectedLocalTop, 4);
        expect(localRect.left).toBeCloseTo(expectedLocalLeft, 4);
        expect(localRect.width).toBeCloseTo(expectedLocalWidth, 4);
        expect(localRect.height).toBeCloseTo(expectedLocalHeight, 4);
      }
    }

    // Fit-to-workspace zoom check (1440px stage inside 900px container -> 59% zoom)
    const fitVp = resolveStudioViewportState({
      devicePreset: "desktop",
      viewportWidthPx: 1440,
      zoomMode: "fit",
      availableContainerWidthPx: 900,
    });
    expect(fitVp.breakpoint).toBe("desktop");
    expect(fitVp.zoomScale).toBeCloseTo(0.59, 2);
  });

  it("computes scroll-aware DocumentRect and detects partial clipping and offscreen states inside horizontal carousels and scroll containers", () => {
    const stageRect = toViewportRect({ top: 50, left: 100, width: 1440, height: 2400 });
    const scrollContainerRect = toViewportRect({ top: 50, left: 100, width: 1440, height: 800 });
    const carouselRect = toViewportRect({ top: 200, left: 140, width: 1200, height: 320 });

    // Card partially scrolled past the right edge of the horizontal carousel
    const partiallyClippedCard = toViewportRect({
      top: 210,
      left: 1180,
      width: 300,
      height: 280,
    });

    const docRect = viewportRectToDocumentRect(partiallyClippedCard, scrollContainerRect, 0, 400);
    expect(docRect.top).toBe(210 - 50 + 400);
    expect(docRect.left).toBe(1180 - 100);

    const { clipping, visibleCanvasRect } = computeClippingState(
      partiallyClippedCard,
      stageRect,
      [carouselRect, scrollContainerRect],
      1,
    );

    expect(clipping.isClipped).toBe(true);
    expect(clipping.clippedRight).toBe(true);
    expect(clipping.isOffscreen).toBe(false);
    expect(clipping.visibleRatio).toBeCloseTo(160 / 300, 2);
    expect(visibleCanvasRect?.width).toBe(160);

    // Card scrolled completely offscreen to the right of the carousel
    const offscreenCard = toViewportRect({
      top: 210,
      left: 1450,
      width: 300,
      height: 280,
    });
    const offscreenResult = computeClippingState(
      offscreenCard,
      stageRect,
      [carouselRect, scrollContainerRect],
      1,
    );
    expect(offscreenResult.clipping.isClipped).toBe(true);
    expect(offscreenResult.clipping.isOffscreen).toBe(true);
    expect(offscreenResult.visibleCanvasRect).toBeNull();
  });

  it("computes union bounding rectangles for multi-fragment DOM components and handles missing or hidden elements safely", () => {
    const union = computeUnionViewportRect([
      toViewportRect({ top: 100, left: 50, width: 200, height: 80 }),
      toViewportRect({ top: 190, left: 50, width: 400, height: 120 }),
    ]);
    expect(union).toEqual({
      top: 100,
      left: 50,
      right: 450,
      bottom: 310,
      width: 400,
      height: 210,
    });

    const stageEl = document.createElement("div");
    expect(measureElementGeometry(stageEl, null, "missing-node", 1)).toBeNull();

    const hiddenEl = document.createElement("div");
    hiddenEl.setAttribute("data-editor-node-id", "hidden-node");
    hiddenEl.style.display = "none";
    stageEl.appendChild(hiddenEl);
    expect(measureElementGeometry(stageEl, null, "hidden-node", 1)).toBeNull();
  });

  it("separates visual CSS-transformed DOM measurements from persistent configured design geometry", () => {
    const doc = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    const heroNode = doc.root.find((n) => n.id === CANONICAL_HOMEPAGE_NODE_IDS.planetHero)!;

    const configured = extractConfiguredDesignGeometry(heroNode, "desktop");
    expect(configured.width).toBe("auto");
    expect(configured.height).toBe("auto");
    expect(configured.aspectRatio).toBe("inherited");
    expect(configured.layoutMode).toBe("component_default");
  });

  it("computes edge-aware SmartLabelPlacement so selection badges and dimension pills never overflow the viewport", () => {
    const stageEl = document.createElement("div");
    stageEl.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 720,
        bottom: 500,
        width: 720,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const headerEl = document.createElement("header");
    headerEl.setAttribute("data-editor-node-id", "global-chrome::store-header");
    headerEl.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 720,
        bottom: 36,
        width: 720,
        height: 36,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    stageEl.appendChild(headerEl);

    // At 50% zoom (0.5), 720px viewport width = 1440px canvas-local width, 36px = 72px canvas-local height
    const measurement = measureElementGeometry(stageEl, null, "global-chrome::store-header", 0.5)!;
    expect(measurement.renderedWidthPx).toBe(1440);
    expect(measurement.renderedHeightPx).toBe(72);

    const placement = computeSmartLabelPlacement(measurement, 1440);
    // Because top === 0 (< 26px clearance) and height >= 52px, badge flips to inside_top!
    expect(placement.verticalPlacement).toBe("inside_top");
    expect(placement.offsetTopPx).toBeGreaterThanOrEqual(0);
  });
});
