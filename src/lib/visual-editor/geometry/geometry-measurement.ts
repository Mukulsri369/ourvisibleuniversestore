import { resolveResponsiveNodePresentation } from "../rendering/responsive-styles";
import type { EditorNode } from "../schema/nodes";
import type { EditorBreakpoint } from "../schema/responsive";
import {
  computeClippingState,
  computeUnionViewportRect,
  normalizeScale,
  toOverlayRect,
  toViewportRect,
  viewportRectToCanvasLocalRect,
  viewportRectToDocumentRect,
} from "./coordinate-transform";
import type {
  ConfiguredDesignGeometry,
  ElementGeometryMeasurement,
  ViewportRect,
} from "./geometry-types";

function escapeCssSelectorValue(raw: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(raw);
  }
  return raw.replace(/"/g, '\\"');
}

/**
 * Finds all DOM elements inside `stageEl` matching either `data-editor-node-id` or
 * `data-editor-instance-id` for `targetId`. Supports multi-fragment components (Part 8, Section 25).
 */
export function findTargetElementsInStage(
  stageEl: HTMLElement | null | undefined,
  targetId: string | null | undefined,
): HTMLElement[] {
  if (!stageEl || !targetId) return [];
  const escaped = escapeCssSelectorValue(targetId);

  const byNodeId = Array.from(
    stageEl.querySelectorAll<HTMLElement>(`[data-editor-node-id="${escaped}"]`),
  );
  if (byNodeId.length > 0) {
    return byNodeId;
  }

  const byInstanceId = Array.from(
    stageEl.querySelectorAll<HTMLElement>(`[data-editor-instance-id="${escaped}"]`),
  );
  return byInstanceId;
}

/**
 * Convenience single-element resolver returning the primary DOM element for `targetId`.
 */
export function findNodeElementInStage(
  stageEl: HTMLElement | null | undefined,
  targetId: string | null | undefined,
): HTMLElement | null {
  const matches = findTargetElementsInStage(stageEl, targetId);
  return matches[0] ?? null;
}

function collectScrollableClippingAncestors(
  element: HTMLElement,
  stageEl: HTMLElement,
  scrollContainerEl: HTMLElement | null,
): ViewportRect[] {
  const rects: ViewportRect[] = [];
  let curr: HTMLElement | null = element.parentElement;

  while (curr && curr !== stageEl && curr !== scrollContainerEl) {
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      const style = window.getComputedStyle(curr);
      const overflowX = style.overflowX;
      const overflowY = style.overflowY;
      const isClippingOverflow =
        overflowX === "auto" ||
        overflowX === "scroll" ||
        overflowX === "hidden" ||
        overflowX === "clip" ||
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "hidden" ||
        overflowY === "clip";

      if (isClippingOverflow) {
        const r = curr.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          rects.push(toViewportRect(r));
        }
      }
    }
    curr = curr.parentElement;
  }

  if (scrollContainerEl) {
    const scrollRect = scrollContainerEl.getBoundingClientRect();
    if (scrollRect.width > 0 && scrollRect.height > 0) {
      rects.push(toViewportRect(scrollRect));
    }
  }

  return rects;
}

function detectElementCssTransform(element: HTMLElement): boolean {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return false;
  }
  const style = window.getComputedStyle(element);
  return Boolean(style.transform && style.transform !== "none");
}

function splitTargetIdentity(targetId: string): { nodeId: string; instanceId: string | null } {
  for (const delimiter of ["::product::", "::category::", "::category-card::"]) {
    const idx = targetId.indexOf(delimiter);
    if (idx > 0) {
      return {
        nodeId: targetId.slice(0, idx),
        instanceId: targetId,
      };
    }
  }
  return {
    nodeId: targetId,
    instanceId: null,
  };
}

/**
 * Measures the exact visual DOM geometry of `targetId` inside `stageEl` across zoom, scroll,
 * multi-fragment boundaries, and overflow clipping containers (Prompt 10, Part 7, Sections 18–21).
 */
export function measureElementGeometry(
  stageEl: HTMLElement | null | undefined,
  scrollContainerEl: HTMLElement | null | undefined,
  targetId: string | null | undefined,
  zoomScale: number,
): ElementGeometryMeasurement | null {
  if (!stageEl || !targetId) return null;

  const elements = findTargetElementsInStage(stageEl, targetId);
  if (elements.length === 0) return null;

  const primaryEl = elements[0];
  const scale = normalizeScale(zoomScale);
  const stageViewportRect = toViewportRect(stageEl.getBoundingClientRect());
  const scrollContainerViewportRect = scrollContainerEl
    ? toViewportRect(scrollContainerEl.getBoundingClientRect())
    : null;
  const scrollLeft = scrollContainerEl?.scrollLeft ?? 0;
  const scrollTop = scrollContainerEl?.scrollTop ?? 0;
  const { nodeId, instanceId } = splitTargetIdentity(targetId);

  // Check if element is explicitly hidden via CSS display: none or visibility: hidden
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const computed = window.getComputedStyle(primaryEl);
    if (computed.display === "none" || computed.visibility === "hidden") {
      return null;
    }
  }

  // Collect bounding rects across all matched DOM fragments
  const fragmentRects: ViewportRect[] = [];
  for (const el of elements) {
    const r = toViewportRect(el.getBoundingClientRect());
    if (r.width > 0 || r.height > 0) {
      fragmentRects.push(r);
    } else if (el.firstElementChild instanceof HTMLElement) {
      const childRect = toViewportRect(el.firstElementChild.getBoundingClientRect());
      if (childRect.width > 0 || childRect.height > 0) {
        fragmentRects.push(childRect);
      }
    }
  }

  // Special handling for global fixed/sticky CelestialScrollWorld background layer (Part 17, Section 50)
  if (
    fragmentRects.length === 0 &&
    (primaryEl.getAttribute("data-editor-global-layer") === "celestial-scroll-world" ||
      primaryEl.querySelector('[data-editor-global-layer="celestial-scroll-world"]') !== null)
  ) {
    const fallbackWidth = stageEl.clientWidth || stageViewportRect.width / scale || 1440;
    const fallbackHeight = Math.min(720, stageEl.clientHeight || 720);
    const canvasLocalRect = {
      top: 0,
      left: 0,
      right: fallbackWidth,
      bottom: fallbackHeight,
      width: fallbackWidth,
      height: fallbackHeight,
    };
    const viewportRect: ViewportRect = {
      top: stageViewportRect.top,
      left: stageViewportRect.left,
      right: stageViewportRect.left + fallbackWidth * scale,
      bottom: stageViewportRect.top + fallbackHeight * scale,
      width: fallbackWidth * scale,
      height: fallbackHeight * scale,
    };
    return {
      targetId,
      nodeId,
      instanceId,
      viewportRect,
      canvasLocalRect,
      documentRect: viewportRectToDocumentRect(
        viewportRect,
        scrollContainerViewportRect,
        scrollLeft,
        scrollTop,
      ),
      overlayRect: toOverlayRect(canvasLocalRect, canvasLocalRect),
      renderedWidthPx: Math.round(fallbackWidth),
      renderedHeightPx: Math.round(fallbackHeight),
      canvasScale: scale,
      hasCssTransform: false,
      visibilityStatus: "visible",
      clipping: {
        isClipped: false,
        clippedTop: false,
        clippedRight: false,
        clippedBottom: false,
        clippedLeft: false,
        isOffscreen: false,
        visibleRatio: 1,
      },
      fragmentCount: elements.length,
      isValid: true,
      measuredAt: Date.now(),
    };
  }

  const unionViewportRect = computeUnionViewportRect(fragmentRects);
  if (!unionViewportRect || (unionViewportRect.width === 0 && unionViewportRect.height === 0)) {
    return null;
  }

  const canvasLocalRect = viewportRectToCanvasLocalRect(
    unionViewportRect,
    stageViewportRect,
    scale,
  );
  const documentRect = viewportRectToDocumentRect(
    unionViewportRect,
    scrollContainerViewportRect,
    scrollLeft,
    scrollTop,
  );

  const clippingAncestors = collectScrollableClippingAncestors(
    primaryEl,
    stageEl,
    scrollContainerEl ?? null,
  );
  const { clipping, visibleCanvasRect } = computeClippingState(
    unionViewportRect,
    stageViewportRect,
    clippingAncestors,
    scale,
  );

  return {
    targetId,
    nodeId,
    instanceId,
    viewportRect: unionViewportRect,
    canvasLocalRect,
    documentRect,
    overlayRect: toOverlayRect(canvasLocalRect, visibleCanvasRect),
    renderedWidthPx: Math.round(canvasLocalRect.width),
    renderedHeightPx: Math.round(canvasLocalRect.height),
    canvasScale: scale,
    hasCssTransform: detectElementCssTransform(primaryEl),
    visibilityStatus: "visible",
    clipping,
    fragmentCount: elements.length,
    isValid: true,
    measuredAt: Date.now(),
  };
}

/**
 * Extracts the persistent configured design geometry for a `PageDocument` node at `breakpoint`
 * without replacing responsive `auto` or grid rules with fixed pixel measurements
 * (Prompt 10, Part 7, Section 21 & Part 14, Section 41).
 */
export function extractConfiguredDesignGeometry(
  node: EditorNode,
  breakpoint: EditorBreakpoint,
): ConfiguredDesignGeometry {
  const presentation = resolveResponsiveNodePresentation(node, breakpoint);
  const bundle = presentation.resolvedStyleBundle;
  const geo = bundle.geometry;
  const layout = bundle.layout;
  const shape = bundle.shape;

  return {
    breakpoint,
    width: geo?.width ?? "auto",
    height: geo?.height ?? "auto",
    minHeight: geo?.minHeight,
    maxWidth: geo?.maxWidth,
    aspectRatio: geo?.aspectRatio ? String(geo.aspectRatio) : "inherited",
    positionMode: geo?.position ?? "static",
    layoutMode: layout?.mode ?? "component_default",
    gridColumns: layout?.grid?.columns,
    padding: geo?.padding,
    margin: geo?.margin,
    cornerRadiusPx:
      shape?.cornerRadius?.uniform !== undefined ? shape.cornerRadius.uniform : "default",
  };
}
