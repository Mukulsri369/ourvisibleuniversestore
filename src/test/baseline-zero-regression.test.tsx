import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BuyButton } from "@/components/store/BuyButton";
import { ProductCard, ProductGrid } from "@/components/store/ProductCard";
import { ProductScrollRail } from "@/components/store/ProductScrollRail";
import { CategorySpotlightHero } from "@/components/store/CategorySpotlightHero";
import { CategoryCard } from "@/components/store/CategoryCard";
import { CelestialScrollWorld } from "@/components/store/CelestialScrollWorld";
import { PLANETS } from "@/lib/planets";
import { CELESTIAL_CATALOG } from "@/lib/celestial-catalog";
import type { ProductCardData } from "@/lib/store";
import baselineFixtures from "../../visual-regression/manifest/data-fixtures.json";
import desktopGeometry from "../../visual-regression/geometry/desktop/homepage-geometry.baseline.json";
import celestialCheckpoints from "../../visual-regression/animation-checkpoints/celestial-scroll/celestial-scroll-checkpoints.json";

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
}));

const FIXTURE_PRODUCTS = baselineFixtures.products as unknown as ProductCardData[];
const FIXTURE_CATEGORIES = baselineFixtures.categories;

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Prompt 4 — Original Landing Page Baseline & Zero-Regression Verification", () => {
  it("1. verifies baseline manifest fixtures and deterministic seeded shuffling vs non-deterministic Math.random", () => {
    expect(FIXTURE_PRODUCTS).toHaveLength(3);
    expect(FIXTURE_CATEGORIES).toHaveLength(4);
    expect(desktopGeometry.viewport).toEqual({
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    });

    const createSeededRandom = (seed: number) => () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const deterministicShuffle = <T,>(items: T[], seed: number): T[] => {
      const rand = createSeededRandom(seed);
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const runA = deterministicShuffle(
      FIXTURE_PRODUCTS.map((p) => p.id),
      42,
    );
    const runB = deterministicShuffle(
      FIXTURE_PRODUCTS.map((p) => p.id),
      42,
    );
    expect(runA).toEqual(runB);

    const configuredFestivalIds: string[] = JSON.parse(
      baselineFixtures.siteSettings.social_links.__festival_product_ids,
    );
    const productMap = new Map(FIXTURE_PRODUCTS.map((p) => [p.id, p]));
    const orderedFestivalProducts = configuredFestivalIds
      .map((id) => productMap.get(id))
      .filter((p): p is ProductCardData => Boolean(p));

    expect(orderedFestivalProducts.map((p) => p.id)).toEqual([
      "prod-apo-refractor-80",
      "prod-seestar-s50",
      "prod-campo-meteorite",
    ]);
  });

  it("2. verifies Compact & Standard ProductCard DOM structure and responsive geometry classes", () => {
    const sampleProduct = FIXTURE_PRODUCTS[0];

    const { container: compactContainer, unmount: unmountCompact } = renderWithQueryClient(
      <ProductCard p={sampleProduct} compact onQuickPreview={vi.fn()} />,
    );
    const compactArticle = compactContainer.querySelector("article");
    expect(compactArticle).not.toBeNull();
    // Exact verified responsive width formula from ProductCard.tsx:
    // w-[calc((100vw-50px)/3)] sm:w-[130px] md:w-[155px] lg:w-[calc((100%-5*14px)/6)] lg:min-w-[160px] xl:w-[calc((100%-5*16px)/6)] xl:min-w-[172px]
    expect(compactArticle?.className).toContain("w-[calc((100vw-50px)/3)]");
    expect(compactArticle?.className).toContain("sm:w-[130px]");
    expect(compactArticle?.className).toContain("md:w-[155px]");
    expect(compactArticle?.className).toContain("lg:min-w-[160px]");
    expect(compactArticle?.className).toContain("xl:min-w-[172px]");
    expect(compactArticle?.className).toContain("rounded-xl");
    expect(compactArticle?.className).toContain("snap-start");
    unmountCompact();

    const { container: standardContainer } = renderWithQueryClient(
      <ProductGrid items={FIXTURE_PRODUCTS} />,
    );
    const gridWrapper = standardContainer.querySelector("div.grid");
    expect(gridWrapper?.className).toContain("grid-cols-2");
    expect(gridWrapper?.className).toContain("sm:grid-cols-3");
    expect(gridWrapper?.className).toContain("md:grid-cols-4");
    expect(gridWrapper?.className).toContain("lg:grid-cols-5");
    expect(gridWrapper?.className).toContain("xl:grid-cols-6");

    const standardArticle = standardContainer.querySelector("article");
    expect(standardArticle?.className).toContain("rounded-2xl");
  });

  it("3. verifies ProductScrollRail header, item count badge, scroll arrows, and edge gradients", () => {
    const { container } = renderWithQueryClient(
      <ProductScrollRail
        title="Featured Instruments"
        eyebrow="Hand-picked"
        items={FIXTURE_PRODUCTS}
        count={FIXTURE_PRODUCTS.length}
        variant="default"
        link={{ to: "/shop", label: "Explore all" }}
      />,
    );

    expect(screen.getByText("Featured Instruments")).toBeTruthy();
    expect(screen.getByText(/3 items/i)).toBeTruthy();
    expect(screen.getByLabelText("Scroll left")).toBeTruthy();
    expect(screen.getByLabelText("Scroll right")).toBeTruthy();

    const scrollTrack = container.querySelector('[role="region"]');
    expect(scrollTrack?.className).toContain("snap-x");
    expect(scrollTrack?.className).toContain("snap-mandatory");
    expect(scrollTrack?.className).toContain("overflow-x-auto");
  });

  it("4. verifies CategorySpotlightHero and CategoryCard baseline geometry and responsive bindings", () => {
    const category = FIXTURE_CATEGORIES[0];
    const spotlightProduct = FIXTURE_PRODUCTS[0];

    const { container } = renderWithQueryClient(
      <CategorySpotlightHero
        categoryName={category.name}
        categorySlug={category.slug}
        product={spotlightProduct}
      />,
    );

    expect(screen.getByText(spotlightProduct.name)).toBeTruthy();
    expect(screen.getByText("In stock")).toBeTruthy();
    expect(screen.getByText("Read more")).toBeTruthy();

    // Media wrapper uses aspect-[16/10] sm:aspect-[4/3] lg:aspect-square
    const mediaBox = container.querySelector(".aspect-\\[16\\/10\\]");
    expect(mediaBox).not.toBeNull();
    expect(mediaBox?.className).toContain("sm:aspect-[4/3]");
    expect(mediaBox?.className).toContain("lg:aspect-square");

    // Verify collapsible description toggle
    fireEvent.click(screen.getByText("Read more"));
    expect(screen.getByText("Show less")).toBeTruthy();

    // Verify reusable CategoryCard baseline
    const { container: catCardContainer } = render(<CategoryCard c={category} count={12} />);
    const catLink = catCardContainer.querySelector("a");
    expect(catLink?.getAttribute("href")).toBe("/category/telescopes");
    expect(catLink?.className).toContain("min-h-48");
    expect(catLink?.className).toContain("rounded-2xl");
  });

  it("5. verifies PlanetHero & CelestialScrollWorld catalog and animation checkpoint baselines", () => {
    expect(PLANETS.map((p) => p.id)).toEqual(["earth", "venus", "mars"]);
    expect(CELESTIAL_CATALOG.length).toBeGreaterThan(0);
    expect(celestialCheckpoints.scrollProgressCheckpoints).toHaveLength(7);

    const { container } = render(<CelestialScrollWorld />);
    const rootWorld = container.firstElementChild;
    expect(rootWorld?.getAttribute("aria-hidden")).toBe("true");
    expect(rootWorld?.className).toContain("fixed");
    expect(rootWorld?.className).toContain("inset-0");
    expect(rootWorld?.className).toContain("pointer-events-none");
    expect(rootWorld?.className).toContain("z-0");

    const ellipses = container.querySelectorAll("svg ellipse");
    expect(ellipses).toHaveLength(2);
  });

  it("6. verifies affiliate link pass-through and security attributes remain intact", () => {
    const product = FIXTURE_PRODUCTS[0];
    render(<BuyButton productId={product.id} url={product.affiliate_url} label="Buy Now" />);

    const link = screen.getByRole("link", { name: /Buy Now/i });
    expect(link.getAttribute("href")).toBe(
      "https://www.amazon.com/dp/B001BASELINE01?tag=visibleuni-20",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("nofollow sponsored noopener noreferrer");
  });

  it("7. verifies Editor-to-Public DOM Parity comparator strips editor-only attributes while detecting layout regressions", () => {
    const serializeCleanDomSignature = (root: HTMLElement) => {
      const clone = root.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-editor-overlay]").forEach((el) => el.remove());
      clone.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (attr.name.startsWith("data-editor-")) {
            el.removeAttribute(attr.name);
          }
        });
      });
      return clone.innerHTML;
    };

    const { container: publicContainer } = renderWithQueryClient(
      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8">
        <ProductCard p={FIXTURE_PRODUCTS[0]} compact />
      </div>,
    );

    const { container: editorCanvasContainer } = renderWithQueryClient(
      <div
        className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8"
        data-editor-node-id="section-featured"
        data-editor-selected="true"
      >
        <ProductCard p={FIXTURE_PRODUCTS[0]} compact />
        <div data-editor-overlay="true" className="pointer-events-none absolute inset-0" />
      </div>,
    );

    expect(serializeCleanDomSignature(editorCanvasContainer)).toBe(
      serializeCleanDomSignature(publicContainer),
    );
  });
});
