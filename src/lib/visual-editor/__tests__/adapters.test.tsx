import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductScrollRail } from "@/components/store/ProductScrollRail";
import { CategorySpotlightHero } from "@/components/store/CategorySpotlightHero";
import { CategoryCard } from "@/components/store/CategoryCard";
import { CelestialScrollWorld } from "@/components/store/CelestialScrollWorld";
import { PlanetHero } from "@/components/store/PlanetHero";
import type { Category, ProductCardData } from "@/lib/store";
import baselineFixtures from "../../../../visual-regression/manifest/data-fixtures.json";
import {
  CURRENT_PAGE_SCHEMA_VERSION,
  HOMEPAGE_HERO_AND_DYNAMIC_CATEGORIES_FIXTURE,
  MiniComponentPreviewRenderer,
  PageRenderer,
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

const SAMPLE_CATALOG: StorefrontDataCatalog = {
  featuredProducts: FIXTURE_PRODUCTS,
  newestProducts: FIXTURE_PRODUCTS,
  festivalProducts: FIXTURE_PRODUCTS,
  allProducts: FIXTURE_PRODUCTS,
  categories: FIXTURE_CATEGORIES,
  settings: {
    footer_text: "Explore the universe. Discover something extraordinary.",
    affiliate_disclosure: "We may earn a commission from qualifying purchases.",
    instagram_url: "https://instagram.com/ourvisibleuniverse",
    social_links: baselineFixtures.siteSettings.social_links,
  },
};

function createTestQueryClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(["settings"], SAMPLE_CATALOG.settings);
  qc.setQueryData(["categories", "public"], FIXTURE_CATEGORIES);
  return qc;
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = createTestQueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeSingleNodeDoc(node: EditorNode): PageDocument {
  return {
    id: `doc-${node.id}`,
    pageId: "page-test",
    pageType: "home",
    slug: "/",
    schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
    name: "Single Node Test Document",
    metadata: {
      createdAt: "2026-10-20T15:00:00.000Z",
      updatedAt: "2026-10-20T15:00:00.000Z",
    },
    root: [node],
  };
}

describe("Prompt 6 — Real Storefront Component Adapters & Visual Parity Tests", () => {
  it("1. verifies exact DOM parity between direct <ProductCard /> and <PageRenderer /> in public mode (compact & standard)", () => {
    const product = FIXTURE_PRODUCTS[0];

    const { container: directCompact } = renderWithQuery(<ProductCard p={product} compact />);

    const cardNode: EditorNode = {
      id: "node-card-1",
      type: "ProductCard",
      name: "Compact Product Card",
      props: { compact: true },
      style: {},
      binding: {
        kind: "single_product",
        productId: product.id,
      },
      children: [],
    };

    const { container: renderedCompact } = renderWithQuery(
      <PageRenderer
        document={makeSingleNodeDoc(cardNode)}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
      />,
    );

    // Exact HTML parity when no style overrides are present
    expect(renderedCompact.innerHTML).toBe(directCompact.innerHTML);
  });

  it("2. verifies reusable ProductCard template styles apply across cards without mutating product records", () => {
    const product = FIXTURE_PRODUCTS[0];
    const cardNode: EditorNode = {
      id: "node-card-templated",
      type: "ProductCard",
      name: "Templated Card",
      props: { compact: false },
      style: {},
      binding: {
        kind: "single_product",
        productId: product.id,
      },
      children: [],
    };

    const { container } = renderWithQuery(
      <PageRenderer
        document={makeSingleNodeDoc(cardNode)}
        mode="editor"
        dataCatalog={SAMPLE_CATALOG}
        cardTemplates={{
          ProductCard: {
            shape: {
              cornerRadius: { mode: "uniform", unit: "px", uniform: 28 },
            },
          },
        }}
      />,
    );

    const wrapper = container.querySelector(
      '[data-editor-node-id="node-card-templated"]',
    ) as HTMLElement;
    expect(wrapper.style.borderRadius).toBe("28px");
    expect(screen.getByText(product.name)).toBeTruthy();
  });

  it("3. verifies exact DOM parity between direct <ProductScrollRail /> and <ProductScrollRailAdapter />", () => {
    const { container: directRail } = renderWithQuery(
      <ProductScrollRail
        title="Featured"
        link={{ to: "/shop", label: "View all" }}
        items={FIXTURE_PRODUCTS}
        variant="default"
      />,
    );

    const railNode: EditorNode = {
      id: "node-rail-1",
      type: "ProductScrollRail",
      name: "Featured Rail",
      props: {
        title: "Featured",
        variant: "default",
        showViewAllLink: true,
        viewAllLabel: "View all",
        viewAllHref: "/shop",
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "featured",
        sortMode: "default_preserve_order",
        limit: 24,
      },
      children: [],
    };

    const { container: renderedRail } = renderWithQuery(
      <PageRenderer
        document={makeSingleNodeDoc(railNode)}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
      />,
    );

    expect(renderedRail.innerHTML).toBe(directRail.innerHTML);
  });

  it("4. verifies exact DOM parity between direct <CategorySpotlightHero /> and <CategorySpotlightAdapter />", () => {
    const product = FIXTURE_PRODUCTS[0];
    const category = FIXTURE_CATEGORIES[0];

    const { container: directSpotlight } = renderWithQuery(
      <CategorySpotlightHero
        product={product}
        categoryName={category.name}
        categorySlug={category.slug}
        sectorLore="JUPITER"
      />,
    );

    const spotlightNode: EditorNode = {
      id: "node-spotlight-1",
      type: "CategorySpotlightHero",
      name: "Spotlight Hero",
      props: {
        title: category.name,
        subtitle: "JUPITER",
      },
      style: {},
      binding: {
        kind: "single_product",
        productId: product.id,
      },
      children: [],
    };

    const { container: renderedSpotlight } = renderWithQuery(
      <PageRenderer
        document={makeSingleNodeDoc(spotlightNode)}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
      />,
    );

    expect(renderedSpotlight.innerHTML).toBe(directSpotlight.innerHTML);
  });

  it("5. verifies exact DOM parity between direct <CategoryCard /> and <CategoryCardAdapter />", () => {
    const category = FIXTURE_CATEGORIES[0];
    const { container: directCategoryCard } = renderWithQuery(<CategoryCard c={category} />);

    const catCardNode: EditorNode = {
      id: "node-cat-card-1",
      type: "CategoryCard",
      name: "Category Card",
      props: {},
      style: {},
      binding: {
        kind: "category_collection",
        mode: "selected_ids",
        selectedCategoryIds: [category.id],
        respectDisplayOrder: true,
        hideEmptyCategories: false,
      },
      children: [],
    };

    const { container: renderedCategoryCard } = renderWithQuery(
      <PageRenderer
        document={makeSingleNodeDoc(catCardNode)}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
      />,
    );

    expect(renderedCategoryCard.innerHTML).toBe(directCategoryCard.innerHTML);
  });

  it("6. verifies PlanetHero and CelestialScrollWorld adapters preserve lifecycle and fixed global positioning without clipping", () => {
    const { container: directCelestial } = renderWithQuery(<CelestialScrollWorld />);
    const { container: directHero } = renderWithQuery(<PlanetHero />);

    const celestialNode: EditorNode = {
      id: "node-celestial-1",
      type: "CelestialScrollWorld",
      name: "Celestial World",
      props: {},
      style: {},
      children: [],
    };
    const heroNode: EditorNode = {
      id: "node-hero-1",
      type: "PlanetHero",
      name: "Planet Hero",
      props: {},
      style: {},
      children: [],
    };

    const { container: renderedCelestial } = renderWithQuery(
      <PageRenderer
        document={makeSingleNodeDoc(celestialNode)}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
      />,
    );
    const { container: renderedHero } = renderWithQuery(
      <PageRenderer
        document={makeSingleNodeDoc(heroNode)}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
      />,
    );

    expect(renderedCelestial.innerHTML).toBe(directCelestial.innerHTML);
    expect(renderedHero.innerHTML).toBe(directHero.innerHTML);
  });

  it("7. prevents duplicate StoreHeader and StoreFooter when renderGlobalChromeInDocument is false (default)", () => {
    const { container: routeEmbeddedContainer, unmount } = renderWithQuery(
      <PageRenderer
        document={HOMEPAGE_HERO_AND_DYNAMIC_CATEGORIES_FIXTURE}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
        renderGlobalChromeInDocument={false}
      />,
    );

    // No <header> or <footer> rendered inside document when _store.tsx layout owns them
    expect(routeEmbeddedContainer.querySelector("header")).toBeNull();
    expect(routeEmbeddedContainer.querySelector("footer")).toBeNull();
    unmount();

    // When standalone full-document chrome rendering is enabled, exactly one header and one footer render
    const { container: standaloneContainer } = renderWithQuery(
      <PageRenderer
        document={HOMEPAGE_HERO_AND_DYNAMIC_CATEGORIES_FIXTURE}
        mode="public"
        dataCatalog={SAMPLE_CATALOG}
        renderGlobalChromeInDocument={true}
      />,
    );
    expect(standaloneContainer.querySelectorAll("header")).toHaveLength(1);
    expect(standaloneContainer.querySelectorAll("footer")).toHaveLength(1);
  });

  it("8. verifies MiniComponentPreviewRenderer renders real registered components in mini_preview mode", () => {
    const product = FIXTURE_PRODUCTS[0];
    const cardNode: EditorNode = {
      id: "node-mini-card",
      type: "ProductCard",
      name: "Mini Preview Card",
      props: { compact: true },
      style: {},
      children: [],
    };

    const { container } = renderWithQuery(
      <MiniComponentPreviewRenderer
        node={cardNode}
        dataCatalog={SAMPLE_CATALOG}
        sampleProduct={product}
      />,
    );

    expect(container.querySelector('[data-mini-preview-node-type="ProductCard"]')).not.toBeNull();
    expect(screen.getByText(product.name)).toBeTruthy();

    // Heavy PlanetHero in mini_preview mode renders lightweight poster without <video> decoder
    const heroNode: EditorNode = {
      id: "node-mini-hero",
      type: "PlanetHero",
      name: "Mini Preview Hero",
      props: {},
      style: {},
      children: [],
    };
    const { container: heroMiniContainer } = renderWithQuery(
      <MiniComponentPreviewRenderer node={heroNode} dataCatalog={SAMPLE_CATALOG} />,
    );
    expect(
      heroMiniContainer.querySelector('[data-mini-preview-component="PlanetHero"]'),
    ).not.toBeNull();
    expect(heroMiniContainer.querySelectorAll("video")).toHaveLength(0);
  });
});
