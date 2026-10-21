import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "@/lib/visual-editor/homepage/default-homepage-document";
import {
  listNodeOverridesByBreakpoint,
  resetInspectorBreakpointOverrides,
  resetInspectorStyleProperty,
  resolveInspectorPropertyState,
  updateInspectorStyleProperty,
} from "@/lib/visual-editor/inspector";
import { resolveStudioViewportState } from "@/lib/visual-editor/studio";
import { resolveResponsiveStyle } from "@/lib/visual-editor/utils/responsive-resolution";
import { findNodeById } from "@/lib/visual-editor/utils/node-tree";

describe("Prompt 12 — Responsive Breakpoint Overrides & Inheritance Model", () => {
  const featuredId = CANONICAL_HOMEPAGE_NODE_IDS.featuredRail;

  it("resolves deterministic inheritance across desktop -> tablet -> mobile -> mobile_sm and desktop -> desktop_xl", () => {
    let doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;

    // 1. Initially component_default
    const initialState = resolveInspectorPropertyState(
      findNodeById(doc, featuredId)!,
      "geometry.maxWidth",
      "desktop",
    );
    expect(initialState.origin).toBe("component_default");
    expect(initialState.hasExplicitOverrideAtBreakpoint).toBe(false);

    // 2. Set base desktop value
    const deskRes = updateInspectorStyleProperty(
      doc,
      featuredId,
      "geometry.maxWidth",
      { value: 1440, unit: "px" },
      "desktop",
    );
    expect(deskRes.ok).toBe(true);
    doc = deskRes.document;

    const atDesktop = resolveInspectorPropertyState(
      findNodeById(doc, featuredId)!,
      "geometry.maxWidth",
      "desktop",
    );
    expect(atDesktop.origin).toBe("base_desktop");
    expect(atDesktop.sourceBreakpoint).toBe("desktop");
    expect(atDesktop.value).toEqual({ value: 1440, unit: "px" });

    // Inherited at tablet, mobile, mobile_sm, and desktop_xl
    for (const bp of ["tablet", "mobile", "mobile_sm", "desktop_xl"] as const) {
      const inherited = resolveInspectorPropertyState(
        findNodeById(doc, featuredId)!,
        "geometry.maxWidth",
        bp,
      );
      expect(inherited.origin).toBe("inherited_breakpoint");
      expect(inherited.sourceBreakpoint).toBe("desktop");
      expect(inherited.value).toEqual({ value: 1440, unit: "px" });
    }

    // 3. Override at tablet (960px) -> cascades to mobile and mobile_sm, but NOT desktop or desktop_xl
    const tabRes = updateInspectorStyleProperty(
      doc,
      featuredId,
      "geometry.maxWidth",
      { value: 960, unit: "px" },
      "tablet",
    );
    expect(tabRes.ok).toBe(true);
    doc = tabRes.document;

    const atTablet = resolveInspectorPropertyState(
      findNodeById(doc, featuredId)!,
      "geometry.maxWidth",
      "tablet",
    );
    expect(atTablet.origin).toBe("explicit_breakpoint_override");
    expect(atTablet.sourceBreakpoint).toBe("tablet");
    expect(atTablet.value).toEqual({ value: 960, unit: "px" });

    const atMobile = resolveInspectorPropertyState(
      findNodeById(doc, featuredId)!,
      "geometry.maxWidth",
      "mobile",
    );
    expect(atMobile.origin).toBe("inherited_breakpoint");
    expect(atMobile.sourceBreakpoint).toBe("tablet");
    expect(atMobile.value).toEqual({ value: 960, unit: "px" });

    const atMobileSm = resolveInspectorPropertyState(
      findNodeById(doc, featuredId)!,
      "geometry.maxWidth",
      "mobile_sm",
    );
    expect(atMobileSm.origin).toBe("inherited_breakpoint");
    expect(atMobileSm.sourceBreakpoint).toBe("tablet");
    expect(atMobileSm.value).toEqual({ value: 960, unit: "px" });

    const atDesktopXl = resolveInspectorPropertyState(
      findNodeById(doc, featuredId)!,
      "geometry.maxWidth",
      "desktop_xl",
    );
    expect(atDesktopXl.origin).toBe("inherited_breakpoint");
    expect(atDesktopXl.sourceBreakpoint).toBe("desktop");
    expect(atDesktopXl.value).toEqual({ value: 1440, unit: "px" });
  });

  it("identifies theme_token origin when a color property uses a design token reference", () => {
    const doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;
    const res = updateInspectorStyleProperty(
      doc,
      featuredId,
      "appearance.backgroundColor",
      "token:card",
      "desktop",
    );
    expect(res.ok).toBe(true);

    const state = resolveInspectorPropertyState(
      findNodeById(res.document, featuredId)!,
      "appearance.backgroundColor",
      "desktop",
    );
    expect(state.origin).toBe("theme_token");
    expect(state.isThemeToken).toBe(true);
  });

  it("merges overrides across breakpoints and resets a single property without erasing sibling overrides", () => {
    let doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;

    // Base desktop padding: all 4 sides = 24
    doc = updateInspectorStyleProperty(
      doc,
      featuredId,
      "geometry.padding",
      { top: 24, right: 24, bottom: 24, left: 24, unit: "px" },
      "desktop",
    ).document;

    // Mobile override: padding top/bottom = 12, plus explicit backgroundColor and opacity
    doc = updateInspectorStyleProperty(
      doc,
      featuredId,
      "geometry.padding",
      { top: 12, right: 24, bottom: 12, left: 24, unit: "px" },
      "mobile",
    ).document;
    doc = updateInspectorStyleProperty(
      doc,
      featuredId,
      "appearance.backgroundColor",
      "#111827",
      "mobile",
    ).document;
    doc = updateInspectorStyleProperty(
      doc,
      featuredId,
      "appearance.opacity",
      0.9,
      "mobile",
    ).document;

    const node = findNodeById(doc, featuredId)!;
    const resolvedMobile = resolveResponsiveStyle(node, "mobile");
    expect(resolvedMobile.geometry?.padding).toEqual({
      top: 12,
      right: 24,
      bottom: 12,
      left: 24,
      unit: "px",
    });

    // Reset ONLY appearance.backgroundColor at mobile
    const resetSingle = resetInspectorStyleProperty(
      doc,
      featuredId,
      "appearance.backgroundColor",
      "mobile",
    );
    expect(resetSingle.ok).toBe(true);
    doc = resetSingle.document;

    const afterSingleReset = findNodeById(doc, featuredId)!;
    expect(
      afterSingleReset.responsive?.mobile?.appearance?.backgroundColor,
    ).toBeUndefined();
    // Sibling overrides at mobile remain untouched!
    expect(afterSingleReset.responsive?.mobile?.appearance?.opacity).toBe(0.9);
    expect(afterSingleReset.responsive?.mobile?.geometry?.padding?.top).toBe(12);

    // Reset all mobile overrides while keeping desktop base intact
    const resetAllMobile = resetInspectorBreakpointOverrides(
      doc,
      featuredId,
      "mobile",
    );
    expect(resetAllMobile.ok).toBe(true);
    doc = resetAllMobile.document;

    const afterResetAll = findNodeById(doc, featuredId)!;
    expect(afterResetAll.responsive?.mobile).toBeUndefined();
    expect(afterResetAll.style.geometry?.padding).toEqual({
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
      unit: "px",
    });

    const summary = listNodeOverridesByBreakpoint(afterResetAll);
    expect(summary.mobile).toHaveLength(0);
    expect(summary.desktop).toContain("geometry.padding");
  });

  it("keeps canvas zoom scale strictly decoupled from active responsive breakpoint", () => {
    const mobileAt50Zoom = resolveStudioViewportState({
      devicePreset: "mobile",
      viewportWidthPx: 390,
      zoomMode: "manual",
      zoomPercent: 50,
      availableContainerWidthPx: 1400,
    });
    const mobileAt150Zoom = resolveStudioViewportState({
      devicePreset: "mobile",
      viewportWidthPx: 390,
      zoomMode: "manual",
      zoomPercent: 150,
      availableContainerWidthPx: 1400,
    });

    expect(mobileAt50Zoom.breakpoint).toBe("mobile");
    expect(mobileAt150Zoom.breakpoint).toBe("mobile");
    expect(mobileAt50Zoom.viewportWidthPx).toBe(390);
    expect(mobileAt150Zoom.viewportWidthPx).toBe(390);
    expect(mobileAt50Zoom.zoomScale).toBe(0.5);
    expect(mobileAt150Zoom.zoomScale).toBe(1.5);
  });
});
