import type { DimensionValue, PositionMode, SpacingBox } from "../schema/geometry";
import type { LayoutMode } from "../schema/layout";
import type { EditorBreakpoint } from "../schema/responsive";

/**
 * Browser client viewport coordinates returned by `Element.getBoundingClientRect()`.
 */
export interface ViewportRect {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Unscaled canvas-local stage coordinates (`0,0` = top-left of `studio-canvas-stage`).
 * Invariant to `zoomScale`: a 1440px stage rendered at 50% zoom (`zoomScale = 0.5`)
 * still measures `width = 1440` in `CanvasLocalRect`.
 */
export interface CanvasLocalRect {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Document coordinates within the scrollable studio canvas container.
 */
export interface DocumentRect {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Coordinates used by the `StudioSelectionOverlay` layer (which sits inside `studio-canvas-stage`
 * and inherits its `transform: scale(zoomScale)`).
 */
export interface OverlayRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly visibleRect: CanvasLocalRect | null;
}

export interface ClippingState {
  readonly isClipped: boolean;
  readonly clippedTop: boolean;
  readonly clippedRight: boolean;
  readonly clippedBottom: boolean;
  readonly clippedLeft: boolean;
  readonly isOffscreen: boolean;
  readonly visibleRatio: number;
}

export type GeometryVisibilityStatus = "visible" | "hidden" | "detached" | "zero_area";

/**
 * Authoritative geometry measurement result contract (Prompt 10, Part 7, Section 19).
 * Strictly separates visual rendered DOM geometry from persistent configured design geometry.
 */
export interface ElementGeometryMeasurement {
  readonly targetId: string;
  readonly nodeId: string;
  readonly instanceId: string | null;
  readonly viewportRect: ViewportRect;
  readonly canvasLocalRect: CanvasLocalRect;
  readonly documentRect: DocumentRect;
  readonly overlayRect: OverlayRect;
  readonly renderedWidthPx: number;
  readonly renderedHeightPx: number;
  readonly canvasScale: number;
  readonly hasCssTransform: boolean;
  readonly visibilityStatus: GeometryVisibilityStatus;
  readonly clipping: ClippingState;
  readonly fragmentCount: number;
  readonly isValid: boolean;
  readonly measuredAt: number;
}

/**
 * Configured design geometry extracted from `PageDocument` for the active breakpoint
 * (Prompt 10, Part 7, Section 21 & Part 14, Section 41).
 * Never overwrites `auto` or responsive layout rules with measured pixel dimensions.
 */
export interface ConfiguredDesignGeometry {
  readonly breakpoint: EditorBreakpoint;
  readonly width: DimensionValue | "auto";
  readonly height: DimensionValue | "auto";
  readonly minHeight: DimensionValue | undefined;
  readonly maxWidth: DimensionValue | undefined;
  readonly aspectRatio: string | "inherited";
  readonly positionMode: PositionMode;
  readonly layoutMode: LayoutMode | "component_default";
  readonly gridColumns: number | undefined;
  readonly padding: SpacingBox | undefined;
  readonly margin: SpacingBox | undefined;
  readonly cornerRadiusPx: number | "default";
}

export type LabelVerticalPlacement = "above" | "inside_top" | "below";
export type LabelHorizontalAlignment = "left" | "right";
export type DimensionPillPlacement = "bottom_right" | "inside_bottom_right" | "hidden";

export interface SmartLabelPlacement {
  readonly verticalPlacement: LabelVerticalPlacement;
  readonly horizontalAlignment: LabelHorizontalAlignment;
  readonly offsetTopPx: number;
  readonly offsetLeftPx: number;
  readonly maxWidthPx: number;
  readonly dimensionPillPlacement: DimensionPillPlacement;
}
