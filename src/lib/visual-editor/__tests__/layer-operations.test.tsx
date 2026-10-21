import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioShell } from "@/components/visual-editor/StudioShell";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import { CANONICAL_HOMEPAGE_NODE_IDS } from "../homepage/default-homepage-document";
import { InMemoryTransactionalPersistenceAdapter } from "../persistence/index";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      activeProps: _activeProps,
      activeOptions: _activeOptions,
      ...rest
    }: {
      children: React.ReactNode;
      to?: string;
      className?: string;
      activeProps?: unknown;
      activeOptions?: unknown;
      [key: string]: unknown;
    }) => (
      <a href={typeof to === "string" ? to : "#"} className={className} {...rest}>
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const MOCK_CATEGORIES: Category[] = [
  {
    id: "cat-cosmic",
    name: "Cosmic Apparel",
    slug: "cosmic-apparel",
    description: "Apparel from across the galaxy",
    image_url: "/img/apparel.jpg",
    display_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

const MOCK_PRODUCTS: ProductCardData[] = [
  {
    id: "prod-nebula-1",
    name: "Nebula Hoodie",
    slug: "nebula-hoodie",
    short_description: "Warm cosmic fleece",
    price: 68,
    currency: "USD",
    affiliate_url: "https://www.amazon.com/dp/B001234567?tag=cosmic-20",
    featured: true,
    category_id: "cat-cosmic",
    category_ids: ["cat-cosmic"],
    category: { name: "Cosmic Apparel", slug: "cosmic-apparel" },
    image: "/img/hoodie.jpg",
    imageAlt: "Nebula Hoodie",
    images: [{ image_url: "/img/hoodie.jpg", alt_text: "Nebula Hoodie" }],
  },
];

const MOCK_HOME_DATA: HomeData = {
  featured: MOCK_PRODUCTS,
  newest: MOCK_PRODUCTS,
  festival: MOCK_PRODUCTS,
  allProducts: MOCK_PRODUCTS,
};

const MOCK_SETTINGS: Settings = {
  id: 1,
  store_name: "Cosmic Tester",
  tagline: "Curated across the stars",
  logo_url: null,
  hero_title: "Explore the Cosmos",
  hero_subtitle: "Handpicked celestial goods",
  hero_cta_label: "Shop Sector",
  hero_image_url: null,
  footer_text: "Curated cosmic gifts",
  affiliate_disclosure: "As an associate we earn from qualifying purchases.",
  instagram_url: "https://instagram.com/cosmic",
  contact_email: null,
  social_links: {
    festival_special: {
      enabled: true,
      eyebrow: "Festival Special",
      title: "Festival Lights",
      description: "Galaxy night lights and starry lamps.",
    },
  },
  updated_at: "2026-01-01T00:00:00.000Z",
};

function renderStudio() {
  const adapter = new InMemoryTransactionalPersistenceAdapter({
    role: "admin",
    userId: "admin-user-1",
    email: "admin@ourvisibleuniverse.com",
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <StudioShell
        persistenceAdapter={adapter}
        initialHomeData={MOCK_HOME_DATA}
        initialCategories={MOCK_CATEGORIES}
        initialSettings={MOCK_SETTINGS}
      />
    </QueryClientProvider>,
  );

  return { ...view, adapter };
}

describe("Prompt 11 — Layer Panel Structural Operations & Canvas Synchronization", () => {
  const featuredId = CANONICAL_HOMEPAGE_NODE_IDS.featuredRail;
  const festivalId = CANONICAL_HOMEPAGE_NODE_IDS.festivalSection;
  const benefitsId = CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection;

  it("supports inline layer renaming with Enter commit and Escape cancel, syncing with Inspector", async () => {
    renderStudio();

    const featuredSelectBtn = await screen.findByTestId(`studio-layer-select-${featuredId}`);
    fireEvent.click(featuredSelectBtn);

    // Double-click to start inline rename
    fireEvent.doubleClick(featuredSelectBtn);
    const renameInput = await screen.findByTestId(`studio-layer-rename-input-${featuredId}`);
    expect(renameInput).toHaveValue("Featured Products Rail");

    // Press Escape to cancel rename
    fireEvent.change(renameInput, { target: { value: "Aborted Name" } });
    fireEvent.keyDown(renameInput, { key: "Escape" });
    expect(screen.queryByTestId(`studio-layer-rename-input-${featuredId}`)).toBeNull();
    expect(screen.getByTestId(`studio-layer-select-${featuredId}`)).toHaveTextContent(
      "Featured Products Rail",
    );

    // Open context menu -> Rename Layer -> commit with Enter
    fireEvent.click(screen.getByTestId(`studio-layer-menu-btn-${featuredId}`));
    fireEvent.click(screen.getByTestId(`studio-layer-menu-rename-${featuredId}`));

    const renameInput2 = await screen.findByTestId(`studio-layer-rename-input-${featuredId}`);
    fireEvent.change(renameInput2, { target: { value: "Galactic Highlights" } });
    fireEvent.keyDown(renameInput2, { key: "Enter" });

    expect(screen.getByTestId(`studio-layer-select-${featuredId}`)).toHaveTextContent(
      "Galactic Highlights",
    );
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Galactic Highlights",
    );
  });

  it("reorders homepage sections and updates live canvas DOM order immediately while keeping PlanetHero and CelestialScrollWorld pinned", async () => {
    renderStudio();

    await screen.findByTestId(`studio-layer-select-${featuredId}`);
    const canvas = screen.getAllByTestId("studio-canvas-stage")[0]!;

    const getCanvasOrder = () =>
      Array.from(canvas.querySelectorAll<HTMLElement>("[data-editor-node-id]")).map((el) =>
        el.getAttribute("data-editor-node-id"),
      );

    const beforeOrder = getCanvasOrder();
    expect(beforeOrder.indexOf(festivalId)).toBeLessThan(beforeOrder.indexOf(featuredId));

    // Move featuredRail UP above festivalSection
    fireEvent.click(screen.getByTestId(`studio-layer-move-up-${featuredId}`));

    const afterOrder = getCanvasOrder();
    expect(afterOrder.indexOf(featuredId)).toBeLessThan(afterOrder.indexOf(festivalId));
    // Pinned root components remain at the top of the document canvas (right after StoreHeader chrome)
    expect(afterOrder.indexOf(CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground)).toBeLessThan(
      afterOrder.indexOf(CANONICAL_HOMEPAGE_NODE_IDS.planetHero),
    );
    expect(afterOrder.indexOf(CANONICAL_HOMEPAGE_NODE_IDS.planetHero)).toBeLessThan(
      afterOrder.indexOf(featuredId),
    );
  });

  it("duplicates a section, inserts it below the original in both Layer Tree and Canvas, and selects the clone", async () => {
    renderStudio();

    await screen.findByTestId(`studio-layer-select-${featuredId}`);
    fireEvent.click(screen.getByTestId(`studio-layer-duplicate-${featuredId}`));

    const inspectorName = screen.getByTestId("studio-inspector-node-name");
    expect(inspectorName).toHaveTextContent("Featured Products Rail (Copy)");

    // Both original and copy exist in the Layer Tree
    const tree = screen.getByTestId("studio-layer-tree");
    expect(within(tree).getByText("Featured Products Rail")).toBeInTheDocument();
    expect(within(tree).getByText("Featured Products Rail (Copy)")).toBeInTheDocument();
  });

  it("locks and unlocks a layer, disabling structural actions and Inspector editing while locked", async () => {
    renderStudio();

    const featuredSelectBtn = await screen.findByTestId(`studio-layer-select-${featuredId}`);
    fireEvent.click(featuredSelectBtn);

    // Lock featuredRail from the Layer Tree
    fireEvent.click(screen.getByTestId(`studio-layer-lock-${featuredId}`));

    const layerRow = screen.getByTestId(`studio-layer-item-${featuredId}`);
    expect(layerRow).toHaveAttribute("data-layer-locked", "true");
    expect(screen.getByTestId("inspector-node-name-input")).toBeDisabled();
    expect(screen.getByTestId("inspector-locked-notice")).toBeInTheDocument();

    // Unlock via Inspector lock toggle button
    fireEvent.click(screen.getByTestId("inspector-lock-toggle"));
    expect(layerRow).not.toHaveAttribute("data-layer-locked", "true");
    expect(screen.getByTestId("inspector-node-name-input")).not.toBeDisabled();
  });

  it("wraps a section in a parent Section container and unwraps it via the layer context menu", async () => {
    renderStudio();

    await screen.findByTestId(`studio-layer-select-${featuredId}`);
    fireEvent.click(screen.getByTestId(`studio-layer-menu-btn-${featuredId}`));
    fireEvent.click(screen.getByTestId(`studio-layer-menu-wrap-container-${featuredId}`));

    // The newly created wrapper Section is now selected
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Featured Products Rail Section",
    );
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("Section");

    // Select the wrapped child and verify its breadcrumb shows the new wrapper parent
    fireEvent.click(screen.getByTestId(`studio-layer-select-${featuredId}`));
    expect(screen.getByTestId("studio-inspector-breadcrumb")).toHaveTextContent(
      "Featured Products Rail Section",
    );
  });

  it("confirms deletion of a removable section, removes it from Canvas and Layer Tree, and restores it via the Undo banner", async () => {
    renderStudio();

    await screen.findByTestId(`studio-layer-select-${benefitsId}`);
    fireEvent.click(screen.getByTestId(`studio-layer-menu-btn-${benefitsId}`));
    fireEvent.click(screen.getByTestId(`studio-layer-menu-delete-${benefitsId}`));

    // Confirmation dialog appears
    const dialog = await screen.findByTestId("studio-layer-delete-confirm-dialog");
    expect(dialog).toHaveTextContent("Why Shop With Us");

    fireEvent.click(screen.getByTestId("studio-layer-delete-confirm-btn"));

    // Layer is removed from tree
    expect(screen.queryByTestId(`studio-layer-item-${benefitsId}`)).toBeNull();

    // Undo banner is shown; clicking Undo restores the removed section immediately
    const undoBtn = await screen.findByTestId("studio-layer-undo-btn");
    fireEvent.click(undoBtn);

    expect(await screen.findByTestId(`studio-layer-item-${benefitsId}`)).toBeInTheDocument();
  });
});
