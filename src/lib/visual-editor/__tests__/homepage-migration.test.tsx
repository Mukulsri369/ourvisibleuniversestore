import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as storeModule from "@/lib/store";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import baselineFixtures from "../../../../visual-regression/manifest/data-fixtures.json";
import {
  CANONICAL_HOMEPAGE_DOCUMENT_ID,
  CANONICAL_HOMEPAGE_NODE_IDS,
  CURRENT_PAGE_SCHEMA_VERSION,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
  HomepageRenderer,
  defaultComponentRegistry,
  getCanonicalHomepageDocument,
  resolveValidatedHomepageDocument,
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
    search?: Record<string, unknown>;
    className?: string;
  }) => {
    const resolvedHref = params?.slug ? to.replace("$slug", params.slug) : to;
    const queryEntries = search ? Object.entries(search).map(([k, v]) => [k, String(v)]) : [];
    const query = queryEntries.length > 0 ? `?${new URLSearchParams(queryEntries).toString()}` : "";
    return (
      <a href={`${resolvedHref}${query}`} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
  createFileRoute: () => (opts: unknown) => opts,
}));

const FIXTURE_PRODUCTS = baselineFixtures.products as unknown as ProductCardData[];
const FIXTURE_CATEGORIES = baselineFixtures.categories as unknown as Category[];

const FOUR_CATEGORIES: Category[] = [
  FIXTURE_CATEGORIES[0],
  FIXTURE_CATEGORIES[1],
  {
    id: "cat-meteorites-3",
    name: "Planetary Meteorite Specimens",
    slug: "planetary-meteorite-specimens",
    description: "Verified chondrites and iron meteorites",
    image_url: null,
    sort_order: 3,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "cat-posters-4",
    name: "Deep Sky Observatory Charts",
    slug: "deep-sky-observatory-charts",
    description: "Deep sky starcharts and archival prints",
    image_url: null,
    sort_order: 4,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const FOUR_CATEGORY_PRODUCTS: ProductCardData[] = [
  {
    ...FIXTURE_PRODUCTS[0],
    id: "prod-cat-1",
    category_id: FOUR_CATEGORIES[0].id,
    category_ids: [FOUR_CATEGORIES[0].id],
    category: {
      name: FOUR_CATEGORIES[0].name,
      slug: FOUR_CATEGORIES[0].slug,
    },
    featured: true,
  },
  {
    ...FIXTURE_PRODUCTS[1],
    id: "prod-cat-2",
    category_id: FOUR_CATEGORIES[1].id,
    category_ids: [FOUR_CATEGORIES[1].id],
    category: {
      name: FOUR_CATEGORIES[1].name,
      slug: FOUR_CATEGORIES[1].slug,
    },
    featured: false,
  },
  {
    ...FIXTURE_PRODUCTS[0],
    id: "prod-cat-3",
    name: "Campo del Cielo Iron Specimen",
    slug: "campo-del-cielo-specimen",
    category_id: "cat-meteorites-3",
    category_ids: ["cat-meteorites-3"],
    category: {
      name: "Planetary Meteorite Specimens",
      slug: "planetary-meteorite-specimens",
    },
    featured: true,
  },
  {
    ...FIXTURE_PRODUCTS[1],
    id: "prod-cat-4",
    name: "Messier Catalog Archival Map",
    slug: "messier-catalog-map",
    category_id: "cat-posters-4",
    category_ids: ["cat-posters-4"],
    category: {
      name: "Deep Sky Observatory Charts",
      slug: "deep-sky-observatory-charts",
    },
    featured: false,
  },
];

const SAMPLE_HOME_DATA: HomeData = {
  featured: FOUR_CATEGORY_PRODUCTS.slice(0, 2),
  newest: FOUR_CATEGORY_PRODUCTS.slice(0, 2),
  festival: FOUR_CATEGORY_PRODUCTS.slice(0, 2),
  allProducts: FOUR_CATEGORY_PRODUCTS,
};

const SAMPLE_SETTINGS: Settings = {
  footer_text: "Explore the universe. Discover something extraordinary.",
  affiliate_disclosure: "We may earn a commission from qualifying purchases.",
  instagram_url: "https://instagram.com/ourvisibleuniverse",
  social_links: {
    festival_special: {
      enabled: true,
      eyebrow: "Diwali Cosmic Edition",
      title: "Nebula & Starlight Lamps",
      description: "Curated ambient projectors and planetary globes.",
    },
    category_spotlights: {
      "cat-meteorites-3": "prod-cat-3",
    },
  },
  id: 1,
  store_name: "Our Visible Universe",
  logo_url: null,
  contact_email: null,
  updated_at: "2026-01-01T00:00:00Z",
};

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Prompt 7 — Real Homepage Migration, Data Bindings & Progressive Loading Tests", () => {
  it("1. validates canonical DEFAULT_HOMEPAGE_PAGE_DOCUMENT schema, stable node IDs, and registry resolution", () => {
    const docA = getCanonicalHomepageDocument();
    const docB = getCanonicalHomepageDocument();

    expect(docA).toBe(docB);
    expect(docA.id).toBe(CANONICAL_HOMEPAGE_DOCUMENT_ID);
    expect(docA.schemaVersion).toBe(CURRENT_PAGE_SCHEMA_VERSION);
    expect(docA.pageType).toBe("home");

    const validation = resolveValidatedHomepageDocument(docA, defaultComponentRegistry);
    expect(validation.ok).toBe(true);
    expect(validation.usedFallback).toBe(false);
    expect(validation.issues).toHaveLength(0);

    // Verify exact root section ordering
    expect(docA.root.map((n) => n.id)).toEqual([
      CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
      CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      CANONICAL_HOMEPAGE_NODE_IDS.festivalSection,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      CANONICAL_HOMEPAGE_NODE_IDS.newArrivalsRail,
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      CANONICAL_HOMEPAGE_NODE_IDS.interestSection,
      CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection,
      CANONICAL_HOMEPAGE_NODE_IDS.instagramSection,
    ]);
  });

  it("2. falls back safely to DEFAULT_HOMEPAGE_PAGE_DOCUMENT when an invalid document is supplied and accepts valid custom documents", () => {
    const invalidCandidate = {
      id: "bad-doc",
      schemaVersion: "99.0.0",
      root: "not-an-array",
    };

    const result = resolveValidatedHomepageDocument(invalidCandidate);
    expect(result.ok).toBe(false);
    expect(result.usedFallback).toBe(true);
    expect(result.document).toBe(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    expect(result.issues.length).toBeGreaterThan(0);

    // Valid custom clone passes both schema and registry checks
    const customClone = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    const validCustomResult = resolveValidatedHomepageDocument(customClone);
    expect(validCustomResult.ok).toBe(true);
    expect(validCustomResult.usedFallback).toBe(false);
    expect(validCustomResult.issues).toHaveLength(0);
  });

  it("3. renders all homepage sections through HomepageRenderer with authoritative site settings and zero duplicate chrome", () => {
    const { container } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME_DATA}
        categories={FOUR_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        disableClientShuffle
      />,
    );

    // Global chrome (header/footer) is owned by _store.tsx and never duplicated inside HomepageRenderer
    expect(container.querySelector('[data-store-chrome="header"]')).toBeNull();
    expect(container.querySelector('[data-store-chrome="footer"]')).toBeNull();

    // PlanetHero and CelestialScrollWorld mounted
    expect(container.querySelector(".planet-hero")).not.toBeNull();

    // Festival section uses authoritative settings from settings.social_links.festival_special
    expect(screen.getByText("Diwali Cosmic Edition")).toBeTruthy();
    expect(screen.getByText("Nebula & Starlight Lamps")).toBeTruthy();
    expect(screen.getByText("Curated ambient projectors and planetary globes.")).toBeTruthy();

    // Featured (#featured-products) & New arrivals rails
    expect(container.querySelector("#featured-products")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Featured" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "New arrivals" })).toBeTruthy();

    // Marketing sections: Explore by interest, Why shop with us, Instagram
    expect(screen.getByRole("heading", { name: "Explore by interest" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "telescope" }).getAttribute("href")).toBe(
      "/search?q=telescope",
    );
    expect(screen.getByRole("heading", { name: "Why shop with us" })).toBeTruthy();
    expect(screen.getByText("Curated collection")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Follow on Instagram/i }).getAttribute("href")).toBe(
      "https://instagram.com/ourvisibleuniverse",
    );
  });

  it("4. respects festival enable/disable and empty-state behavior from site settings", () => {
    const disabledSettings: Settings = {
      ...SAMPLE_SETTINGS,
      social_links: {
        festival_special: {
          enabled: false,
        },
      },
    };

    const { container, unmount } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME_DATA}
        categories={FOUR_CATEGORIES}
        settings={disabledSettings}
        disableClientShuffle
      />,
    );

    expect(container.querySelector("#festival-special")).toBeNull();
    unmount();

    // Enabled festival with empty products renders EmptyState
    const emptyFestivalHome: HomeData = {
      ...SAMPLE_HOME_DATA,
      festival: [],
    };
    renderWithQuery(
      <HomepageRenderer
        home={emptyFestivalHome}
        categories={FOUR_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        disableClientShuffle
      />,
    );
    expect(screen.getByText("Lighting collection arriving soon")).toBeTruthy();
  });

  it("5. preserves IntersectionObserver progressive category loading (initial 2, +2 increment on scroll, sentinel cleanup)", () => {
    const observerCallbacks: IntersectionObserverCallback[] = [];
    const disconnectSpy = vi.fn();
    const observeSpy = vi.fn();

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin: string = "350px 0px";
      readonly thresholds: ReadonlyArray<number> = [0];
      constructor(cb: IntersectionObserverCallback) {
        observerCallbacks.push(cb);
      }
      observe = observeSpy;
      unobserve = vi.fn();
      disconnect = disconnectSpy;
      takeRecords = () => [];
    }

    const originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      const { unmount } = renderWithQuery(
        <HomepageRenderer
          home={SAMPLE_HOME_DATA}
          categories={FOUR_CATEGORIES}
          settings={SAMPLE_SETTINGS}
          disableClientShuffle
        />,
      );

      // Initially only the first 2 categories are rendered
      expect(screen.getAllByText(FOUR_CATEGORIES[0].name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(FOUR_CATEGORIES[1].name).length).toBeGreaterThan(0);
      expect(screen.queryByText("Planetary Meteorite Specimens")).toBeNull();
      expect(screen.queryByText("Deep Sky Observatory Charts")).toBeNull();

      // Sentinel is visible and observed
      expect(screen.getByText("Loading collections…")).toBeTruthy();
      expect(observeSpy).toHaveBeenCalled();

      // Trigger intersection -> reveals next 2 categories (total 4)
      act(() => {
        for (const cb of observerCallbacks) {
          cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
        }
      });

      expect(screen.getAllByText("Planetary Meteorite Specimens").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Deep Sky Observatory Charts").length).toBeGreaterThan(0);
      expect(screen.queryByText("Loading collections…")).toBeNull();

      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
    } finally {
      globalThis.IntersectionObserver = originalIO;
    }
  });

  it("6. preserves affiliate BuyButton click tracking in public mode and intercepts clicks in editor mode", () => {
    const logClickSpy = vi
      .spyOn(storeModule, "logOutboundClick")
      .mockImplementation(() => Promise.resolve());
    const onSelectNode = vi.fn();

    const { container: publicContainer, unmount: unmountPublic } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME_DATA}
        categories={FOUR_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        mode="public"
        disableClientShuffle
      />,
    );

    const buyLinks = publicContainer.querySelectorAll('a[target="_blank"][rel*="sponsored"]');
    expect(buyLinks.length).toBeGreaterThan(0);
    fireEvent.click(buyLinks[0]);
    expect(logClickSpy).toHaveBeenCalledTimes(1);
    unmountPublic();

    logClickSpy.mockClear();

    const { container: editorContainer } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME_DATA}
        categories={FOUR_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        mode="editor"
        onSelectNode={onSelectNode}
        disableClientShuffle
      />,
    );

    const editorBuyLinks = editorContainer.querySelectorAll('a[target="_blank"][rel*="sponsored"]');
    fireEvent.click(editorBuyLinks[0]);
    expect(logClickSpy).not.toHaveBeenCalled();
    expect(onSelectNode).toHaveBeenCalledWith(CANONICAL_HOMEPAGE_NODE_IDS.festivalSection);

    logClickSpy.mockRestore();
  });
});
