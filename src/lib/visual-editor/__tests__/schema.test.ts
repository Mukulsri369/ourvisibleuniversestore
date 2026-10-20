import { describe, expect, it } from "vitest";
import {
  BASIC_SECTION_DOCUMENT_FIXTURE,
  CATEGORY_GRID_DOCUMENT_FIXTURE,
  CURRENT_PAGE_SCHEMA_VERSION,
  HOMEPAGE_HERO_AND_DYNAMIC_CATEGORIES_FIXTURE,
  PRODUCT_COLLECTION_DOCUMENT_FIXTURE,
  checkSchemaVersionCompatibility,
  formatDimensionValue,
  migratePageDocumentPayload,
  parsePageDocument,
  safeParsePageDocument,
} from "../index";

describe("PageDocument Schema & Versioned Validation", () => {
  it("validates all representative valid fixtures (Basic Section, Product Collection, Category Grid, Homepage)", () => {
    const basicResult = safeParsePageDocument(BASIC_SECTION_DOCUMENT_FIXTURE);
    expect(basicResult.success).toBe(true);
    if (basicResult.success) {
      expect(basicResult.stats.nodeCount).toBe(6);
      expect(basicResult.stats.maxDepth).toBe(3);
    }

    const productResult = safeParsePageDocument(PRODUCT_COLLECTION_DOCUMENT_FIXTURE);
    expect(productResult.success).toBe(true);

    const categoryResult = safeParsePageDocument(CATEGORY_GRID_DOCUMENT_FIXTURE);
    expect(categoryResult.success).toBe(true);

    const homepageResult = safeParsePageDocument(HOMEPAGE_HERO_AND_DYNAMIC_CATEGORIES_FIXTURE);
    expect(homepageResult.success).toBe(true);
    if (homepageResult.success) {
      expect(homepageResult.data.root.map((n) => n.type)).toEqual([
        "StoreHeader",
        "CelestialScrollWorld",
        "PlanetHero",
        "FestivalSection",
        "Section",
        "StoreFooter",
      ]);
    }
  });

  it("validates geometry dimensions, min/max constraints, and formats CSS units", () => {
    expect(formatDimensionValue({ unit: "px", value: 182 })).toBe("182px");
    expect(formatDimensionValue({ unit: "%", value: 100 })).toBe("100%");
    expect(formatDimensionValue({ unit: "auto" })).toBe("auto");

    const invalidMinMaxDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    invalidMinMaxDoc.root[0].style.geometry = {
      minWidth: { unit: "px", value: 800 },
      maxWidth: { unit: "px", value: 400 },
    };

    const res = safeParsePageDocument(invalidMinMaxDoc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.issues.some((i) => i.message.includes("minWidth cannot exceed maxWidth"))).toBe(
        true,
      );
    }
  });

  it("validates shape, corner radius, grid, flex, bento, and carousel configurations", () => {
    const parsed = parsePageDocument(CATEGORY_GRID_DOCUMENT_FIXTURE);
    const bentoNode = parsed.root[0];
    expect(bentoNode.style.layout?.mode).toBe("bento");
    expect(bentoNode.style.layout?.bento?.columns).toBe(4);
    expect(bentoNode.style.layout?.bento?.cellSpans).toEqual([
      { itemIndex: 0, colSpan: 2, rowSpan: 2 },
      { itemIndex: 1, colSpan: 2, rowSpan: 1 },
    ]);
    expect(bentoNode.style.shape?.shapeType).toBe("rounded-rectangle");
    expect(bentoNode.style.shape?.cornerRadius?.uniform).toBe(20);
  });

  it("enforces schema version recognition and rejects unsupported versions", () => {
    const validCheck = checkSchemaVersionCompatibility(BASIC_SECTION_DOCUMENT_FIXTURE);
    expect(validCheck.compatible).toBe(true);
    expect(validCheck.version).toBe(CURRENT_PAGE_SCHEMA_VERSION);
    expect(validCheck.requiresMigration).toBe(false);

    const unsupportedDoc = {
      ...BASIC_SECTION_DOCUMENT_FIXTURE,
      schemaVersion: "99.0.0",
    };
    const invalidCheck = checkSchemaVersionCompatibility(unsupportedDoc);
    expect(invalidCheck.compatible).toBe(false);
    expect(invalidCheck.reason).toContain('Unsupported schemaVersion "99.0.0"');

    const migrationResult = migratePageDocumentPayload(unsupportedDoc);
    expect(migrationResult.ok).toBe(false);
  });

  it("rejects invalid bindings when required category or curated product IDs are missing", () => {
    const badBindingDoc = structuredClone(PRODUCT_COLLECTION_DOCUMENT_FIXTURE);
    badBindingDoc.root[0].binding = {
      kind: "product_collection",
      source: "category",
      sortMode: "newest",
      limit: 10,
    };

    const res = safeParsePageDocument(badBindingDoc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.issues.some((i) => i.message.includes("requires categoryId or categorySlug")),
      ).toBe(true);
    }
  });
});
