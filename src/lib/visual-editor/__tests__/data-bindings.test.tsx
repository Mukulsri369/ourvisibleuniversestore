import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as storeModule from "@/lib/store";
import type { Category, ProductCardData } from "@/lib/store";
import baselineFixtures from "../../../../visual-regression/manifest/data-fixtures.json";
import {
  CURRENT_PAGE_SCHEMA_VERSION,
  PageRenderer,
  resolveProductCollection,
  type EditorNode,
  type PageDocument,
  type StorefrontDataCatalog,
} from "../index";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    className?: string;
  }) => {
    const resolvedHref = params?.slug ? to.replace("$slug", params.slug) : to;
    const query = search ? `?${new URLSearchParams(search).toString()}` : "";
    return (
      <a href={`${resolvedHref}${query}`} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

const FIXTURE_PRODUCTS = baselineFixtures.products as unknown as ProductCardData[];
const FIXTURE_CATEGORIES = baselineFixtures.categories as unknown as Category[];

function createFrozenCatalog(): StorefrontDataCatalog {
  const frozenProducts = Object.freeze(FIXTURE_PRODUCTS.map((p) => Object.freeze({ ...p })));
  const frozenCategories = Object.freeze(FIXTURE_CATEGORIES.map((c) => Object.freeze({ ...c })));
  return Object.freeze({
    featuredProducts: frozenProducts,
    newestProducts: frozenProducts,
    festivalProducts: frozenProducts,
    allProducts: frozenProducts,
    categories: frozenCategories,
    settings: null,
  });
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Prompt 6 — Data-Binding Safety & Interaction Policy Protection Tests", () => {
  it("1. preserves product titles, prices, IDs, and affiliate URLs unchanged regardless of visual styling", () => {
    const frozenCatalog = createFrozenCatalog();
    const targetProduct = frozenCatalog.featuredProducts[0];

    const styledCardNode: EditorNode = {
      id: "node-styled-card",
      type: "ProductCard",
      name: "Heavily Styled Card",
      props: { compact: false },
      style: {
        geometry: {
          width: { unit: "px", value: 320 },
          padding: { top: 12, right: 12, bottom: 12, left: 12, unit: "px" },
        },
        shape: {
          shapeType: "rounded-rectangle",
          cornerRadius: { mode: "uniform", unit: "px", uniform: 24 },
        },
        appearance: {
          backgroundColor: "#111827",
          shadow: { preset: "glow" },
        },
      },
      binding: {
        kind: "single_product",
        productId: targetProduct.id,
      },
      children: [],
    };

    const doc: PageDocument = {
      id: "doc-binding-safety",
      pageId: "page-binding",
      pageType: "home",
      slug: "/",
      schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
      name: "Binding Safety Test",
      metadata: {
        createdAt: "2026-10-20T15:00:00.000Z",
        updatedAt: "2026-10-20T15:00:00.000Z",
      },
      root: [styledCardNode],
    };

    renderWithQuery(<PageRenderer document={doc} mode="public" dataCatalog={frozenCatalog} />);

    expect(screen.getByText(targetProduct.name)).toBeTruthy();
    const expectedPrice = storeModule.formatPrice(targetProduct.price, targetProduct.currency)!;
    expect(screen.getByText(expectedPrice)).toBeTruthy();

    const buyLink = screen.getByRole("link", { name: /^Buy$/i });
    expect(buyLink.getAttribute("href")).toBe(targetProduct.affiliate_url);
    expect(buyLink.getAttribute("rel")).toBe("nofollow sponsored noopener noreferrer");
  });

  it("2. blocks outbound affiliate click tracking and navigation in editor and preview modes while allowing them in public mode", () => {
    const clickSpy = vi.spyOn(storeModule, "logOutboundClick").mockImplementation(() => {});

    const frozenCatalog = createFrozenCatalog();
    const targetProduct = frozenCatalog.featuredProducts[0];
    const onSelectNode = vi.fn();

    const cardNode: EditorNode = {
      id: "node-interactive-card",
      type: "ProductCard",
      name: "Interactive Card",
      props: { compact: true },
      style: {},
      binding: {
        kind: "single_product",
        productId: targetProduct.id,
      },
      children: [],
    };

    const doc: PageDocument = {
      id: "doc-interaction-policy",
      pageId: "page-interaction",
      pageType: "home",
      slug: "/",
      schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
      name: "Interaction Policy Test",
      metadata: {
        createdAt: "2026-10-20T15:00:00.000Z",
        updatedAt: "2026-10-20T15:00:00.000Z",
      },
      root: [cardNode],
    };

    // 1. Editor mode: clicking Buy selects the node and NEVER triggers logOutboundClick
    const { unmount: unmountEditor } = renderWithQuery(
      <PageRenderer
        document={doc}
        mode="editor"
        dataCatalog={frozenCatalog}
        onSelectNode={onSelectNode}
      />,
    );
    const editorBuyLink = screen.getByRole("link", {
      name: new RegExp(`Buy ${targetProduct.name}`, "i"),
    });
    fireEvent.click(editorBuyLink);
    expect(onSelectNode).toHaveBeenCalledWith("node-interactive-card");
    expect(clickSpy).not.toHaveBeenCalled();
    unmountEditor();

    // 2. Preview mode: clicking Buy is intercepted and NEVER triggers logOutboundClick
    const { unmount: unmountPreview } = renderWithQuery(
      <PageRenderer document={doc} mode="preview" dataCatalog={frozenCatalog} />,
    );
    const previewBuyLink = screen.getByRole("link", {
      name: new RegExp(`Buy ${targetProduct.name}`, "i"),
    });
    fireEvent.click(previewBuyLink);
    expect(clickSpy).not.toHaveBeenCalled();
    unmountPreview();

    // 3. Public mode: clicking Buy triggers logOutboundClick normally
    renderWithQuery(<PageRenderer document={doc} mode="public" dataCatalog={frozenCatalog} />);
    const publicBuyLink = screen.getByRole("link", {
      name: new RegExp(`Buy ${targetProduct.name}`, "i"),
    });
    fireEvent.click(publicBuyLink);
    expect(clickSpy).toHaveBeenCalledWith(targetProduct.id);

    clickSpy.mockRestore();
  });

  it("3. verifies product collection sorting and curated ordering never mutate frozen source arrays", () => {
    const frozenCatalog = createFrozenCatalog();

    // Curated IDs in reverse order
    const reverseIds = [...frozenCatalog.allProducts].reverse().map((p) => p.id);

    const curated = resolveProductCollection(
      {
        kind: "product_collection",
        source: "curated_ids",
        curatedProductIds: reverseIds,
        sortMode: "default_preserve_order",
        limit: 10,
      },
      frozenCatalog,
    );

    expect(curated.map((p) => p.id)).toEqual(reverseIds);

    // Deterministic shuffle with same seed produces identical order across calls
    const shuffled1 = resolveProductCollection(
      {
        kind: "product_collection",
        source: "featured",
        sortMode: "deterministic_shuffle",
        deterministicSeed: 777,
        limit: 10,
      },
      frozenCatalog,
    );
    const shuffled2 = resolveProductCollection(
      {
        kind: "product_collection",
        source: "featured",
        sortMode: "deterministic_shuffle",
        deterministicSeed: 777,
        limit: 10,
      },
      frozenCatalog,
    );
    expect(shuffled1.map((p) => p.id)).toEqual(shuffled2.map((p) => p.id));
  });
});
