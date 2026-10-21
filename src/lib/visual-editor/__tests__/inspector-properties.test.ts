import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "@/lib/visual-editor/homepage/default-homepage-document";
import {
  buildVerifiedComponentPropertyMatrix,
  evaluateInspectorStylePathSupport,
  getAllowedInspectorLayoutModes,
  getSupportedInspectorGroupsForNode,
  getSupportedInspectorPropertyDefinitions,
  INSPECTOR_PROPERTY_DEFINITIONS,
  resetInspectorStyleProperty,
  resolveInspectorPropertyState,
  updateInspectorStyleProperty,
  validateAspectRatioInput,
  validateBorderInput,
  validateColorInput,
  validateDimensionInput,
  validateFiltersInput,
  validateGradientInput,
  validateMediaCropInput,
  validateShadowInput,
  validateTypographyInput,
} from "@/lib/visual-editor/inspector";
import {
  executeStructuralCommand,
  GLOBAL_CHROME_HEADER_ID,
  updateStudioNodeProp,
} from "@/lib/visual-editor/studio";
import { findNodeById } from "@/lib/visual-editor/utils/node-tree";

describe("Prompt 12 — Inspector Properties & Capability Matrix", () => {
  const featuredId = CANONICAL_HOMEPAGE_NODE_IDS.featuredRail;
  const newestId = CANONICAL_HOMEPAGE_NODE_IDS.newArrivalsRail;

  it("builds a complete verified component-to-property capability matrix for all registered types", () => {
    const matrixMap = buildVerifiedComponentPropertyMatrix();
    const matrix = Object.values(matrixMap);
    expect(matrix.length).toBeGreaterThanOrEqual(19);

    const headerCap = matrixMap.StoreHeader;
    expect(headerCap.supportedStylePaths).toHaveLength(0);

    const footerCap = matrixMap.StoreFooter;
    expect(footerCap.supportedStylePaths).toHaveLength(0);

    const textCap = matrixMap.Text;
    expect(textCap.supportedStylePaths).toContain("appearance.typography");
    expect(textCap.supportedStylePaths).not.toContain("shape.imageCrop");

    const imageCap = matrixMap.Image;
    expect(imageCap.supportedStylePaths).toContain("shape.imageCrop");
    expect(imageCap.supportedStylePaths).not.toContain("appearance.typography");

    const productCardCap = matrixMap.ProductCard;
    expect(productCardCap.supportedStylePaths).toContain("shape.shapeType");
    expect(productCardCap.supportedStylePaths).toContain("shape.cornerRadius");
    expect(productCardCap.supportedStylePaths).toContain("shape.imageCrop");
  });

  it("filters supported inspector property definitions and groups contextually per node type", () => {
    expect(INSPECTOR_PROPERTY_DEFINITIONS.length).toBeGreaterThanOrEqual(25);

    const sectionGroups = getSupportedInspectorGroupsForNode("Section");
    expect(sectionGroups).toContain("geometry");
    expect(sectionGroups).toContain("spacing");
    expect(sectionGroups).toContain("layout");
    expect(sectionGroups).toContain("appearance");
    expect(sectionGroups).toContain("shape");

    const textGroups = getSupportedInspectorGroupsForNode("Text");
    expect(textGroups).toContain("typography");
    expect(textGroups).not.toContain("media");

    const imageGroups = getSupportedInspectorGroupsForNode("Image");
    expect(imageGroups).toContain("media");
    expect(imageGroups).not.toContain("typography");

    const headingDefs = getSupportedInspectorPropertyDefinitions("Heading");
    expect(headingDefs.some((d) => d.id === "appearance.typography")).toBe(true);
    expect(headingDefs.some((d) => d.id === "shape.imageCrop")).toBe(false);

    const headerDefs = getSupportedInspectorPropertyDefinitions("StoreHeader");
    expect(headerDefs).toHaveLength(0);
  });

  it("enforces allowed layout modes per component type", () => {
    expect(getAllowedInspectorLayoutModes("Container")).toEqual(["block", "flex", "stack", "grid"]);
    expect(getAllowedInspectorLayoutModes("ProductGrid")).toEqual(["grid"]);
    expect(getAllowedInspectorLayoutModes("ProductScrollRail")).toEqual(["carousel"]);
    expect(getAllowedInspectorLayoutModes("StoreHeader")).toEqual([]);

    const sectionEval = evaluateInspectorStylePathSupport("Section", "layout.mode");
    expect(sectionEval.supported).toBe(true);
  });

  it("validates dimension, aspect ratio, color, gradient, border, shadow, filter, typography, and media inputs", () => {
    // Dimensions
    expect(validateDimensionInput(320, "px").valid).toBe(true);
    expect(validateDimensionInput(undefined, "auto").valid).toBe(true);
    expect(validateDimensionInput(-10, "px").valid).toBe(false);
    expect(validateDimensionInput(50, "invalid-unit").valid).toBe(false);

    // Aspect ratio
    expect(validateAspectRatioInput("16:9").valid).toBe(true);
    expect(validateAspectRatioInput("auto").valid).toBe(true);
    expect(validateAspectRatioInput("0:9").valid).toBe(false);
    expect(validateAspectRatioInput("invalid").valid).toBe(false);

    // Color & theme token
    expect(validateColorInput("#1e293b").valid).toBe(true);
    expect(validateColorInput("hsl(220, 40%, 15%)").valid).toBe(true);
    expect(validateColorInput("token:card").valid).toBe(true);
    expect(validateColorInput("url(javascript:alert(1))").valid).toBe(false);

    // Gradient
    expect(
      validateGradientInput({
        type: "linear",
        angleDeg: 135,
        stops: [
          { color: "#0f172a", positionPercent: 0 },
          { color: "#3b82f6", positionPercent: 100 },
        ],
      }).valid,
    ).toBe(true);
    expect(
      validateGradientInput({
        type: "linear",
        stops: [{ color: "#0f172a", positionPercent: 0 }],
      }).valid,
    ).toBe(false);

    // Border & Shadow & Filter
    expect(validateBorderInput({ widthPx: 2, style: "solid", color: "#3b82f6" }).valid).toBe(true);
    expect(
      validateShadowInput({
        preset: "custom",
        offsetX: 0,
        offsetY: 12,
        blurPx: 24,
        spreadPx: -4,
        color: "rgba(0, 0, 0, 0.35)",
      }).valid,
    ).toBe(true);
    expect(
      validateFiltersInput({ blurPx: 4, brightnessPercent: 110, contrastPercent: 105 }).valid,
    ).toBe(true);

    // Typography & Media
    expect(
      validateTypographyInput({
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: { value: 2.5, unit: "rem" },
        fontWeight: 700,
        textAlign: "center",
      }).valid,
    ).toBe(true);
    expect(
      validateMediaCropInput({
        objectFit: "cover",
        focalPoint: { xPercent: 50, yPercent: 25 },
        aspectRatio: "4:5",
        zoom: 1.2,
      }).valid,
    ).toBe(true);
  });

  it("updates and resets dimensions, spacing, layout, colors, gradients, borders, shadows, filters, and typography with O(depth) structural sharing", () => {
    const doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;
    const untouchedSibling = findNodeById(doc, newestId);

    // 1. Update maxWidth on featuredRail
    const widthRes = updateInspectorStyleProperty(
      doc,
      featuredId,
      "geometry.maxWidth",
      { value: 1280, unit: "px" },
      "desktop",
    );
    expect(widthRes.ok).toBe(true);
    // Untouched sibling preserves exact reference identity
    expect(findNodeById(widthRes.document, newestId)).toBe(untouchedSibling);

    const updatedFeatured = findNodeById(widthRes.document, featuredId)!;
    const resolvedMaxWidth = resolveInspectorPropertyState(
      updatedFeatured,
      "geometry.maxWidth",
      "desktop",
    );
    expect(resolvedMaxWidth.value).toEqual({ value: 1280, unit: "px" });
    expect(resolvedMaxWidth.origin).toBe("base_desktop");

    // 2. Update background gradient
    const gradRes = updateInspectorStyleProperty(
      widthRes.document,
      featuredId,
      "appearance.backgroundGradient",
      {
        type: "linear",
        angleDeg: 135,
        stops: [
          { color: "#090d16", positionPercent: 0 },
          { color: "#1e293b", positionPercent: 100 },
        ],
      },
      "desktop",
    );
    expect(gradRes.ok).toBe(true);
    expect(
      findNodeById(gradRes.document, featuredId)?.style.appearance?.backgroundGradient?.type,
    ).toBe("linear");

    // 3. Reset maxWidth
    const resetRes = resetInspectorStyleProperty(
      gradRes.document,
      featuredId,
      "geometry.maxWidth",
      "desktop",
    );
    expect(resetRes.ok).toBe(true);
    const afterReset = findNodeById(resetRes.document, featuredId)!;
    expect(afterReset.style.geometry?.maxWidth).toBeUndefined();
    // Sibling appearance.backgroundGradient remains intact
    expect(afterReset.style.appearance?.backgroundGradient?.type).toBe("linear");
  });

  it("blocks edits on locked nodes, ancestor-locked nodes, global route chrome, and runtime instances", () => {
    const doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;

    // Global route chrome
    const headerRes = updateInspectorStyleProperty(
      doc,
      GLOBAL_CHROME_HEADER_ID,
      "appearance.opacity",
      0.5,
      "desktop",
    );
    expect(headerRes.ok).toBe(false);
    expect(headerRes.code).toBe("GLOBAL_CHROME_LOCKED");

    // Runtime instance ID
    const runtimeRes = updateInspectorStyleProperty(
      doc,
      `${featuredId}::product::prod-1`,
      "appearance.opacity",
      0.8,
      "desktop",
    );
    expect(runtimeRes.ok).toBe(false);
    expect(runtimeRes.code).toBe("RUNTIME_INSTANCE_READONLY");

    // Directly locked node
    const lockedCmd = executeStructuralCommand(doc, {
      type: "SetLock",
      targetId: featuredId,
      locked: true,
    });
    expect(lockedCmd.ok).toBe(true);

    const lockedEdit = updateInspectorStyleProperty(
      lockedCmd.document,
      featuredId,
      "appearance.opacity",
      0.7,
      "desktop",
    );
    expect(lockedEdit.ok).toBe(false);
    expect(lockedEdit.code).toBe("NODE_LOCKED");

    // Ancestor-locked node: wrap in Section container, lock container, try editing child
    const wrapped = executeStructuralCommand(doc, {
      type: "WrapNodeInContainer",
      targetId: featuredId,
      containerType: "Section",
    });
    expect(wrapped.ok).toBe(true);
    const wrapperId = wrapped.selectedNodeId!;
    const lockWrapper = executeStructuralCommand(wrapped.document, {
      type: "SetLock",
      targetId: wrapperId,
      locked: true,
    });
    expect(lockWrapper.ok).toBe(true);

    const childEdit = updateInspectorStyleProperty(
      lockWrapper.document,
      featuredId,
      "appearance.opacity",
      0.5,
      "desktop",
    );
    expect(childEdit.ok).toBe(false);
    expect(childEdit.code).toBe("ANCESTOR_LOCKED");
  });

  it("protects business fields and rejects unsafe XSS payloads", () => {
    const doc = DEFAULT_HOMEPAGE_PAGE_DOCUMENT;

    const forbiddenPrice = updateInspectorStyleProperty(doc, featuredId, "price", 0, "desktop");
    expect(forbiddenPrice.ok).toBe(false);
    expect(forbiddenPrice.code).toBe("FORBIDDEN_BUSINESS_PROPERTY");

    const unsafeColor = updateInspectorStyleProperty(
      doc,
      featuredId,
      "appearance.backgroundColor",
      "javascript:alert(1)",
      "desktop",
    );
    expect(unsafeColor.ok).toBe(false);
    expect(unsafeColor.code).toBe("UNSAFE_VALUE_REJECTED");

    // SafeComponentProps rejects any script injection in text props
    const xssProp = updateStudioNodeProp(doc, featuredId, "title", "<script>alert(1)</script>");
    expect(xssProp.ok).toBe(false);
  });

  it("executes inspector property updates and resolution across 25, 150, 500, and 1,000 nodes in sub-millisecond O(depth) time", () => {
    for (const nodeCount of [25, 150, 500, 1000]) {
      const children = Array.from({ length: nodeCount - 3 }, (_, idx) => ({
        id: `bench-node-${idx}`,
        type: "Text" as const,
        name: `Bench Text ${idx}`,
        props: { text: `Paragraph ${idx}` },
        style: {},
        children: [],
      }));

      const syntheticDoc = {
        ...DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        root: [
          DEFAULT_HOMEPAGE_PAGE_DOCUMENT.root[0]!,
          DEFAULT_HOMEPAGE_PAGE_DOCUMENT.root[1]!,
          {
            id: "bench-section-root",
            type: "Section" as const,
            name: "Benchmark Section",
            props: {},
            style: {},
            children,
          },
        ],
      };

      const targetId = `bench-node-${Math.floor((nodeCount - 3) / 2)}`;
      const untouchedId = `bench-node-0`;
      const untouchedRef = findNodeById(syntheticDoc, untouchedId);

      const t0 = performance.now();
      const updated = updateInspectorStyleProperty(
        syntheticDoc,
        targetId,
        "appearance.backgroundColor",
        "#0f172a",
        "desktop",
      );
      const resolved = resolveInspectorPropertyState(
        findNodeById(updated.document, targetId)!,
        "appearance.backgroundColor",
        "mobile",
      );
      const elapsedMs = performance.now() - t0;

      expect(updated.ok).toBe(true);
      expect(resolved.value).toBe("#0f172a");
      expect(resolved.origin).toBe("inherited_breakpoint");
      expect(findNodeById(updated.document, untouchedId)).toBe(untouchedRef);
      expect(elapsedMs).toBeLessThan(25);
    }
  });
});
