import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import baselineFixtures from "../../../../visual-regression/manifest/data-fixtures.json";
import { HomepageRenderer, LegacyHomepageView } from "../index";

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

const SAMPLE_HOME: HomeData = {
  featured: FIXTURE_PRODUCTS,
  newest: [...FIXTURE_PRODUCTS].reverse(),
  festival: FIXTURE_PRODUCTS.slice(0, 1),
  allProducts: FIXTURE_PRODUCTS,
};

const SAMPLE_SETTINGS: Settings = {
  footer_text: "Explore the universe. Discover something extraordinary.",
  affiliate_disclosure: "We may earn a commission from qualifying purchases.",
  instagram_url: "https://instagram.com/ourvisibleuniverse",
  social_links: baselineFixtures.siteSettings.social_links,
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

describe("Prompt 7 — Full-Page DOM Parity & SSR Compatibility Tests (Legacy vs Shared PageRenderer)", () => {
  it("1. produces 100% identical full-page DOM innerHTML between LegacyHomepageView and HomepageRenderer", () => {
    const { container: legacyContainer } = renderWithQuery(
      <LegacyHomepageView
        homeData={SAMPLE_HOME}
        categories={FIXTURE_CATEGORIES}
        settings={SAMPLE_SETTINGS}
      />,
    );

    const { container: migratedContainer } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME}
        categories={FIXTURE_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        disableClientShuffle
      />,
    );
    expect(migratedContainer.innerHTML).toBe(legacyContainer.innerHTML);
  });

  it("2. produces 100% identical DOM innerHTML when festival section is disabled or empty", () => {
    const disabledFestivalSettings: Settings = {
      ...SAMPLE_SETTINGS,
      social_links: {
        festival_special: { enabled: false },
      },
    };

    const { container: legacyDisabled } = renderWithQuery(
      <LegacyHomepageView
        homeData={SAMPLE_HOME}
        categories={FIXTURE_CATEGORIES}
        settings={disabledFestivalSettings}
      />,
    );

    const { container: migratedDisabled } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME}
        categories={FIXTURE_CATEGORIES}
        settings={disabledFestivalSettings}
        disableClientShuffle
      />,
    );
    expect(migratedDisabled.innerHTML).toBe(legacyDisabled.innerHTML);

    // Also test empty festival collection (EmptyState parity)
    const emptyFestivalHome: HomeData = {
      ...SAMPLE_HOME,
      festival: [],
    };

    const { container: legacyEmptyFest } = renderWithQuery(
      <LegacyHomepageView
        homeData={emptyFestivalHome}
        categories={FIXTURE_CATEGORIES}
        settings={SAMPLE_SETTINGS}
      />,
    );

    const { container: migratedEmptyFest } = renderWithQuery(
      <HomepageRenderer
        home={emptyFestivalHome}
        categories={FIXTURE_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        disableClientShuffle
      />,
    );

    expect(migratedEmptyFest.innerHTML).toBe(legacyEmptyFest.innerHTML);
  });

  it("3. produces 100% identical SSR markup via renderToString with zero browser-API errors", () => {
    const qc1 = new QueryClient();
    const qc2 = new QueryClient();

    const legacySsrHtml = renderToString(
      <QueryClientProvider client={qc1}>
        <LegacyHomepageView
          homeData={SAMPLE_HOME}
          categories={FIXTURE_CATEGORIES}
          settings={SAMPLE_SETTINGS}
        />
      </QueryClientProvider>,
    );

    const migratedSsrHtml = renderToString(
      <QueryClientProvider client={qc2}>
        <HomepageRenderer
          home={SAMPLE_HOME}
          categories={FIXTURE_CATEGORIES}
          settings={SAMPLE_SETTINGS}
        />
      </QueryClientProvider>,
    );
    expect(migratedSsrHtml).toBe(legacySsrHtml);
  });

  it("4. supports instant rollback via forceLegacyFallback prop with exact DOM parity", () => {
    const { container: rollbackContainer } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME}
        categories={FIXTURE_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        forceLegacyFallback={true}
        disableClientShuffle
      />,
    );

    const { container: sharedContainer } = renderWithQuery(
      <HomepageRenderer
        home={SAMPLE_HOME}
        categories={FIXTURE_CATEGORIES}
        settings={SAMPLE_SETTINGS}
        forceLegacyFallback={false}
        disableClientShuffle
      />,
    );
    expect(rollbackContainer.innerHTML).toBe(sharedContainer.innerHTML);
  });
});
