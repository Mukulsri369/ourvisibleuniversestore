import React from "react";
import type {
  ConfiguredDesignGeometry,
  DimensionPillPlacement,
  ElementGeometryMeasurement,
} from "@/lib/visual-editor/geometry";
import type { DimensionValue } from "@/lib/visual-editor/schema/geometry";

export interface ElementDimensionsProps {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly placement: DimensionPillPlacement;
}

/**
 * Unobtrusive rendered dimensions readout (`320 × 420`) on the selection bounding box
 * (Prompt 10, Part 9, Section 26).
 */
export function ElementDimensions({ widthPx, heightPx, placement }: ElementDimensionsProps) {
  if (placement === "hidden") return null;

  const positionClass =
    placement === "inside_bottom_right" ? "bottom-1 right-1" : "-bottom-5 right-0";

  return (
    <div
      data-testid="studio-selection-dimensions"
      data-dimension-placement={placement}
      className={`pointer-events-none absolute ${positionClass} flex items-center rounded bg-card/95 border border-primary/40 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-foreground shadow-xs whitespace-nowrap`}
    >
      <span>
        {Math.round(widthPx)} × {Math.round(heightPx)}
      </span>
    </div>
  );
}

function formatConfiguredDimension(dim: DimensionValue | "auto" | undefined): string {
  if (!dim || dim === "auto") return "auto";
  if (dim.unit === "auto") return "auto";
  return `${dim.value}${dim.unit}`;
}

export interface InspectorGeometryComparisonCardProps {
  readonly renderedMeasurement: ElementGeometryMeasurement | null;
  readonly configuredGeometry: ConfiguredDesignGeometry;
}

/**
 * Inspector comparison panel distinguishing actual rendered DOM geometry (`288px × 370px`)
 * from persistent configured design geometry (`width: auto`, `layout: grid`, `aspectRatio: inherited`)
 * (Prompt 10, Part 7, Section 21 & Part 14, Sections 40–41).
 */
export function InspectorGeometryComparisonCard({
  renderedMeasurement,
  configuredGeometry,
}: InspectorGeometryComparisonCardProps) {
  const renderedSizeText = renderedMeasurement
    ? `${renderedMeasurement.renderedWidthPx}px × ${renderedMeasurement.renderedHeightPx}px`
    : "Not currently rendered in stage";

  const positionText = renderedMeasurement
    ? `X: ${Math.round(renderedMeasurement.canvasLocalRect.left)}px · Y: ${Math.round(renderedMeasurement.canvasLocalRect.top)}px`
    : "—";

  const clippingText = !renderedMeasurement
    ? "Detached / Hidden"
    : renderedMeasurement.clipping.isOffscreen
      ? "Offscreen (scrolled out of view)"
      : renderedMeasurement.clipping.isClipped
        ? `Partially clipped (${Math.round(renderedMeasurement.clipping.visibleRatio * 100)}% visible)`
        : "Fully visible";

  return (
    <div
      data-testid="studio-inspector-geometry-comparison"
      className="space-y-2.5 rounded-lg border border-border/80 bg-secondary/20 p-3 text-xs"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">Geometry &amp; Dimensions</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {configuredGeometry.breakpoint}
        </span>
      </div>

      {/* 1. Actual Rendered DOM Geometry */}
      <div className="rounded-md border border-border/60 bg-background/70 p-2 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Rendered DOM Box</span>
          <span
            data-testid="inspector-rendered-box-size"
            className="font-mono font-semibold text-foreground tabular-nums"
          >
            {renderedSizeText}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Canvas Coordinates</span>
          <span
            data-testid="inspector-rendered-box-coords"
            className="font-mono text-[10px] text-muted-foreground tabular-nums"
          >
            {positionText}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Viewport Status</span>
          <span
            data-testid="inspector-rendered-box-status"
            className="font-mono text-[10px] text-muted-foreground"
          >
            {clippingText}
          </span>
        </div>
      </div>

      {/* 2. Saved / Configured Design Geometry (Never overwritten by measured pixels) */}
      <div className="rounded-md border border-border/60 bg-background/70 p-2 space-y-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Configured Design Rules (Saved Schema)
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Width:</span>
            <span data-testid="inspector-configured-width" className="font-mono text-foreground">
              {formatConfiguredDimension(configuredGeometry.width)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Height:</span>
            <span data-testid="inspector-configured-height" className="font-mono text-foreground">
              {formatConfiguredDimension(configuredGeometry.height)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Layout:</span>
            <span data-testid="inspector-configured-layout" className="font-mono text-foreground">
              {configuredGeometry.layoutMode}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Aspect:</span>
            <span data-testid="inspector-configured-aspect" className="font-mono text-foreground">
              {configuredGeometry.aspectRatio}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Radius:</span>
            <span data-testid="inspector-configured-radius" className="font-mono text-foreground">
              {configuredGeometry.cornerRadiusPx === "default"
                ? "default"
                : `${configuredGeometry.cornerRadiusPx}px`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Position:</span>
            <span data-testid="inspector-configured-position" className="font-mono text-foreground">
              {configuredGeometry.positionMode}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
