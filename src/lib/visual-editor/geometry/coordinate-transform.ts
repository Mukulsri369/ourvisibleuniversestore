import type {
  CanvasLocalRect,
  ClippingState,
  DocumentRect,
  ElementGeometryMeasurement,
  OverlayRect,
  ViewportRect,
} from "./geometry-types";

export function normalizeScale(zoomScale: number): number {
  return Number.isFinite(zoomScale) && zoomScale > 0 ? zoomScale : 1;
}

export function toViewportRect(rect: {
  top: number;
  left: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
}): ViewportRect {
  const top = Number.isFinite(rect.top) ? rect.top : 0;
  const left = Number.isFinite(rect.left) ? rect.left : 0;
  const width = Number.isFinite(rect.width) ? Math.max(0, rect.width) : 0;
  const height = Number.isFinite(rect.height) ? Math.max(0, rect.height) : 0;
  return {
    top,
    left,
    width,
    height,
    right: rect.right !== undefined && Number.isFinite(rect.right) ? rect.right : left + width,
    bottom: rect.bottom !== undefined && Number.isFinite(rect.bottom) ? rect.bottom : top + height,
  };
}

/**
 * Computes the union bounding box across one or more DOM fragment rectangles
 * (Prompt 10, Part 8, Section 25).
 */
export function computeUnionViewportRect(rects: readonly ViewportRect[]): ViewportRect | null {
  const nonEmpty = rects.filter((r) => r.width > 0 || r.height > 0);
  if (nonEmpty.length === 0) {
    return rects[0] ?? null;
  }

  let minTop = Infinity;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (const r of nonEmpty) {
    if (r.top < minTop) minTop = r.top;
    if (r.left < minLeft) minLeft = r.left;
    if (r.right > maxRight) maxRight = r.right;
    if (r.bottom > maxBottom) maxBottom = r.bottom;
  }

  const width = Math.max(0, maxRight - minLeft);
  const height = Math.max(0, maxBottom - minTop);

  return {
    top: minTop,
    left: minLeft,
    right: maxRight,
    bottom: maxBottom,
    width,
    height,
  };
}

/**
 * Converts a browser `ViewportRect` into unscaled `CanvasLocalRect` relative to the canvas stage.
 * Properly divides by `zoomScale` so a 1440px stage rendered at 50% zoom (`0.5`) yields
 * `width = 1440` in canvas-local coordinates.
 */
export function viewportRectToCanvasLocalRect(
  targetViewportRect: ViewportRect,
  stageViewportRect: ViewportRect,
  zoomScale: number,
): CanvasLocalRect {
  const scale = normalizeScale(zoomScale);
  const top = (targetViewportRect.top - stageViewportRect.top) / scale;
  const left = (targetViewportRect.left - stageViewportRect.left) / scale;
  const width = targetViewportRect.width / scale;
  const height = targetViewportRect.height / scale;

  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

/**
 * Converts a `ViewportRect` into scroll-container document coordinates.
 */
export function viewportRectToDocumentRect(
  targetViewportRect: ViewportRect,
  scrollContainerViewportRect: ViewportRect | null,
  scrollLeft = 0,
  scrollTop = 0,
): DocumentRect {
  if (!scrollContainerViewportRect) {
    return {
      top: targetViewportRect.top + scrollTop,
      left: targetViewportRect.left + scrollLeft,
      right: targetViewportRect.right + scrollLeft,
      bottom: targetViewportRect.bottom + scrollTop,
      width: targetViewportRect.width,
      height: targetViewportRect.height,
    };
  }

  const top = targetViewportRect.top - scrollContainerViewportRect.top + scrollTop;
  const left = targetViewportRect.left - scrollContainerViewportRect.left + scrollLeft;

  return {
    top,
    left,
    right: left + targetViewportRect.width,
    bottom: top + targetViewportRect.height,
    width: targetViewportRect.width,
    height: targetViewportRect.height,
  };
}

/**
 * Intersects two rectangles in viewport space.
 */
export function intersectViewportRects(a: ViewportRect, b: ViewportRect): ViewportRect | null {
  const top = Math.max(a.top, b.top);
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    top,
    left,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Computes clipping and offscreen status against the stage, scroll container,
 * and any intermediate overflow/carousel containers (Prompt 10, Part 8, Section 24).
 */
export function computeClippingState(
  targetViewportRect: ViewportRect,
  stageViewportRect: ViewportRect,
  clippingViewportRects: readonly ViewportRect[],
  zoomScale: number,
): { clipping: ClippingState; visibleCanvasRect: CanvasLocalRect | null } {
  const totalArea = targetViewportRect.width * targetViewportRect.height;
  if (totalArea <= 0) {
    return {
      clipping: {
        isClipped: false,
        clippedTop: false,
        clippedRight: false,
        clippedBottom: false,
        clippedLeft: false,
        isOffscreen: true,
        visibleRatio: 0,
      },
      visibleCanvasRect: null,
    };
  }

  let currentVisible: ViewportRect | null = targetViewportRect;
  let clippedTop = false;
  let clippedRight = false;
  let clippedBottom = false;
  let clippedLeft = false;
  const EPS = 0.75;

  for (const clipRect of clippingViewportRects) {
    if (clipRect.width <= 0 && clipRect.height <= 0) continue;

    if (targetViewportRect.top < clipRect.top - EPS) clippedTop = true;
    if (targetViewportRect.right > clipRect.right + EPS) clippedRight = true;
    if (targetViewportRect.bottom > clipRect.bottom + EPS) clippedBottom = true;
    if (targetViewportRect.left < clipRect.left - EPS) clippedLeft = true;

    if (currentVisible) {
      currentVisible = intersectViewportRects(currentVisible, clipRect);
    }
  }

  const isClipped = clippedTop || clippedRight || clippedBottom || clippedLeft;

  if (!currentVisible) {
    return {
      clipping: {
        isClipped: true,
        clippedTop,
        clippedRight,
        clippedBottom,
        clippedLeft,
        isOffscreen: true,
        visibleRatio: 0,
      },
      visibleCanvasRect: null,
    };
  }

  const visibleArea = currentVisible.width * currentVisible.height;
  const visibleRatio = Math.max(0, Math.min(1, visibleArea / totalArea));
  const visibleCanvasRect = viewportRectToCanvasLocalRect(
    currentVisible,
    stageViewportRect,
    zoomScale,
  );

  return {
    clipping: {
      isClipped,
      clippedTop,
      clippedRight,
      clippedBottom,
      clippedLeft,
      isOffscreen: visibleRatio <= 0.01,
      visibleRatio,
    },
    visibleCanvasRect,
  };
}

/**
 * Converts `CanvasLocalRect` into `OverlayRect`.
 */
export function toOverlayRect(
  canvasLocalRect: CanvasLocalRect,
  visibleCanvasRect: CanvasLocalRect | null,
): OverlayRect {
  return {
    top: canvasLocalRect.top,
    left: canvasLocalRect.left,
    width: canvasLocalRect.width,
    height: canvasLocalRect.height,
    visibleRect: visibleCanvasRect,
  };
}

/**
 * Fast equality comparison for `ElementGeometryMeasurement` to prevent redundant React state updates
 * when subpixel values have not meaningfully changed.
 */
export function areGeometryMeasurementsEqual(
  a: ElementGeometryMeasurement | null,
  b: ElementGeometryMeasurement | null,
  epsilonPx = 0.25,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.targetId !== b.targetId ||
    a.nodeId !== b.nodeId ||
    a.instanceId !== b.instanceId ||
    a.isValid !== b.isValid ||
    a.visibilityStatus !== b.visibilityStatus ||
    a.canvasScale !== b.canvasScale ||
    a.clipping.isClipped !== b.clipping.isClipped ||
    a.clipping.isOffscreen !== b.clipping.isOffscreen
  ) {
    return false;
  }

  return (
    Math.abs(a.canvasLocalRect.top - b.canvasLocalRect.top) <= epsilonPx &&
    Math.abs(a.canvasLocalRect.left - b.canvasLocalRect.left) <= epsilonPx &&
    Math.abs(a.canvasLocalRect.width - b.canvasLocalRect.width) <= epsilonPx &&
    Math.abs(a.canvasLocalRect.height - b.canvasLocalRect.height) <= epsilonPx
  );
}
