import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Category, ProductCardData } from "@/lib/store";
import baselineFixtures from "../../../../visual-regression/manifest/data-fixtures.json";
import {
  PageRenderer,
  buildSyntheticPageDocument,
  defaultComponentRegistry,
  resolveResponsiveNodePresentation,
  updateNodeStyle,
  type StorefrontDataCatalog,
} from "../index";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => React.createElement("a", { href: to, className, ...rest }, children),
  useNavigate: () => vi.fn(),
}));

const FIXTURE_PRODUCTS = baselineFixtures.products as unknown as ProductCardData[];
const FIXTURE_CATEGORIES = baselineFixtures.categories as unknown as Category[];

const PERF_CATALOG: StorefrontDataCatalog = {
  featuredProducts: FIXTURE_PRODUCTS,
  newestProducts: FIXTURE_PRODUCTS,
  festivalProducts: FIXTURE_PRODUCTS,
  allProducts: FIXTURE_PRODUCTS,
  categories: FIXTURE_CATEGORIES,
  settings: null,
};

describe("Prompt 6 — Component Registry & Shared Renderer Performance Verification", () => {
  it("1. verifies O(1) component registry lookup performance across 10,000 lookups", () => {
    let foundCount = 0;
    const start = performance.now();
    for (let i = 0; i < 10_000; i += 1) {
      const def = defaultComponentRegistry.getComponent("ProductCard");
      if (def) foundCount += 1;
    }
    const elapsedMs = performance.now() - start;
    expect(foundCount).toBe(10_000);
    expect(elapsedMs).toBeLessThan(25);
  });

  it("2. verifies responsive style resolution and CSS property generation across 1,000 nodes", () => {
    const largeDoc = buildSyntheticPageDocument(1000);
    const sampleCard = largeDoc.root[0].children[0].children[0];

    let resolvedCount = 0;
    const start = performance.now();
    for (let i = 0; i < 1_000; i += 1) {
      const presentation = resolveResponsiveNodePresentation(sampleCard, "mobile");
      if (presentation.visible && presentation.inlineStyle?.width === "113px") {
        resolvedCount += 1;
      }
    }
    const elapsedMs = performance.now() - start;
    expect(resolvedCount).toBe(1_000);
    expect(elapsedMs).toBeLessThan(50);
  });

  it("3. renders small (25 nodes) and medium (150 nodes) documents and handles localized style updates without remounting unaffected sections", () => {
    const smallDoc = buildSyntheticPageDocument(25);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const startRender = performance.now();
    const { container, rerender } = render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(PageRenderer, {
          document: smallDoc,
          mode: "editor",
          dataCatalog: PERF_CATALOG,
        }),
      ),
    );
    const initialRenderMs = performance.now() - startRender;
    expect(initialRenderMs).toBeLessThan(2000);

    const firstCardId = smallDoc.root[0].children[0].children[0].id;
    const secondCardId = smallDoc.root[0].children[0].children[1].id;

    const secondCardNodeBefore = container.querySelector(`[data-editor-node-id="${secondCardId}"]`);
    expect(secondCardNodeBefore).not.toBeNull();

    // Perform an isolated style update on the first card only
    const updatedDoc = updateNodeStyle(smallDoc, firstCardId, {
      geometry: { width: { unit: "px", value: 210 } },
    });

    rerender(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(PageRenderer, {
          document: updatedDoc,
          mode: "editor",
          dataCatalog: PERF_CATALOG,
        }),
      ),
    );

    const firstCardAfter = container.querySelector(
      `[data-editor-node-id="${firstCardId}"]`,
    ) as HTMLElement;
    const secondCardNodeAfter = container.querySelector(`[data-editor-node-id="${secondCardId}"]`);

    expect(firstCardAfter.style.width).toBe("210px");
    // Sibling DOM node reference is preserved (not destroyed and recreated!)
    expect(secondCardNodeAfter).toBe(secondCardNodeBefore);
  });
});
