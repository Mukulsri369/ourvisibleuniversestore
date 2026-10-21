import type {
  DimensionPillPlacement,
  ElementGeometryMeasurement,
  LabelHorizontalAlignment,
  LabelVerticalPlacement,
  SmartLabelPlacement,
} from "./geometry-types";

const TOP_LABEL_CLEARANCE_PX = 26;
const MIN_ELEMENT_HEIGHT_FOR_OUTSIDE_PILL_PX = 48;
const MIN_ELEMENT_WIDTH_FOR_DIMENSION_PILL_PX = 96;

/**
 * Computes smart, non-overflowing placement for the selection component label and
 * dimensions pill (Prompt 10, Part 9, Sections 26–27).
 * - Repositions label inside or below the top edge when the element is near `top: 0`
 *   (e.g. `StoreHeader`, `PlanetHero`, or `CelestialScrollWorld`).
 * - Aligns label to the right edge if the element sits near the right canvas boundary.
 * - Adjusts or hides the dimension pill on very compact elements so it never obscures content.
 */
export function computeSmartLabelPlacement(
  measurement: ElementGeometryMeasurement,
  viewportWidthPx: number,
): SmartLabelPlacement {
  const { top, left, width, height } = measurement.canvasLocalRect;

  // 1. Vertical placement of component badge
  let verticalPlacement: LabelVerticalPlacement = "above";
  let offsetTopPx = -24;

  if (top < TOP_LABEL_CLEARANCE_PX) {
    if (height >= 52) {
      verticalPlacement = "inside_top";
      offsetTopPx = 4;
    } else {
      verticalPlacement = "below";
      offsetTopPx = height + 4;
    }
  }

  // 2. Horizontal alignment so badge never overflows the right edge of the canvas
  const estimatedBadgeWidthPx = 220;
  let horizontalAlignment: LabelHorizontalAlignment = "left";
  let offsetLeftPx = 0;

  if (left + estimatedBadgeWidthPx > viewportWidthPx && left > estimatedBadgeWidthPx / 2) {
    horizontalAlignment = "right";
    offsetLeftPx = 0;
  } else if (left < 0) {
    offsetLeftPx = Math.min(width - 40, -left + 4);
  }

  const maxWidthPx = Math.max(140, Math.min(viewportWidthPx - 16, 360));

  // 3. Dimension pill (`320 × 420`) placement
  let dimensionPillPlacement: DimensionPillPlacement = "bottom_right";
  if (width < MIN_ELEMENT_WIDTH_FOR_DIMENSION_PILL_PX || height < 28) {
    dimensionPillPlacement = "hidden";
  } else if (height < MIN_ELEMENT_HEIGHT_FOR_OUTSIDE_PILL_PX) {
    dimensionPillPlacement = "inside_bottom_right";
  }

  return {
    verticalPlacement,
    horizontalAlignment,
    offsetTopPx,
    offsetLeftPx,
    maxWidthPx,
    dimensionPillPlacement,
  };
}
