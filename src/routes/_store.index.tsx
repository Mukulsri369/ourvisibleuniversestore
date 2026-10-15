import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Flame,
  Instagram,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlanetHero } from "@/components/store/PlanetHero";
import { CelestialScrollWorld } from "@/components/store/CelestialScrollWorld";
import { buttonVariants } from "@/components/ui/button";
import { ProductScrollRail } from "@/components/store/ProductScrollRail";
import { CategorySpotlightHero } from "@/components/store/CategorySpotlightHero";
import { getCelestialSystemForCategory } from "@/lib/celestial-catalog";
import { EmptyState } from "@/components/store/Pagination";
import {
  categoriesQuery,
  homeQuery,
  settingsQuery,
  shuffleArray,
  type ProductCardData,
} from "@/lib/store";

const TITLE = "Our Visible Universe Store — Astronomy Gifts, Space Gear & Cosmic Décor";
const DESC =
  "Discover astronomy-inspired products, space gear, cosmic décor, apparel and gifts curated for curious minds.";

export const Route = createFileRoute("/_store/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    try {
      const [home, cats, settings] = await Promise.all([
        context.queryClient.ensureQueryData(homeQuery),
        context.queryClient.ensureQueryData(categoriesQuery),
        context.queryClient.ensureQueryData(settingsQuery),
      ]);
      return { home, cats, settings };
    } catch {
      return {
        home: { featured: [], newest: [], festival: [], allProducts: [] },
        cats: [],
        settings: null,
      };
    }
  },
  component: Home,
});

const INTERESTS = [
  "diwali lights",
  "telescope",
  "galaxy",
  "Saturn",
  "moon",
  "projector",
  "astronaut",
  "NASA",
  "solar system",
  "space t shirt",
  "astronomy gift",
];

function Home() {
  const { data: home } = useSuspenseQuery(homeQuery);
  const { data: cats = [] } = useSuspenseQuery(categoriesQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);

  // Stable initial state matching server-rendered HTML to prevent hydration mismatch
  const [shuffledData, setShuffledData] = useState(() => home);

  // Fresh product shuffle generated on every store visit / app load (runs client-side only after hydration)
  useEffect(() => {
    setShuffledData({
      featured: shuffleArray(home.featured),
      newest: shuffleArray(home.newest),
      festival: shuffleArray(home.festival),
      allProducts: shuffleArray(home.allProducts),
    });
  }, [home]);

  // Group products into category rails following admin-defined sort_order
  const categoryRails = useMemo(() => {
    if (!cats || cats.length === 0) return [];
    const map = new Map<string, ProductCardData[]>();
    for (const cat of cats) {
      map.set(cat.id, []);
    }

    for (const p of shuffledData.allProducts) {
      const ids = p.category_ids?.length ? p.category_ids : p.category_id ? [p.category_id] : [];
      for (const cid of ids) {
        if (map.has(cid)) {
          map.get(cid)!.push(p);
        }
      }
    }

    // Only render categories that have products in them
    return cats
      .map((cat) => ({
        category: cat,
        products: map.get(cat.id) || [],
      }))
      .filter((entry) => entry.products.length > 0);
  }, [cats, shuffledData.allProducts]);

  // Progressive scroll-based category revealing
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(2);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisibleCategoryCount(categoryRails.length);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          setVisibleCategoryCount((prev) => Math.min(prev + 2, categoryRails.length));
        }
      },
      { rootMargin: "350px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [categoryRails.length]);

  const social = (settings?.social_links as Record<string, unknown> | null) || {};
  const categorySpotlights =
    (social.category_spotlights as Record<string, string> | undefined) || {};
  const festSpecial = (social.festival_special as Record<string, unknown> | undefined) || {};
  const showFestival = festSpecial.enabled !== false;
  const festivalEyebrow =
    typeof festSpecial.eyebrow === "string" && festSpecial.eyebrow
      ? festSpecial.eyebrow
      : "Festival Special";
  const festivalTitle =
    typeof festSpecial.title === "string" && festSpecial.title
      ? festSpecial.title
      : "Festival Lights";
  const festivalDesc =
    typeof festSpecial.description === "string" && festSpecial.description
      ? festSpecial.description
      : "Galaxy night lights, glowing globes, and starry lamps for festive spaces.";

  return (
    <div className="relative">
      {/* CELESTIAL BACKGROUND SCROLL WORLD (Earth, Venus & Mars orbit down to bottom) */}
      <CelestialScrollWorld />

      {/* HERO */}
      <div className="relative z-10">
        <PlanetHero />
      </div>

      {/* FESTIVAL SPECIAL — DIWALI (Single-Line Horizontal Rail) */}
      {showFestival && (
        <section
          id="festival-special"
          className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 pt-12 pb-4 sm:px-6 sm:pt-16 sm:pb-6"
        >
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/25 bg-gradient-to-b from-primary/10 via-card/50 to-card/25 p-4 sm:p-8 md:p-10 shadow-glow">
            <div className="starfield absolute inset-0 opacity-40 pointer-events-none" />
            <div className="relative">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow flex items-center gap-1.5 text-primary">
                    <Flame className="size-3.5 text-primary" /> {festivalEyebrow}
                  </p>
                  <h2 className="mt-1.5 text-2xl sm:text-4xl font-semibold text-foreground">
                    {festivalTitle}
                  </h2>
                  <p className="mt-2 max-w-2xl text-xs sm:text-sm text-muted-foreground">
                    {festivalDesc}
                  </p>
                </div>
                <Link
                  to="/search"
                  search={{ q: "light" }}
                  className="hidden shrink-0 items-center gap-1 text-xs sm:text-sm font-medium text-accent hover:underline sm:inline-flex"
                >
                  Explore lights <ArrowRight className="size-3.5 sm:size-4" />
                </Link>
              </div>

              <div className="mt-5 sm:mt-8">
                {shuffledData.festival && shuffledData.festival.length > 0 ? (
                  <ProductScrollRail
                    variant="festive"
                    items={shuffledData.festival}
                    className="my-0"
                  />
                ) : (
                  <EmptyState
                    title="Lighting collection arriving soon"
                    text="Discover glowing lamps and radiant pieces for your home."
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FEATURED PRODUCTS (Horizontal Rail - Shuffled) */}
      {shuffledData.featured.length > 0 && (
        <section
          id="featured-products"
          className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 py-6 sm:py-10 sm:px-6"
        >
          <ProductScrollRail
            title="Featured"
            link={{ to: "/search", search: { featured: true }, label: "View all" }}
            items={shuffledData.featured}
            className="my-0"
          />
        </section>
      )}

      {/* NEW ARRIVALS (Horizontal Rail - Shuffled) */}
      {shuffledData.newest.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:py-10 sm:px-6">
          <ProductScrollRail
            title="New arrivals"
            link={{ to: "/search", search: { sort: "newest" }, label: "View all" }}
            items={shuffledData.newest}
            className="my-0"
          />
        </section>
      )}

      {/* DYNAMIC PROGRESSIVE CATEGORY PRODUCT RAILS & SPOTLIGHT HEROES (Scroll-loaded, ordered by Admin sort_order) */}
      {categoryRails.slice(0, visibleCategoryCount).map(({ category: cat, products }) => {
        // Resolve spotlight product: 1. Admin custom pick -> 2. Top featured product -> 3. Newest/first in collection
        const customSpotlightId = categorySpotlights[cat.id] || categorySpotlights[cat.slug];
        const spotlightProduct =
          (customSpotlightId
            ? products.find((p) => p.id === customSpotlightId) ||
              shuffledData.allProducts.find((p) => p.id === customSpotlightId)
            : null) ||
          products.find((p) => p.featured) ||
          products[0] ||
          null;

        const celestial = getCelestialSystemForCategory(cat.slug);

        return (
          <section
            key={cat.id}
            className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:py-10 sm:px-6 transition-all duration-500 ease-out animate-in fade-in"
          >
            {/* CATEGORY SPOTLIGHT HERO WITH COLLAPSED DESCRIPTION */}
            {spotlightProduct && (
              <CategorySpotlightHero
                product={spotlightProduct}
                categoryName={cat.name}
                categorySlug={cat.slug}
                sectorLore={celestial.planetName}
              />
            )}

            {/* PRODUCT SCROLL RAIL */}
            <ProductScrollRail
              title={cat.name}
              count={products.length}
              link={{
                to: "/category/$slug",
                params: { slug: cat.slug },
                label: "View all",
              }}
              items={products}
              className="my-0"
            />
          </section>
        );
      })}

      {/* SCROLL SENTINEL FOR PROGRESSIVE LOADING */}
      {visibleCategoryCount < categoryRails.length && (
        <div ref={sentinelRef} className="relative z-10 mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 py-2">
            <Sparkles className="size-3.5 animate-spin text-primary/60" />
            <span>Loading collections…</span>
          </div>
        </div>
      )}

      {/* INTERESTS */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <SectionHead title="Explore by interest" />
        <div className="mt-5 sm:mt-6 flex flex-wrap gap-2 sm:gap-2.5">
          {INTERESTS.map((t) => (
            <Link
              key={t}
              to="/search"
              search={{ q: t }}
              className="rounded-full border border-border bg-card/50 px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>

      {/* WHY OUR STORE */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <SectionHead title="Why shop with us" />
        <div className="mt-6 sm:mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Compass,
              t: "Curated collection",
              d: "Handpicked for quality, design, and space enthusiasts.",
            },
            {
              icon: ShieldCheck,
              t: "Trusted retailers",
              d: "Orders and delivery are fulfilled securely by verified merchants.",
            },
            {
              icon: BadgeCheck,
              t: "Transparent",
              d: "Clear pricing and verified links with no hidden fees.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="glass rounded-xl sm:rounded-2xl p-5 sm:p-6">
              <Icon className="size-5 sm:size-6 text-primary" strokeWidth={1.5} />
              <h3 className="mt-4 font-sans text-sm sm:text-base font-semibold">{t}</h3>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INSTAGRAM */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border px-5 py-10 text-center sm:px-12 sm:py-14">
          <div className="nebula starfield absolute inset-0" />
          <div className="relative">
            <Sparkles className="mx-auto size-5 text-primary" />
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl sm:text-4xl font-semibold">
              Follow our journey
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-muted-foreground">
              Daily space photography and new curated arrivals on Instagram.
            </p>
            <a
              href={settings?.instagram_url || "https://instagram.com"}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonVariants({ variant: "affiliate", size: "default" })} mt-5 sm:mt-6 text-xs sm:text-sm`}
            >
              <Instagram className="size-4" /> Follow on Instagram
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  link,
}: {
  eyebrow?: string;
  title: string;
  link?: { to: string; search: Record<string, unknown>; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      </div>
      {link && (
        <Link
          to={link.to}
          search={link.search}
          className="hidden shrink-0 items-center gap-1 text-xs sm:text-sm font-medium text-accent hover:underline sm:inline-flex"
        >
          {link.label} <ArrowRight className="size-3.5 sm:size-4" />
        </Link>
      )}
    </div>
  );
}
