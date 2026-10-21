import fs from "node:fs";
import path from "node:path";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import { InMemoryTransactionalPersistenceAdapter } from "../persistence/index";
import { StudioShell } from "@/components/visual-editor/StudioShell";

// Mock TanStack Router Link/useNavigate so StudioHeader/StoreChrome/ProductCard render in unit tests without full router mount
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

const SAMPLE_CATEGORIES: Category[] = [
  {
    id: "cat-telescopes",
    name: "Telescopes & Optics",
    slug: "telescopes-optics",
    description: "Deep-sky optical instruments",
    image_url: "/img/telescopes.jpg",
    display_order: 1,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "cat-lamps",
    name: "Celestial Lamps",
    slug: "celestial-lamps",
    description: "Ambient planetary lighting",
    image_url: "/img/lamps.jpg",
    display_order: 2,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const SAMPLE_PRODUCTS: ProductCardData[] = [
  {
    id: "prod-1",
    name: "Orion Nebula Smart Telescope",
    slug: "orion-nebula-smart-telescope",
    short_description: "App-guided apochromatic refractor",
    price: 499,
    currency: "USD",
    affiliate_url: "https://example.com/affiliate/orion-telescope",
    featured: true,
    category_id: "cat-telescopes",
    category_ids: ["cat-telescopes"],
    category: { name: "Telescopes & Optics", slug: "telescopes-optics" },
    image: "/img/orion.jpg",
    imageAlt: "Orion Nebula Smart Telescope",
    images: [{ image_url: "/img/orion.jpg", alt_text: "Orion Nebula Smart Telescope" }],
  },
  {
    id: "prod-2",
    name: "Levitation Moon Lamp Pro",
    slug: "levitation-moon-lamp-pro",
    short_description: "3D-printed magnetic floating lunar globe",
    price: 89,
    currency: "USD",
    affiliate_url: "https://example.com/affiliate/moon-lamp",
    featured: true,
    category_id: "cat-lamps",
    category_ids: ["cat-lamps"],
    category: { name: "Celestial Lamps", slug: "celestial-lamps" },
    image: "/img/moon-lamp.jpg",
    imageAlt: "Levitation Moon Lamp Pro",
    images: [{ image_url: "/img/moon-lamp.jpg", alt_text: "Levitation Moon Lamp Pro" }],
  },
];

const SAMPLE_HOME_DATA: HomeData = {
  featured: SAMPLE_PRODUCTS,
  newest: SAMPLE_PRODUCTS,
  festival: [SAMPLE_PRODUCTS[1]],
  allProducts: SAMPLE_PRODUCTS,
};

const SAMPLE_SETTINGS: Settings = {
  id: 1,
  store_name: "Our Visible Universe",
  tagline: "Explore the cosmos",
  logo_url: null,
  hero_title: null,
  hero_subtitle: null,
  hero_cta_label: null,
  hero_image_url: null,
  footer_text: "Explore the universe. Discover something extraordinary.",
  affiliate_disclosure: "We may earn a commission from qualifying purchases.",
  instagram_url: "https://instagram.com/ourvisibleuniverse",
  contact_email: null,
  social_links: {
    festival_special: {
      enabled: true,
      eyebrow: "Festival Special",
      title: "Festival Lights",
      description: "Galaxy night lights and starry lamps.",
    },
  },
  updated_at: "2026-01-01T00:00:00Z",
};

function renderStudio(adapter?: InMemoryTransactionalPersistenceAdapter) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  const persistenceAdapter =
    adapter ??
    new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

  const onNavigateToAdmin = vi.fn();

  const utils = render(
    <QueryClientProvider client={qc}>
      <StudioShell
        persistenceAdapter={persistenceAdapter}
        initialHomeData={SAMPLE_HOME_DATA}
        initialCategories={SAMPLE_CATEGORIES}
        initialSettings={SAMPLE_SETTINGS}
        onNavigateToAdmin={onNavigateToAdmin}
      />
    </QueryClientProvider>,
  );

  return { ...utils, persistenceAdapter, onNavigateToAdmin };
}

afterEach(() => {
  cleanup();
});

describe("Prompt 9 — Store Design Studio Route, Authorization, Shell & Real Storefront Canvas", () => {
  it("verifies /admin/design route registration, admin navigation entry, and full-screen layout bypass in _admin.tsx", () => {
    const adminRoutePath = path.resolve(process.cwd(), "src/routes/_admin.tsx");
    const designRoutePath = path.resolve(process.cwd(), "src/routes/_admin.admin.design.tsx");

    expect(fs.existsSync(adminRoutePath)).toBe(true);
    expect(fs.existsSync(designRoutePath)).toBe(true);

    const adminRouteSource = fs.readFileSync(adminRoutePath, "utf8");
    const designRouteSource = fs.readFileSync(designRoutePath, "utf8");

    // 1. Admin navigation entry for Design Studio
    expect(adminRouteSource).toContain('to: "/admin/design"');
    expect(adminRouteSource).toContain('label: "Design Studio"');

    // 2. Full-screen workspace bypass for /admin/design (not constrained to max-w-6xl)
    expect(adminRouteSource).toContain("isDesignStudioPathname");
    expect(adminRouteSource).toContain("admin-fullscreen-studio-layout");
    expect(adminRouteSource).toContain("h-screen w-screen overflow-hidden");

    // 3. Supabase auth + is_admin() RPC enforcement preserved on /_admin
    expect(adminRouteSource).toContain("supabase.auth.getUser()");
    expect(adminRouteSource).toContain('supabase.rpc("is_admin")');

    // 4. Lazy-loaded StudioShell boundary and noindex meta on /_admin/admin/design
    expect(designRouteSource).toContain('createFileRoute("/_admin/admin/design")');
    expect(designRouteSource).toContain(
      'lazy(() => import("@/components/visual-editor/StudioShell"))',
    );
    expect(designRouteSource).toContain("noindex, nofollow");
  });

  it("blocks anonymous and non-admin users from accessing draft persistence in StudioShell", async () => {
    const anonAdapter = new InMemoryTransactionalPersistenceAdapter({
      role: "anon",
    });

    renderStudio(anonAdapter);

    await waitFor(() => {
      expect(screen.getByTestId("studio-access-error-state")).toBeInTheDocument();
    });
    expect(screen.getByText(/Administrator Authorization Required/i)).toBeInTheDocument();
    expect(screen.queryByTestId("studio-shell")).not.toBeInTheDocument();
  });

  it("renders the full-screen workspace shell with toolbar, layer navigator, live storefront canvas, inspector, and status bar", async () => {
    renderStudio();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    expect(screen.getByTestId("studio-toolbar")).toBeInTheDocument();
    expect(screen.getAllByTestId("studio-layers-panel").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("studio-canvas-stage").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("studio-inspector").length).toBeGreaterThan(0);
    expect(screen.getByTestId("studio-status-bar")).toBeInTheDocument();
  });

  it("renders the actual storefront components, real product/category data, and single shared StoreHeader/StoreFooter without duplication", async () => {
    renderStudio();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    const stages = screen.getAllByTestId("studio-canvas-stage");
    const primaryStage = stages[0];

    // 1. Real StoreHeader and StoreFooter rendered once per stage (not duplicated)
    const headers = primaryStage.querySelectorAll("header");
    const footers = primaryStage.querySelectorAll("footer");
    expect(headers.length).toBe(1);
    expect(footers.length).toBe(1);

    // 2. Real PlanetHero & CelestialScrollWorld represented
    expect(primaryStage.querySelector('[data-editor-node-id="home-planet-hero"]')).not.toBeNull();
    expect(
      primaryStage.querySelector('[data-editor-node-id="home-celestial-scroll-world"]'),
    ).not.toBeNull();
    expect(
      primaryStage.querySelector('[data-celestial-scroll-mode="studio-canvas"]'),
    ).not.toBeNull();

    // 3. Real product & category data rendered inside the canvas
    expect(primaryStage.textContent).toContain("Orion Nebula Smart Telescope");
    expect(primaryStage.textContent).toContain("Levitation Moon Lamp Pro");
    expect(primaryStage.textContent).toContain("Telescopes & Optics");
    expect(primaryStage.textContent).toContain("Celestial Lamps");
  });

  it("supports collapsing and expanding the left layers panel and right inspector panel while preserving selection", async () => {
    renderStudio();

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    const toggleLeftBtn = screen.getByTestId("studio-toggle-left-panel");
    const toggleRightBtn = screen.getByTestId("studio-toggle-right-panel");

    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Interactive Planet Hero",
    );

    // Collapse left panel
    fireEvent.click(toggleLeftBtn);
    expect(screen.queryByTestId("studio-layers-panel")).not.toBeInTheDocument();
    // Selection remains intact
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Interactive Planet Hero",
    );

    // Re-open left panel
    fireEvent.click(toggleLeftBtn);
    expect(screen.getByTestId("studio-layers-panel")).toBeInTheDocument();

    // Collapse right panel
    fireEvent.click(toggleRightBtn);
    expect(screen.queryByTestId("studio-inspector")).not.toBeInTheDocument();

    // Re-open right panel and confirm selection persisted
    fireEvent.click(toggleRightBtn);
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Interactive Planet Hero",
    );
  });
});
