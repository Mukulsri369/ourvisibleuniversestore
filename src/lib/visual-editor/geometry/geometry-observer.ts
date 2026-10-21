import { areGeometryMeasurementsEqual } from "./coordinate-transform";
import { findTargetElementsInStage, measureElementGeometry } from "./geometry-measurement";
import type { ElementGeometryMeasurement } from "./geometry-types";

export interface StudioGeometryObserverOptions {
  readonly stageEl: HTMLElement;
  readonly scrollContainerEl: HTMLElement | null;
  readonly getSelectedId: () => string | null;
  readonly getHoveredId: () => string | null;
  readonly getZoomScale: () => number;
  readonly onGeometryChange: (snapshot: {
    selectedMeasurement: ElementGeometryMeasurement | null;
    hoveredMeasurement: ElementGeometryMeasurement | null;
  }) => void;
}

export interface StudioGeometryObserverHandle {
  readonly recomputeNow: () => void;
  readonly scheduleRecompute: () => void;
  readonly refreshObservedTargets: () => void;
  readonly disconnect: () => void;
}

/**
 * Event-driven, `requestAnimationFrame`-batched geometry observer (Prompt 10, Part 8, Section 23 & Part 19, Section 56).
 * - Subscribes selectively ONLY to `stageEl`, `scrollContainerEl`, and the active selected/hovered DOM elements.
 * - Tracks scroll (main canvas + horizontal product carousels), resize, image load, font readiness,
 *   and CSS transition/animation updates without continuous polling across the catalog.
 */
export function createStudioGeometryObserver(
  options: StudioGeometryObserverOptions,
): StudioGeometryObserverHandle {
  const {
    stageEl,
    scrollContainerEl,
    getSelectedId,
    getHoveredId,
    getZoomScale,
    onGeometryChange,
  } = options;

  let rafId: number | null = null;
  let isDisconnected = false;
  let lastSelected: ElementGeometryMeasurement | null = null;
  let lastHovered: ElementGeometryMeasurement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const executeMeasurement = () => {
    rafId = null;
    if (isDisconnected) return;

    const zoomScale = getZoomScale();
    const selectedId = getSelectedId();
    const hoveredId = getHoveredId();

    const nextSelected = selectedId
      ? measureElementGeometry(stageEl, scrollContainerEl, selectedId, zoomScale)
      : null;

    const nextHovered =
      hoveredId && hoveredId !== selectedId
        ? measureElementGeometry(stageEl, scrollContainerEl, hoveredId, zoomScale)
        : null;

    const selectedChanged = !areGeometryMeasurementsEqual(lastSelected, nextSelected);
    const hoveredChanged = !areGeometryMeasurementsEqual(lastHovered, nextHovered);

    if (selectedChanged || hoveredChanged) {
      lastSelected = nextSelected;
      lastHovered = nextHovered;
      onGeometryChange({
        selectedMeasurement: nextSelected,
        hoveredMeasurement: nextHovered,
      });
    }
  };

  const scheduleRecompute = () => {
    if (isDisconnected) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      executeMeasurement();
      return;
    }
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(executeMeasurement);
  };

  const refreshObservedTargets = () => {
    if (isDisconnected) return;
    resizeObserver?.disconnect();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleRecompute();
      });

      resizeObserver.observe(stageEl);
      if (scrollContainerEl) {
        resizeObserver.observe(scrollContainerEl);
      }

      const selectedId = getSelectedId();
      if (selectedId) {
        for (const el of findTargetElementsInStage(stageEl, selectedId)) {
          resizeObserver.observe(el);
        }
      }

      const hoveredId = getHoveredId();
      if (hoveredId && hoveredId !== selectedId) {
        for (const el of findTargetElementsInStage(stageEl, hoveredId)) {
          resizeObserver.observe(el);
        }
      }
    }
  };

  const onPassiveEvent = () => {
    scheduleRecompute();
  };

  // Attach capture-phase passive listeners so nested horizontal carousels, image loads, and transitions trigger rAF updates
  scrollContainerEl?.addEventListener("scroll", onPassiveEvent, { passive: true, capture: true });
  stageEl.addEventListener("scroll", onPassiveEvent, { passive: true, capture: true });
  stageEl.addEventListener("load", onPassiveEvent, { passive: true, capture: true });
  stageEl.addEventListener("transitionend", onPassiveEvent, { passive: true, capture: true });
  stageEl.addEventListener("animationend", onPassiveEvent, { passive: true, capture: true });

  if (typeof window !== "undefined") {
    window.addEventListener("resize", onPassiveEvent, { passive: true });
  }

  if (typeof document !== "undefined" && "fonts" in document && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      if (!isDisconnected) scheduleRecompute();
    });
  }

  refreshObservedTargets();
  executeMeasurement();

  return {
    recomputeNow: executeMeasurement,
    scheduleRecompute,
    refreshObservedTargets,
    disconnect: () => {
      isDisconnected = true;
      if (rafId !== null && typeof window !== "undefined" && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      scrollContainerEl?.removeEventListener("scroll", onPassiveEvent, true);
      stageEl.removeEventListener("scroll", onPassiveEvent, true);
      stageEl.removeEventListener("load", onPassiveEvent, true);
      stageEl.removeEventListener("transitionend", onPassiveEvent, true);
      stageEl.removeEventListener("animationend", onPassiveEvent, true);
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onPassiveEvent);
      }
    },
  };
}
