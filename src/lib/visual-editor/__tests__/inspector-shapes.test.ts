import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "@/lib/visual-editor/homepage/default-homepage-document";
import {
  updateInspectorStyleProperty,
  validateClipPresetInput,
  validateCornerRadiusInput,
  validateShapeTypeInput,
} from "@/lib/visual-editor/inspector";
import {
  formatCornerRadiusCss,
  resolveImageCropCssProperties,
  resolveNodeCssProperties,
  resolveTypographyCssProperties,
} from "@/lib/visual-editor/rendering/style-resolver";
import { executeStructuralCommand } from "@/lib/visual-editor/studio";
import { resolveResponsiveStyle } from "@/lib/visual-editor/utils/responsive-resolution";
import { findNodeById } from "@/lib/visual-editor/utils/node-tree";

describe("Prompt 12 — Shape Presets, Corner Radii, Clip-Path & Real Component Target Styling", () => {
  const featuredId = CANONICAL_HOMEPAGE_NODE_IDS.featuredRail;

  it("validates shape presets and formats uniform & 4-corner independent radii", () => {
    for (const preset of [
      "square",
      "rectangle",
      "rounded-rectangle",
      "pill",
      "circle",
      "ellipse",
      "hexagon",
      "octagon",
      "diamond",
      "arch",
    ] as const) {
      expect(validateShapeTypeInput(preset).valid).toBe(true);
    }
    expect(validateShapeTypeInput("starburst").valid).toBe(false);

    // Uniform radius
    expect(
      validateCornerRadiusInput({ mode: "uniform", uniform: 20, unit: "px" }).valid,
    ).toBe(true);
    expect(
      formatCornerRadiusCss({ mode: "uniform", uniform: 20, unit: "px" }, "rounded-rectangle"),
    ).toBe("20px");

    // Independent 4-corner radii
    const independent = {
      mode: "independent" as const,
      topLeft: 24,
      topRight: 8,
      bottomRight: 24,
      bottomLeft: 0,
      unit: "px" as const,
    };
    expect(validateCornerRadiusInput(independent).valid).toBe(true);
    expect(formatCornerRadiusCss(independent, undefined)).toBe("24px 8px 24px 0px");

    // Shape preset overrides
    expect(formatCornerRadiusCss(undefined, "rectangle")).toBe("0px");
    expect(formatCornerRadiusCss(undefined, "pill")).toBe("9999px");
    expect(formatCornerRadiusCss(undefined, "circle")).toBe("50%");
    expect(formatCornerRadiusCss(undefined, "ellipse")).toBe("50%");
    expect(formatCornerRadiusCss(undefined, "arch")).toBe("999px 999px 16px 16px");
  });

  it("maps geometric shape presets to CSS clip-path polygons and sets overflow: hidden automatically", () => {
    expect(validateClipPresetInput("hexagon").valid).toBe(true);
    expect(validateClipPresetInput("octagon").valid).toBe(true);
    expect(validateClipPresetInput("diamond").valid).toBe(true);

    let doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;
    const hexRes = updateInspectorStyleProperty(
      doc,
      featuredId,
      "shape.clipPreset",
      "hexagon",
      "desktop",
    );
    expect(hexRes.ok).toBe(true);
    doc = hexRes.document;

    const resolvedBundle = resolveResponsiveStyle(findNodeById(doc, featuredId)!, "desktop");
    const css = resolveNodeCssProperties(resolvedBundle);
    expect(css?.clipPath).toContain("polygon(");
    expect(css?.overflow).toBe("hidden");
  });

  it("resolves typography and media crop CSS properties for real component targets (Heading, Text, Button, ProductCard, CategoryCard, Image)", () => {
    let doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;
    const created = executeStructuralCommand(doc, {
      type: "CreateContainer",
      parentTargetId: null,
      containerType: "Section",
    });
    expect(created.ok).toBe(true);
    doc = created.document;
    const sectionId = created.selectedNodeId!;

    // Apply corner radius, border, and shadow
    doc = updateInspectorStyleProperty(
      doc,
      sectionId,
      "shape.cornerRadius",
      {
        mode: "independent",
        topLeft: 32,
        topRight: 12,
        bottomRight: 32,
        bottomLeft: 12,
        unit: "px",
      },
      "desktop",
    ).document;
    doc = updateInspectorStyleProperty(
      doc,
      sectionId,
      "appearance.border",
      { widthPx: 2, style: "solid", color: "#38bdf8" },
      "desktop",
    ).document;
    doc = updateInspectorStyleProperty(
      doc,
      sectionId,
      "appearance.shadow",
      {
        preset: "custom",
        offsetX: 0,
        offsetY: 16,
        blurPx: 32,
        spreadPx: -4,
        color: "rgba(0,0,0,0.5)",
      },
      "desktop",
    ).document;

    const resolved = resolveResponsiveStyle(findNodeById(doc, sectionId)!, "desktop");
    const css = resolveNodeCssProperties(resolved);
    expect(css?.borderRadius).toBe("32px 12px 32px 12px");
    expect(css?.border).toBe("2px solid #38bdf8");
    expect(css?.boxShadow).toBe("0px 16px 32px -4px rgba(0,0,0,0.5)");
    expect(css?.overflow).toBe("hidden");

    // Verify typography CSS resolver
    const typoCss = resolveTypographyCssProperties({
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: { value: 2.25, unit: "rem" },
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacingEm: -0.02,
      textAlign: "center",
      textTransform: "uppercase",
      color: "token:primary",
    });
    expect(typoCss?.fontFamily).toContain("Space Grotesk");
    expect(typoCss?.fontSize).toBe("2.25rem");
    expect(typoCss?.fontWeight).toBe(700);
    expect(typoCss?.lineHeight).toBe(1.15);
    expect(typoCss?.letterSpacing).toBe("-0.02em");
    expect(typoCss?.textAlign).toBe("center");
    expect(typoCss?.textTransform).toBe("uppercase");
    expect(typoCss?.color).toBe("var(--color-primary)");

    // Verify media crop CSS resolver
    const mediaCss = resolveImageCropCssProperties({
      objectFit: "cover",
      focalPoint: { xPercent: 25, yPercent: 75 },
      aspectRatio: "4:5",
      zoom: 1.25,
    });
    expect(mediaCss?.objectFit).toBe("cover");
    expect(mediaCss?.objectPosition).toBe("25% 75%");
    expect(mediaCss?.aspectRatio).toBe("4 / 5");
    expect(mediaCss?.transform).toBe("scale(1.25)");
  });
});
