import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Flame,
  Instagram,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PlanetHero } from "@/components/store/PlanetHero";
import { CelestialScrollWorld } from "@/components/store/CelestialScrollWorld";
import { buttonVariants } from "@/components/ui/button";
import { ProductScrollRail } from "@/components/store/ProductScrollRail";
import { CategorySpotlightHero } from "@/components/store/CategorySpotlightHero";
import { getCelestialSystemForCategory } from "@/lib/celestial-catalog";
import { EmptyState } from "@/components/store/Pagination";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";

const LEGACY_INTERESTS = [
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
] as const;

export interface LegacyHomepageViewProps {
  homeData: HomeData;
  categories: Category[];
  settings: Settings | null;
}

/**
 * Recoverable reference & emergency rollback implementation of the original hardcoded homepage
 * (`src/routes/_store.index.tsx` prior to Prompt 7).
 *
 * Used for:
 * 1. Automated DOM & visual parity verification against `HomepageRenderer` (`PageRenderer`).
 * 2. Automatic zero-downtime fallback if `HOMEPAGE_SHARED_RENDERER_ENABLED` is toggled off
 *    or if an unexpected runtime error occurs in the document renderer.
 */
export function LegacyHomepageView({ homeData, categories, settings }: LegacyHomepageViewProps) {
  const categoryRails = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    const map = new Map<string, ProductCardData[]>();
    for (const cat of categories) {
      map.set(cat.id, []);
    }

    for (const p of homeData.allProducts) {
      const ids = p.category_ids?.length ? p.category_ids : p.category_id ? [p.category_id] : [];
      for (const cid of ids) {
        if (map.has(cid)) {
          map.get(cid)!.push(p);
        }
      }
    }

    return categories
      .map((cat) => ({
        category: cat,
        products: map.get(cat.id) || [],
      }))
      .filter((entry) => entry.products.length > 0);
  }, [categories, homeData.allProducts]);

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
    <div className="store-homepage relative">
      <CelestialScrollWorld />

      <div className="relative z-10">
        <PlanetHero />
      </div>

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
                {homeData.festival && homeData.festival.length > 0 ? (
                  <ProductScrollRail variant="festive" items={homeData.festival} className="my-0" />
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

      {homeData.featured.length > 0 && (
        <section
          id="featured-products"
          className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 py-6 sm:py-10 sm:px-6"
        >
          <ProductScrollRail
            title="Featured"
            link={{ to: "/search", search: { featured: true }, label: "View all" }}
            items={homeData.featured}
            className="my-0"
          />
        </section>
      )}

      {homeData.newest.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:py-10 sm:px-6">
          <ProductScrollRail
            title="New arrivals"
            link={{ to: "/search", search: { sort: "newest" }, label: "View all" }}
            items={homeData.newest}
            className="my-0"
          />
        </section>
      )}

      {categoryRails.slice(0, visibleCategoryCount).map(({ category: cat, products }) => {
        const customSpotlightId = categorySpotlights[cat.id] || categorySpotlights[cat.slug];
        const spotlightProduct =
          (customSpotlightId
            ? products.find((p) => p.id === customSpotlightId) ||
              homeData.allProducts.find((p) => p.id === customSpotlightId)
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
            {spotlightProduct && (
              <CategorySpotlightHero
                product={spotlightProduct}
                categoryName={cat.name}
                categorySlug={cat.slug}
                sectorLore={celestial.planetName}
              />
            )}

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

      {visibleCategoryCount < categoryRails.length && (
        <div ref={sentinelRef} className="relative z-10 mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 py-2">
            <Sparkles className="size-3.5 animate-spin text-primary/60" />
            <span>Loading collections…</span>
          </div>
        </div>
      )}

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight">
              Explore by interest
            </h2>
          </div>
        </div>
        <div className="mt-5 sm:mt-6 flex flex-wrap gap-2 sm:gap-2.5">
          {LEGACY_INTERESTS.map((t) => (
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

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight">
              Why shop with us
            </h2>
          </div>
        </div>
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
