import React from "react";
import { Lock } from "lucide-react";
import type { SmartLabelPlacement } from "@/lib/visual-editor/geometry";

export interface SelectionLabelProps {
  readonly label: string;
  readonly componentType?: string | null;
  readonly locked?: boolean;
  readonly isRuntimeInstance?: boolean;
  readonly placement: SmartLabelPlacement;
}

/**
 * Unobtrusive contextual selection label (Prompt 10, Part 9, Sections 26–27).
 * - Automatically repositions inside or below the top boundary when near the top of the canvas
 *   (`top < 26px`, e.g. `StoreHeader`, `PlanetHero`, or `CelestialScrollWorld`).
 * - Aligns right when near the right edge of the canvas to prevent overflow.
 * - Uses `pointer-events-none` so it never intercepts underlying canvas interactions.
 */
export function SelectionLabel({
  label,
  componentType,
  locked = false,
  isRuntimeInstance = false,
  placement,
}: SelectionLabelProps) {
  const positionStyle: React.CSSProperties = {
    top: `${placement.offsetTopPx}px`,
    maxWidth: `${placement.maxWidthPx}px`,
    ...(placement.horizontalAlignment === "right"
      ? { right: 0 }
      : { left: `${placement.offsetLeftPx}px` }),
  };

  return (
    <div
      data-testid="studio-selection-badge"
      data-label-vertical-placement={placement.verticalPlacement}
      data-label-horizontal-alignment={placement.horizontalAlignment}
      style={positionStyle}
      className="pointer-events-none absolute flex items-center gap-1.5 rounded bg-primary px-2 py-0.5 font-sans text-[11px] font-semibold text-primary-foreground shadow-sm whitespace-nowrap overflow-hidden"
    >
      <span className="truncate">{label}</span>
      {componentType && componentType !== label && (
        <span className="font-mono text-[10px] font-normal opacity-85">· {componentType}</span>
      )}
      {isRuntimeInstance && (
        <span className="font-mono text-[9px] font-normal uppercase tracking-wider opacity-80">
          · Instance
        </span>
      )}
      {locked && <Lock className="size-3 shrink-0 opacity-90" aria-label="Locked component" />}
    </div>
  );
}
