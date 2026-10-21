import React, { useEffect, useRef, useState, type RefObject } from "react";
import {
  computeSmartLabelPlacement,
  createStudioGeometryObserver,
  measureElementGeometry,
  type ElementGeometryMeasurement,
} from "@/lib/visual-editor/geometry";
import { ElementDimensions } from "./ElementDimensions";
import { HoverOverlay } from "./HoverOverlay";
import { SelectionLabel } from "./SelectionLabel";

export interface SelectionOverlayProps {
  readonly stageRef: RefObject<HTMLDivElement | null>;
  readonly scrollContainerRef: RefObject<HTMLDivElement | null>;
  readonly selectedNodeId: string | null;
  readonly selectedLabel: string | null;
  readonly selectedType: string | null;
  readonly selectedLocked?: boolean;
  readonly selectedIsRuntimeInstance?: boolean;
  readonly hoveredNodeId: string | null;
  readonly hoveredLabel: string | null;
  readonly zoomScale: number;
  readonly viewportWidthPx: number;
  readonly enabled: boolean;
  readonly onSelectedGeometryChange?: (measurement: ElementGeometryMeasurement | null) => void;
}

/**
 * Dedicated non-layout-affecting selection and hover overlay layer (Prompt 10, Parts 7–9, Sections 18–27).
 * - Driven by `createStudioGeometryObserver` with `requestAnimationFrame` batching and selective `ResizeObserver`
 *   subscriptions on `stageEl`, `scrollContainerEl`, and the active selected/hovered DOM elements.
 * - Never modifies the intrinsic box model, CSS grid tracks, or layout of the storefront.
 * - Automatically updates across canvas scroll, horizontal carousel scroll, zoom changes, device preset changes,
 *   side-panel resizes, image loads, and CSS transitions.
 */
export function SelectionOverlay({
  stageRef,
  scrollContainerRef,
  selectedNodeId,
  selectedLabel,
  selectedType,
  selectedLocked = false,
  selectedIsRuntimeInstance = false,
  hoveredNodeId,
  hoveredLabel,
  zoomScale,
  viewportWidthPx,
  enabled,
  onSelectedGeometryChange,
}: SelectionOverlayProps) {
  const [selectedMeasurement, setSelectedMeasurement] = useState<ElementGeometryMeasurement | null>(
    null,
  );
  const [hoveredMeasurement, setHoveredMeasurement] = useState<ElementGeometryMeasurement | null>(
    null,
  );

  const selectedIdRef = useRef<string | null>(selectedNodeId);
  const hoveredIdRef = useRef<string | null>(hoveredNodeId);
  const zoomScaleRef = useRef<number>(zoomScale);
  const onSelectedGeometryChangeRef = useRef(onSelectedGeometryChange);

  selectedIdRef.current = selectedNodeId;
  hoveredIdRef.current = hoveredNodeId;
  zoomScaleRef.current = zoomScale;
  onSelectedGeometryChangeRef.current = onSelectedGeometryChange;

  useEffect(() => {
    const stageEl = stageRef.current;
    const scrollEl = scrollContainerRef.current;

    if (!enabled || !stageEl) {
      setSelectedMeasurement(null);
      setHoveredMeasurement(null);
      onSelectedGeometryChangeRef.current?.(null);
      return;
    }

    const observer = createStudioGeometryObserver({
      stageEl,
      scrollContainerEl: scrollEl,
      getSelectedId: () => selectedIdRef.current,
      getHoveredId: () => hoveredIdRef.current,
      getZoomScale: () => zoomScaleRef.current,
      onGeometryChange: ({ selectedMeasurement: nextSel, hoveredMeasurement: nextHov }) => {
        setSelectedMeasurement(nextSel);
        setHoveredMeasurement(nextHov);
        onSelectedGeometryChangeRef.current?.(nextSel);
      },
    });

    // Perform an immediate synchronous measurement pass so initial selection and tests have zero frame delay
    const immediateSelected = selectedNodeId
      ? measureElementGeometry(stageEl, scrollEl, selectedNodeId, zoomScale)
      : null;
    const immediateHovered =
      hoveredNodeId && hoveredNodeId !== selectedNodeId
        ? measureElementGeometry(stageEl, scrollEl, hoveredNodeId, zoomScale)
        : null;

    setSelectedMeasurement(immediateSelected);
    setHoveredMeasurement(immediateHovered);
    onSelectedGeometryChangeRef.current?.(immediateSelected);

    return () => {
      observer.disconnect();
    };
  }, [
    enabled,
    stageRef,
    scrollContainerRef,
    selectedNodeId,
    hoveredNodeId,
    zoomScale,
    viewportWidthPx,
  ]);

  if (!enabled) return null;

  const showSelectionBox =
    selectedMeasurement !== null &&
    selectedMeasurement.isValid &&
    selectedMeasurement.visibilityStatus === "visible";

  const labelPlacement =
    showSelectionBox && selectedMeasurement
      ? computeSmartLabelPlacement(selectedMeasurement, viewportWidthPx)
      : null;

  return (
    <div
      aria-hidden="true"
      data-testid="studio-selection-overlay-layer"
      className="pointer-events-none absolute inset-0 z-50 overflow-visible"
    >
      {/* 1. Subtle Hover Outline */}
      <HoverOverlay
        measurement={hoveredMeasurement}
        label={hoveredLabel}
        viewportWidthPx={viewportWidthPx}
      />

      {/* 2. Selected Component Outline, Smart Label & Rendered Dimensions Pill */}
      {showSelectionBox && selectedMeasurement && labelPlacement && (
        <div
          data-testid="studio-selection-outline"
          data-selected-node-id={selectedMeasurement.targetId}
          data-selected-offscreen={selectedMeasurement.clipping.isOffscreen ? "true" : undefined}
          data-selected-clipped={selectedMeasurement.clipping.isClipped ? "true" : undefined}
          style={{
            transform: `translate3d(${selectedMeasurement.canvasLocalRect.left}px, ${selectedMeasurement.canvasLocalRect.top}px, 0)`,
            width: `${selectedMeasurement.canvasLocalRect.width}px`,
            height: `${selectedMeasurement.canvasLocalRect.height}px`,
          }}
          className="pointer-events-none absolute left-0 top-0 rounded-sm ring-2 ring-primary ring-inset bg-primary/[0.03] motion-reduce:transition-none"
        >
          <SelectionLabel
            label={selectedLabel ?? selectedMeasurement.targetId}
            componentType={selectedType}
            locked={selectedLocked}
            isRuntimeInstance={selectedIsRuntimeInstance || Boolean(selectedMeasurement.instanceId)}
            placement={labelPlacement}
          />

          <ElementDimensions
            widthPx={selectedMeasurement.renderedWidthPx}
            heightPx={selectedMeasurement.renderedHeightPx}
            placement={labelPlacement.dimensionPillPlacement}
          />
        </div>
      )}
    </div>
  );
}
