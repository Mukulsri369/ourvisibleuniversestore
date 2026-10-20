import { describe, expect, it } from "vitest";
import {
  COMPONENT_TYPES,
  DuplicateComponentRegistrationError,
  VisualComponentRegistry,
  createDefaultComponentRegistry,
  defaultComponentRegistry,
  detectUnsupportedStyleOverrides,
} from "../index";

describe("Prompt 6 — VisualComponentRegistry Unit & Security Tests", () => {
  it("1. registers all 31 supported component types deterministically across categories", () => {
    const allRegistered = defaultComponentRegistry.listComponents();
    expect(allRegistered).toHaveLength(COMPONENT_TYPES.length);
    expect(allRegistered.map((d) => d.type)).toEqual([...COMPONENT_TYPES]);

    const basic = defaultComponentRegistry.listComponents({ category: "basic" });
    const layout = defaultComponentRegistry.listComponents({ category: "layout" });
    const storefront = defaultComponentRegistry.listComponents({ category: "storefront" });
    const section = defaultComponentRegistry.listComponents({ category: "section" });

    expect(basic.length).toBe(9);
    expect(layout.length).toBe(6);
    expect(storefront.length).toBe(8);
    expect(section.length).toBe(8);
  });

  it("2. fails safely for unknown component types", () => {
    expect(defaultComponentRegistry.hasComponent("NonExistentWidget")).toBe(false);
    expect(defaultComponentRegistry.getComponent("NonExistentWidget")).toBeUndefined();
    expect(defaultComponentRegistry.resolveComponentRenderer("NonExistentWidget")).toBeUndefined();
    expect(defaultComponentRegistry.getTrustedCapabilities("NonExistentWidget")).toBeUndefined();
    expect(defaultComponentRegistry.getSupportedSlots("NonExistentWidget")).toEqual([]);
    expect(defaultComponentRegistry.canAcceptChild("NonExistentWidget", "Text")).toBe(false);
  });

  it("3. prevents accidental duplicate component registration", () => {
    const registry = createDefaultComponentRegistry();
    const existing = registry.getComponent("ProductCard")!;

    expect(() =>
      registry.registerComponent({
        type: "ProductCard",
        adapter: existing.adapter,
      }),
    ).toThrow(DuplicateComponentRegistrationError);

    // Explicit override option succeeds for isolated test harnesses
    expect(() =>
      registry.registerComponent(
        {
          type: "ProductCard",
          adapter: existing.adapter,
        },
        { allowOverride: true },
      ),
    ).not.toThrow();
  });

  it("4. provides cloned default properties, styles, and bindings without shared mutable references", () => {
    const defaultsA = defaultComponentRegistry.getDefaultConfiguration("ProductScrollRail");
    const defaultsB = defaultComponentRegistry.getDefaultConfiguration("ProductScrollRail");

    expect(defaultsA.props.title).toBe("Featured");
    expect(defaultsA.binding?.kind).toBe("product_collection");

    defaultsA.props.title = "Mutated Title";
    expect(defaultsB.props.title).toBe("Featured");
  });

  it("5. enforces trusted capabilities as immutable authority that cannot be overridden by page JSON", () => {
    const productCardCaps = defaultComponentRegistry.getTrustedCapabilities("ProductCard")!;
    expect(Object.isFrozen(productCardCaps)).toBe(true);
    expect(productCardCaps.protectedBusinessFields).toContain("price");
    expect(productCardCaps.protectedBusinessFields).toContain("affiliate_url");
    expect(productCardCaps.protectedBusinessFields).toContain("amazon_url");

    expect(() => {
      (productCardCaps as unknown as Record<string, unknown>).isLeaf = false;
    }).toThrow();

    // Node JSON attempting to inject custom capabilities or forbidden business fields is rejected
    const maliciousNode = {
      id: "node-card-malicious",
      type: "ProductCard",
      name: "Tampered Card",
      capabilities: { isLeaf: false, protectedBusinessFields: [] },
      props: {
        compact: true,
        price: 1.99,
        affiliate_url: "https://evil.example.com",
      },
      style: {},
      children: [],
    };

    const validation = defaultComponentRegistry.validateNodeConfiguration(maliciousNode);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("Protected business property"))).toBe(true);
    expect(
      validation.errors.some((e) => e.includes("cannot define or override component capabilities")),
    ).toBe(true);
  });

  it("6. validates parent/child and slot relationships accurately", () => {
    // Leaf components cannot accept children
    expect(defaultComponentRegistry.canAcceptChild("ProductCard", "Text")).toBe(false);
    expect(defaultComponentRegistry.canAcceptChild("CelestialScrollWorld", "Section")).toBe(false);

    // Root-only components cannot be nested inside a Container or Section
    expect(defaultComponentRegistry.canAcceptChild("Section", "PlanetHero")).toBe(false);
    expect(defaultComponentRegistry.canAcceptChild("Container", "StoreHeader")).toBe(false);
    expect(defaultComponentRegistry.canAcceptChild("Container", "CelestialScrollWorld")).toBe(
      false,
    );

    // Section supports "header" and "footer" named slots
    const sectionSlots = defaultComponentRegistry.getSupportedSlots("Section");
    expect(sectionSlots.map((s) => s.slotName)).toEqual(["header", "footer"]);
    expect(defaultComponentRegistry.canAcceptChild("Section", "Heading", "header")).toBe(true);
    expect(defaultComponentRegistry.canAcceptChild("Section", "Heading", "nonexistent_slot")).toBe(
      false,
    );
  });

  it("7. reports unsupported style overrides explicitly rather than failing silently", () => {
    const warnings = detectUnsupportedStyleOverrides("CelestialScrollWorld", {
      geometry: {
        width: { unit: "px", value: 500 },
      },
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("CelestialScrollWorld");
    expect(warnings[0]).toContain("geometry");
  });

  it("8. rejects incompatible data binding kinds for a component type", () => {
    const invalidBindingNode = {
      id: "node-text-invalid-binding",
      type: "Text",
      name: "Text with Product Binding",
      props: { text: "Hello" },
      style: {},
      binding: {
        kind: "product_collection",
        source: "featured",
        sortMode: "default_preserve_order",
        limit: 6,
      },
      children: [],
    };

    const result = defaultComponentRegistry.validateNodeConfiguration(invalidBindingNode);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("does not support binding kind"))).toBe(true);
  });
});
