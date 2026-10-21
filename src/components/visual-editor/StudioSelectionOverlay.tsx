import React, { type RefObject } from "react";
import type { ElementGeometryMeasurement } from "@/lib/visual-editor/geometry";
import { SelectionOverlay } from "./selection/SelectionOverlay";

export interface OverlayBoxGeometry {
  readonly nodeId: string;
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface StudioSelectionOverlayProps {
  stageRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  selectedNodeId: string | null;
  selectedLabel: string | null;
  selectedType: string | null;
  selectedLocked?: boolean;
  selectedIsRuntimeInstance?: boolean;
  hoveredNodeId: string | null;
  hoveredLabel: string | null;
  zoomScale: number;
  viewportWidthPx: number;
  enabled: boolean;
  onSelectedGeometryChange?: (measurement: ElementGeometryMeasurement | null) => void;
}

/**
 * StudioSelectionOverlay wrapper delegating to Prompt 10's `SelectionOverlay` engine.
 */
export function StudioSelectionOverlay(props: StudioSelectionOverlayProps) {
  return <SelectionOverlay {...props} />;
}
