import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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
import { CategoryCard } from "@/components/store/CategoryCard";
import { ProductScrollRail } from "@/components/store/ProductScrollRail";
import { SpaceLaserLine } from "@/components/store/SpaceLaserLine";
import { EmptyState } from "@/components/store/Pagination";
import { categoriesQuery, homeQuery, settingsQuery } from "@/lib/store";

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

  // Group products by active category
  const categoriesWithProducts = useMemo(() => {
    const all = home.allProducts || [];
    return cats
      .map((cat) => {
        const matching = all.filter(
          (p) =>
            p.category_id === cat.id ||
            (p.category_ids && p.category_ids.includes(cat.id)) ||
            (p.category && p.category.slug === cat.slug),
        );
        return {
          category: cat,
          products: matching,
        };
      })
      .filter((entry) => entry.products.length > 0);
  }, [cats, home.allProducts]);

  const social = (settings?.social_links as Record<string, unknown> | null) || {};
  const festSpecial = (social.festival_special as Record<string, unknown> | undefined) || {};
  const showFestival = festSpecial.enabled !== false;
  const festivalEyebrow =
    typeof festSpecial.eyebrow === "string" && festSpecial.eyebrow
      ? festSpecial.eyebrow
      : "Festival Special · Diwali";
  const festivalTitle =
    typeof festSpecial.title === "string" && festSpecial.title
      ? festSpecial.title
      : "Festival of Lights & Cosmic Glow";
  const festivalDesc =
    typeof festSpecial.description === "string" && festSpecial.description
      ? festSpecial.description
      : "Illuminate your home and celebrations with radiant galaxy night lights, illuminated planets, handcrafted cosmic lamps, and festive starry glow.";

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
          className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 pt-16 pb-6 sm:px-6"
        >
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-b from-primary/10 via-card/50 to-card/25 p-5 sm:p-8 md:p-10 shadow-glow">
            <div className="starfield absolute inset-0 opacity-40 pointer-events-none" />
            <div className="relative">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow flex items-center gap-1.5 text-primary">
                    <Flame className="size-3.5 text-primary" /> {festivalEyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl sm:text-5xl font-semibold text-foreground">
                    {festivalTitle}
                  </h2>
                  <p className="mt-2.5 max-w-2xl text-xs sm:text-base text-muted-foreground">
                    {festivalDesc}
                  </p>
                </div>
                <Link
                  to="/search"
                  search={{ q: "light" }}
                  className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline sm:inline-flex"
                >
                  Explore all lights <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="mt-6 sm:mt-8">
                {home.festival && home.festival.length > 0 ? (
                  <ProductScrollRail variant="festive" items={home.festival} className="my-0" />
                ) : (
                  <EmptyState
                    title="Festive illuminations are on their way."
                    text="Discover glowing lamps and radiant cosmic pieces for Diwali celebrations."
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FEATURED CATEGORIES GATEWAY */}
      <section
        id="categories"
        className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 pt-12 pb-8 sm:px-6"
      >
        <SectionHead title="Featured categories" />
        <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {cats.slice(0, 8).map((c, i) => (
            <CategoryCard key={c.id} c={c} index={i} />
          ))}
        </div>
      </section>

      {/* SPACE LASER LINE DIVIDER */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <SpaceLaserLine
          label="EXPLORE CATEGORIES"
          coordinates="RA 05h 35m 17s · DEC -05° 23′ 28″ · ORION NEBULA"
          className="my-4 sm:my-6"
        />
      </div>

      {/* SEPARATE DEDICATED PRODUCT RAILS FOR EACH CATEGORY */}
      {categoriesWithProducts.length > 0 && (
        <section id="category-rails" className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="space-y-6 sm:space-y-10">
            {categoriesWithProducts.map(({ category, products }) => (
              <div
                key={category.id}
                className="rounded-2xl border border-border/40 bg-card/25 p-4 sm:p-6 backdrop-blur-sm"
              >
                <ProductScrollRail
                  title={category.name}
                  count={products.length}
                  icon={<Sparkles className="size-3 text-primary" />}
                  link={{
                    to: "/category/$slug",
                    params: { slug: category.slug },
                    label: `Explore all ${category.name}`,
                  }}
                  items={products}
                  className="my-0"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FEATURED PRODUCTS (Horizontal Rail) */}
      {home.featured.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <ProductScrollRail
            title="Featured products"
            eyebrow="Hand-picked"
            link={{ to: "/search", search: { featured: true }, label: "View all featured" }}
            items={home.featured}
            className="my-0"
          />
        </section>
      )}

      {/* NEW ARRIVALS (Horizontal Rail) */}
      {home.newest.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <ProductScrollRail
            title="New arrivals"
            eyebrow="Just landed"
            link={{ to: "/search", search: { sort: "newest" }, label: "See everything new" }}
            items={home.newest}
            className="my-0"
          />
        </section>
      )}

      {/* INTERESTS */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead eyebrow="Navigate by curiosity" title="Explore by interest" />
        <div className="mt-8 flex flex-wrap gap-2.5">
          {INTERESTS.map((t) => (
            <Link
              key={t}
              to="/search"
              search={{ q: t }}
              className="rounded-full border border-border bg-card/50 px-4 py-2 sm:px-5 sm:py-3 text-xs sm:text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>

      {/* WHY OUR STORE */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead eyebrow="Mission brief" title="Why our store" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Compass,
              t: "Curated by space lovers",
              d: "Every product is chosen by the Our Visible Universe team for curiosity, quality and wonder.",
            },
            {
              icon: ShieldCheck,
              t: "Secure retailer checkout",
              d: "Purchases, payment, delivery and returns are handled by the linked retailer.",
            },
            {
              icon: BadgeCheck,
              t: "Honest & transparent",
              d: "No invented prices or fake deals. We clearly disclose our affiliate relationship.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="glass rounded-2xl p-6">
              <Icon className="size-6 text-primary" strokeWidth={1.5} />
              <h3 className="mt-5 font-sans text-base font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INSTAGRAM */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border px-6 py-14 text-center sm:px-12">
          <div className="nebula starfield absolute inset-0" />
          <div className="relative">
            <Sparkles className="mx-auto size-6 text-primary" />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl sm:text-5xl font-semibold">
              Join the journey across the cosmos.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm sm:text-base text-muted-foreground">
              Daily astronomy, deep-space imagery and new product drops on Instagram.
            </p>
            <a
              href={settings?.instagram_url || "https://instagram.com"}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonVariants({ variant: "affiliate", size: "lg" })} mt-7`}
            >
              <Instagram /> Follow on Instagram
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
  eyebrow: string;
  title: string;
  link?: { to: string; search: Record<string, unknown>; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-2xl sm:text-5xl font-semibold">{title}</h2>
      </div>
      {link && (
        <Link
          to={link.to}
          search={link.search}
          className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline sm:inline-flex"
        >
          {link.label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
