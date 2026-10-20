import { describe, expect, it } from "vitest";
import {
  BASIC_SECTION_DOCUMENT_FIXTURE,
  PRODUCT_COLLECTION_DOCUMENT_FIXTURE,
  clearResponsiveStyleOverride,
  resolveResponsiveStyle,
  setResponsiveStyleOverride,
} from "../index";

describe("Responsive Configuration & Cascade Inheritance Engine", () => {
  it("resolves desktop, tablet, mobile, and mobile_sm styles deterministically along the cascade chain", () => {
    const gridNode = PRODUCT_COLLECTION_DOCUMENT_FIXTURE.root[0];

    const desktopStyle = resolveResponsiveStyle(gridNode, "desktop");
    expect(desktopStyle.layout?.grid?.columns).toBe(6);
    expect(desktopStyle.layout?.grid?.columnGapPx).toBe(16);
    expect(desktopStyle.shape?.cornerRadius?.uniform).toBe(16);

    const tabletStyle = resolveResponsiveStyle(gridNode, "tablet");
    expect(tabletStyle.layout?.grid?.columns).toBe(4);
    expect(tabletStyle.layout?.grid?.columnGapPx).toBe(14);
    // Shape is inherited from desktop base
    expect(tabletStyle.shape?.cornerRadius?.uniform).toBe(16);

    const mobileStyle = resolveResponsiveStyle(gridNode, "mobile");
    expect(mobileStyle.layout?.grid?.columns).toBe(2);
    expect(mobileStyle.layout?.grid?.columnGapPx).toBe(10);
    expect(mobileStyle.shape?.cornerRadius?.uniform).toBe(16);

    // mobile_sm inherits from mobile when mobile_sm has no explicit override
    const mobileSmStyle = resolveResponsiveStyle(gridNode, "mobile_sm");
    expect(mobileSmStyle.layout?.grid?.columns).toBe(2);
    expect(mobileSmStyle.layout?.grid?.columnGapPx).toBe(10);
  });

  it("updates a desktop property without overwriting existing tablet or mobile overrides", () => {
    const gridNode = PRODUCT_COLLECTION_DOCUMENT_FIXTURE.root[0];
    const updatedDesktopNode = setResponsiveStyleOverride(gridNode, "desktop", {
      geometry: {
        width: { unit: "px", value: 1360 },
      },
    });

    expect(resolveResponsiveStyle(updatedDesktopNode, "desktop").geometry?.width).toEqual({
      unit: "px",
      value: 1360,
    });
    // Mobile grid column override remains 2
    expect(resolveResponsiveStyle(updatedDesktopNode, "mobile").layout?.grid?.columns).toBe(2);
    // Mobile also inherits the new base width unless overridden on tablet/mobile
    expect(resolveResponsiveStyle(updatedDesktopNode, "mobile").geometry?.width).toEqual({
      unit: "px",
      value: 1360,
    });
  });

  it("clears a specific breakpoint override to restore the inherited parent value", () => {
    const headingNode = BASIC_SECTION_DOCUMENT_FIXTURE.root[0].children[0].children[0];
    expect(resolveResponsiveStyle(headingNode, "mobile").appearance?.typography?.fontSize).toEqual({
      unit: "px",
      value: 32,
    });

    const restoredNode = clearResponsiveStyleOverride(headingNode, "mobile", "appearance");
    expect(resolveResponsiveStyle(restoredNode, "mobile").appearance?.typography?.fontSize).toEqual(
      {
        unit: "px",
        value: 48,
      },
    );
  });
});
