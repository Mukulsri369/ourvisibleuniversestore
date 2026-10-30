// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import { InMemoryTransactionalPersistenceAdapter } from "../persistence/index";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "../homepage/default-homepage-document";
import { PageRenderer } from "../rendering/PageRenderer";
import { StudioShell } from "@/components/visual-editor/StudioShell";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      onClick,
      activeProps: _activeProps,
      activeOptions: _activeOptions,
      ...rest
    }: {
      children: React.ReactNode;
      to?: string;
      className?: string;
      onClick?: React.MouseEventHandler<HTMLAnchorElement>;
      activeProps?: unknown;
      activeOptions?: unknown;
      [key: string]: unknown;
    }) => (
      <a
        href={typeof to === "string" ? to : "#"}
        className={className}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented && typeof to === "string") {
            mockNavigate(to);
          }
        }}
        {...rest}
      >
        {children}
      </a>
    ),
    useNavigate: () => mockNavigate,
  };
});

const SAMPLE_CATEGORIES: Category[] = [
  {
    id: "cat-astro",
    name: "Astronomy Gear",
    slug: "astronomy-gear",
    description: "Stargazing optics",
    image_url: "/img/astro.jpg",
    sort_order: 1,
    created_at: "2026-01-01T00:00:00Z",
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const SAMPLE_PRODUCTS: ProductCardData[] = [
  {
    id: "prod-101",
    name: "Deep Space Refractor 90mm",
    slug: "deep-space-refractor-90mm",
    short_description: "Precision glass optics",
    price: 349,
    currency: "USD",
    affiliate_url: "https://example.com/buy/refractor-90mm",
    featured: true,
    category_id: "cat-astro",
    category_ids: ["cat-astro"],
    category: { name: "Astronomy Gear", slug: "astronomy-gear" },
    image: "/img/refractor.jpg",
    imageAlt: "Deep Space Refractor 90mm",
    images: [{ image_url: "/img/refractor.jpg", alt_text: "Deep Space Refractor 90mm" }],
    created_at: "2026-01-01T00:00:00Z",
  },
];

const SAMPLE_HOME: HomeData = {
  featured: SAMPLE_PRODUCTS,
  newest: SAMPLE_PRODUCTS,
  festival: SAMPLE_PRODUCTS,
  allProducts: SAMPLE_PRODUCTS,
};

const SAMPLE_SETTINGS: Settings = {
  id: 1,
  store_name: "Our Visible Universe",
  logo_url: null,
  footer_text: "Footer copy",
  affiliate_disclosure: "Disclosure",
  instagram_url: "https://instagram.com/ovu",
  contact_email: null,
  social_links: {},
  updated_at: "2026-01-01T00:00:00Z",
};

function renderStudio() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const adapter = new InMemoryTransactionalPersistenceAdapter({
    role: "admin",
    userId: "admin-1",
    email: "admin@ourvisibleuniverse.com",
  });

  return render(
    <QueryClientProvider client={qc}>
      <StudioShell
        persistenceAdapter={adapter}
        initialHomeData={SAMPLE_HOME}
        initialCategories={SAMPLE_CATEGORIES}
        initialSettings={SAMPLE_SETTINGS}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mockNavigate.mockReset();
  vi.restoreAllMocks();
});

describe("Prompt 10 — Interaction Safety, Nested ProductCard Drill-Down & Public Storefront Isolation", () => {
  it("supports container-first selection on first click and ProductCard instance drill-down on second click without triggering navigation", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderStudio();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    const stage = screen.getAllByTestId("studio-canvas-stage")[0];
    const productCardInstance = stage.querySelector<HTMLElement>(
      `[data-editor-instance-id="${CANONICAL_HOMEPAGE_NODE_IDS.featuredRail}::product::prod-101"]`,
    );
    expect(productCardInstance).not.toBeNull();

    // 1st click on the ProductCard inside Featured Products selects the parent section container first
    fireEvent.click(productCardInstance!);
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent("Featured Products");
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent(
      "FeaturedCollection",
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();

    // 2nd click on the same ProductCard inside the already-active section drills down to the ProductCard instance
    fireEvent.click(productCardInstance!);
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Product Card (Deep Space Refractor 90mm)",
    );
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("ProductCard");
    expect(screen.getByTestId("studio-inspector-runtime-instance-banner")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();

    // Clicking the parent button in the Inspector header returns selection to the parent Featured Products section
    fireEvent.click(screen.getByTestId("studio-inspector-select-parent-btn"));
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent("Featured Products");
  });

  it("supports immediate ProductCard drill-down on first click when holding Cmd/Ctrl or Alt", async () => {
    renderStudio();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    const stage = screen.getAllByTestId("studio-canvas-stage")[0];
    const productCardInstance = stage.querySelector<HTMLElement>(
      `[data-editor-instance-id="${CANONICAL_HOMEPAGE_NODE_IDS.featuredRail}::product::prod-101"]`,
    );
    expect(productCardInstance).not.toBeNull();

    // Holding metaKey (Cmd) drills directly into the ProductCard on first click
    fireEvent.click(productCardInstance!, { metaKey: true });
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("ProductCard");
    expect(screen.getByTestId("studio-inspector-runtime-instance-banner")).toBeInTheDocument();
  });

  it("supports arrow-key hierarchy navigation inside StudioLayersPanel", async () => {
    renderStudio();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    // Select Planet Hero in the Layer Tree
    const heroBtn = screen.getByTestId(
      `studio-layer-select-${CANONICAL_HOMEPAGE_NODE_IDS.planetHero}`,
    );
    fireEvent.click(heroBtn);
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("PlanetHero");

    // Press ArrowDown inside studio-layer-tree to select the next visible layer
    const layerTree = screen.getByTestId("studio-layer-tree");
    fireEvent.keyDown(layerTree, { key: "ArrowDown" });
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("FestivalSection");

    // Press ArrowUp to move back to Planet Hero
    fireEvent.keyDown(layerTree, { key: "ArrowUp" });
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("PlanetHero");
  });

  it("emits zero data-editor-node-id or data-editor-instance-id attributes when rendering in public mode", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    const { container } = render(
      <QueryClientProvider client={qc}>
        <PageRenderer
          document={DEFAULT_HOMEPAGE_PAGE_DOCUMENT}
          mode="public"
          dataCatalog={{
            featuredProducts: SAMPLE_PRODUCTS,
            newestProducts: SAMPLE_PRODUCTS,
            festivalProducts: SAMPLE_PRODUCTS,
            allProducts: SAMPLE_PRODUCTS,
            categories: SAMPLE_CATEGORIES,
            settings: SAMPLE_SETTINGS,
          }}
        />
      </QueryClientProvider>,
    );

    expect(container.querySelectorAll("[data-editor-node-id]").length).toBe(0);
    expect(container.querySelectorAll("[data-editor-instance-id]").length).toBe(0);
    expect(container.querySelectorAll("[data-editor-instance-type]").length).toBe(0);
  });
});
