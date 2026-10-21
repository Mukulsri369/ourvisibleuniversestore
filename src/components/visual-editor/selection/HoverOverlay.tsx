import React from "react";
import type { ElementGeometryMeasurement } from "@/lib/visual-editor/geometry";

export interface HoverOverlayProps {
  readonly measurement: ElementGeometryMeasurement | null;
  readonly label: string | null;
  readonly viewportWidthPx: number;
}

/**
 * Non-layout-affecting hover outline overlay (Prompt 10, Part 8, Section 22 & Part 10, Sections 28–29).
 * - Uses `pointer-events-none` so the hover outline NEVER becomes a hit-test target or causes hover flicker.
 * - Respects `prefers-reduced-motion` (`motion-reduce:transition-none`).
 */
export function HoverOverlay({ measurement, label, viewportWidthPx }: HoverOverlayProps) {
  if (!measurement || !measurement.isValid || measurement.clipping.isOffscreen) {
    return null;
  }

  const { left, top, width, height } = measurement.canvasLocalRect;
  const labelInsideTop = top < 22;
  const labelAlignRight = left + 180 > viewportWidthPx && left > 90;

  return (
    <div
      data-testid="studio-hover-outline"
      data-hovered-node-id={measurement.targetId}
      style={{
        transform: `translate3d(${left}px, ${top}px, 0)`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      className="pointer-events-none absolute left-0 top-0 rounded-sm ring-1 ring-accent/85 ring-inset bg-accent/[0.025] transition-opacity duration-75 motion-reduce:transition-none"
    >
      {label && (
        <div
          style={{
            top: labelInsideTop ? "2px" : "-20px",
            ...(labelAlignRight ? { right: 0 } : { left: 0 }),
          }}
          className="pointer-events-none absolute flex items-center gap-1 rounded bg-accent/95 px-1.5 py-0.5 font-mono text-[10px] font-medium text-accent-foreground shadow-xs whitespace-nowrap"
        >
          <span className="max-w-[220px] truncate">{label}</span>
        </div>
      )}
    </div>
  );
}
