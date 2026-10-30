import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as storeLib from "@/lib/store";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import { InMemoryTransactionalPersistenceAdapter } from "../persistence/index";
import { CANONICAL_HOMEPAGE_NODE_IDS } from "../homepage/default-homepage-document";
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
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
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
    created_at: "2026-01-01T00:00:00Z",
    featured: true,
    category_id: "cat-astro",
    category_ids: ["cat-astro"],
    category: { name: "Astronomy Gear", slug: "astronomy-gear" },
    image: "/img/refractor.jpg",
    imageAlt: "Deep Space Refractor 90mm",
    images: [{ image_url: "/img/refractor.jpg", alt_text: "Deep Space Refractor 90mm" }],
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

function renderStudioForSelection() {
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

describe("Prompt 9 — Layer Tree Navigation, Canvas Element Selection & Safe Interaction Policies", () => {
  it("selects nodes via canvas click and layer tree click, updating inspector and selection breadcrumb", async () => {
    renderStudioForSelection();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    // Click "Explore by Interest" in the Layer Tree Navigator
    const interestLayerBtn = screen.getByTestId(
      `studio-layer-select-${CANONICAL_HOMEPAGE_NODE_IDS.interestSection}`,
    );
    fireEvent.click(interestLayerBtn);

    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Explore by Interest",
    );
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("InterestSection");
    expect(screen.getByTestId("studio-status-selection-path")).toHaveTextContent(
      "Explore by Interest",
    );

    // Click directly on the Instagram section inside the live canvas
    const primaryStage = screen.getAllByTestId("studio-canvas-stage")[0];
    const instagramCanvasNode = primaryStage.querySelector<HTMLElement>(
      `[data-editor-node-id="${CANONICAL_HOMEPAGE_NODE_IDS.instagramSection}"]`,
    );
    expect(instagramCanvasNode).not.toBeNull();

    fireEvent.click(instagramCanvasNode!);

    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Instagram Community Banner",
    );
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("InstagramSection");
  });

  it("represents dynamic repeated category sections with stable virtual identities and links to the parent template", async () => {
    renderStudioForSelection();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    const virtualCategoryNodeId = `${CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories}::category::cat-astro`;
    const virtualLayerBtn = screen.getByTestId(`studio-layer-select-${virtualCategoryNodeId}`);
    expect(virtualLayerBtn).toHaveTextContent("Astronomy Gear Sector");

    fireEvent.click(virtualLayerBtn);

    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Astronomy Gear Sector",
    );
    expect(screen.getByTestId("studio-inspector-virtual-category-banner")).toBeInTheDocument();

    // Clicking "Select Parent Template" switches selection to the parent Section template
    fireEvent.click(screen.getByTestId("studio-select-parent-template-btn"));
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Dynamic Category Spotlights & Product Rails",
    );
  });

  it("filters layers by name or component type in the Layer Tree Navigator", async () => {
    renderStudioForSelection();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("studio-layer-search-input");
    fireEvent.change(searchInput, { target: { value: "Instagram" } });

    expect(
      screen.getByTestId(`studio-layer-item-${CANONICAL_HOMEPAGE_NODE_IDS.instagramSection}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`studio-layer-item-${CANONICAL_HOMEPAGE_NODE_IDS.planetHero}`),
    ).not.toBeInTheDocument();
  });

  it("intercepts product and affiliate clicks in Edit and Preview modes without navigating or logging outbound clicks", async () => {
    const outboundSpy = vi
      .spyOn(storeLib, "logOutboundClick")
      .mockImplementation(() => Promise.resolve());

    renderStudioForSelection();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    const primaryStage = screen.getAllByTestId("studio-canvas-stage")[0];
    const featuredRailNode = primaryStage.querySelector<HTMLElement>(
      `[data-editor-node-id="${CANONICAL_HOMEPAGE_NODE_IDS.featuredRail}"]`,
    );
    expect(featuredRailNode).not.toBeNull();

    const buyLink = featuredRailNode!.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/buy/refractor-90mm"]',
    );
    expect(buyLink).not.toBeNull();

    // 1. Click Buy link in Edit mode -> selects containing Featured Products Rail section, blocks navigation & outbound click logging
    fireEvent.click(buyLink!);
    expect(outboundSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Featured Products Rail",
    );

    // 2. Switch to Preview mode -> hides selection overlay, still blocks external affiliate redirects & outbound logging
    fireEvent.click(screen.getByTestId("studio-mode-preview"));
    expect(screen.queryByTestId("studio-selection-overlay-layer")).not.toBeInTheDocument();

    fireEvent.click(buyLink!);
    expect(outboundSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
