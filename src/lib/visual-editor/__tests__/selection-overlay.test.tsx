// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HoverOverlay } from "@/components/visual-editor/selection/HoverOverlay";
import { SelectionLabel } from "@/components/visual-editor/selection/SelectionLabel";
import {
  ElementDimensions,
  InspectorGeometryComparisonCard,
} from "@/components/visual-editor/selection/ElementDimensions";
import { SelectionBreadcrumb } from "@/components/visual-editor/selection/SelectionBreadcrumb";
import type { ElementGeometryMeasurement } from "@/lib/visual-editor/geometry";

const MOCK_GEOMETRY: ElementGeometryMeasurement = {
  targetId: "home-planet-hero",
  nodeId: "home-planet-hero",
  instanceId: null,
  instanceType: null,
  isValid: true,
  visibilityStatus: "visible",
  renderedWidthPx: 1200,
  renderedHeightPx: 480,
  viewportRect: {
    left: 100,
    top: 120,
    width: 1200,
    height: 480,
    right: 1300,
    bottom: 600,
  },
  canvasLocalRect: {
    left: 24,
    top: 60,
    width: 1200,
    height: 480,
    right: 1224,
    bottom: 540,
  },
  documentRect: {
    left: 24,
    top: 260,
    width: 1200,
    height: 480,
    right: 1224,
    bottom: 740,
  },
  clipping: {
    isClipped: false,
    isOffscreen: false,
    visibleRatio: 1,
    visibleCanvasRect: {
      left: 24,
      top: 60,
      width: 1200,
      height: 480,
      right: 1224,
      bottom: 540,
    },
    clippedTop: false,
    clippedBottom: false,
    clippedLeft: false,
    clippedRight: false,
  },
};

describe("Prompt 10 — Selection Overlay, Hover Outline, Labels, Dimensions & Breadcrumbs", () => {
  it("renders HoverOverlay with pointer-events-none and suppresses it when offscreen", () => {
    const { container, rerender } = render(
      <HoverOverlay measurement={MOCK_GEOMETRY} label="Planet Hero" viewportWidthPx={1440} />,
    );

    const hoverOutline = screen.getByTestId("studio-hover-outline");
    expect(hoverOutline.className).toContain("pointer-events-none");
    expect(hoverOutline.getAttribute("data-hovered-node-id")).toBe("home-planet-hero");
    expect(hoverOutline.style.width).toBe("1200px");
    expect(hoverOutline.style.height).toBe("480px");
    expect(hoverOutline.textContent).toContain("Planet Hero");

    rerender(
      <HoverOverlay
        measurement={{
          ...MOCK_GEOMETRY,
          clipping: { ...MOCK_GEOMETRY.clipping, isOffscreen: true, visibleRatio: 0 },
        }}
        label="Planet Hero"
        viewportWidthPx={1440}
      />,
    );

    expect(container.querySelector('[data-testid="studio-hover-outline"]')).toBeNull();
  });

  it("renders SelectionLabel with runtime instance badge and lock state indicator", () => {
    render(
      <SelectionLabel
        label="Deep Space Refractor 90mm"
        componentType="ProductCard"
        isRuntimeInstance={true}
        locked={true}
        placement={{
          verticalPlacement: "inside_top",
          horizontalAlignment: "left",
          offsetTopPx: 4,
          offsetLeftPx: 4,
          maxWidthPx: 280,
          dimensionPillPlacement: "outside_bottom_right",
        }}
      />,
    );

    const badge = screen.getByTestId("studio-selection-badge");
    expect(badge.getAttribute("data-label-vertical-placement")).toBe("inside_top");
    expect(badge.textContent).toContain("Deep Space Refractor 90mm");
    expect(badge.textContent).toContain("ProductCard");
    expect(badge.textContent).toContain("Instance");
    expect(screen.getByLabelText("Locked component")).toBeTruthy();
  });

  it("renders ElementDimensions and InspectorGeometryComparisonCard distinguishing rendered DOM geometry from configured design rules", () => {
    render(
      <div>
        <ElementDimensions widthPx={288.4} heightPx={370.2} placement="outside_bottom_right" />
        <InspectorGeometryComparisonCard
          renderedMeasurement={MOCK_GEOMETRY}
          configuredGeometry={{
            breakpoint: "desktop",
            width: { value: 100, unit: "%" },
            height: "auto",
            minWidth: "auto",
            maxWidth: { value: 1280, unit: "px" },
            minHeight: "auto",
            maxHeight: "auto",
            aspectRatio: "16:9",
            layoutMode: "grid",
            positionMode: "relative",
            cornerRadiusPx: 16,
          }}
        />
      </div>,
    );

    const dims = screen.getByTestId("studio-selection-dimensions");
    expect(dims.textContent).toContain("288 × 370");

    const comparison = screen.getByTestId("studio-inspector-geometry-comparison");
    expect(comparison).toBeTruthy();
    expect(screen.getByTestId("inspector-rendered-box-size").textContent).toBe("1200px × 480px");
    expect(screen.getByTestId("inspector-rendered-box-coords").textContent).toContain(
      "X: 24px · Y: 60px",
    );
    expect(screen.getByTestId("inspector-rendered-box-status").textContent).toBe("Fully visible");
    expect(screen.getByTestId("inspector-configured-width").textContent).toBe("100%");
    expect(screen.getByTestId("inspector-configured-height").textContent).toBe("auto");
    expect(screen.getByTestId("inspector-configured-aspect").textContent).toBe("16:9");
    expect(screen.getByTestId("inspector-configured-radius").textContent).toBe("16px");
  });

  it("renders SelectionBreadcrumb and triggers ancestor selection on click", () => {
    const onSelectNode = vi.fn();
    render(
      <SelectionBreadcrumb
        entries={[
          {
            id: "home-featured-products",
            label: "Featured Products",
            componentType: "ProductScrollRailSection",
            isRuntimeInstance: false,
          },
          {
            id: "home-featured-products::product::prod-101",
            label: "Product Card (Deep Space Refractor 90mm)",
            componentType: "ProductCard",
            isRuntimeInstance: true,
          },
        ]}
        activeId="home-featured-products::product::prod-101"
        onSelectNode={onSelectNode}
      />,
    );

    const breadcrumb = screen.getByTestId("studio-selection-breadcrumb");
    expect(breadcrumb).toBeTruthy();

    const parentBtn = screen.getByTestId("studio-breadcrumb-item-home-featured-products");
    fireEvent.click(parentBtn);
    expect(onSelectNode).toHaveBeenCalledWith("home-featured-products");
  });
});
