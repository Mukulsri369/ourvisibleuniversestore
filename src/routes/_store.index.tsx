import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Compass, Instagram, ShieldCheck, Sparkles } from "lucide-react";
import { GalaxyScene } from "@/components/store/GalaxyScene";
import { buttonVariants } from "@/components/ui/button";
import { CategoryCard } from "@/components/store/CategoryCard";
import { ProductGrid } from "@/components/store/ProductCard";
import { EmptyState } from "@/components/store/Pagination";
import { categoriesQuery, homeQuery, settingsQuery } from "@/lib/store";

const TITLE = "Our Visible Universe Store — Astronomy Gifts, Space Gear & Cosmic Décor";
const DESC = "Discover astronomy-inspired products, space gear, cosmic décor, apparel and gifts curated for curious minds.";

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
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Home,
});

const INTERESTS = ["telescope", "galaxy", "Saturn", "moon", "projector", "astronaut", "NASA", "solar system", "space t shirt", "astronomy gift"];

function Home() {
  const { data: home } = useSuspenseQuery(homeQuery);
  const { data: cats = [] } = useSuspenseQuery(categoriesQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);

  return (
    <>
      {/* HERO */}
      <section className="cosmic-hero relative isolate overflow-hidden">
        <GalaxyScene />
        <div className="cosmic-hero-shade absolute inset-0 -z-10" />
        <div className="cosmic-hero-copy mx-auto max-w-7xl px-4 sm:px-6">
          <p className="eyebrow">Our Visible Universe Store</p>
          <h1 className="mt-5 max-w-2xl text-5xl leading-[1.06] sm:text-7xl lg:text-8xl">
            Bring the Universe <em className="text-gradient-gold">Closer.</em>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Discover astronomy-inspired products, space gear, cosmic décor, apparel and gifts curated for curious minds.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/shop" className={buttonVariants({ variant: "affiliate", size: "xl" })}>
              EXPLORE THE STORE <ArrowRight />
            </Link>
            <a href="#categories" className={buttonVariants({ variant: "glass", size: "xl" })}>
              EXPLORE CATEGORIES
            </a>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionHead eyebrow="Constellations" title="Featured categories" />
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {cats.slice(0, 8).map((c, i) => (
            <CategoryCard key={c.id} c={c} index={i} />
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead eyebrow="Hand-picked" title="Featured products" link={{ to: "/search", search: { featured: true }, label: "View all featured" }} />
        <div className="mt-8">
          {home.featured.length ? (
            <ProductGrid items={home.featured} />
          ) : (
            <EmptyState title="New discoveries are on the way." text="Our curators are charting the first products. Check back soon." />
          )}
        </div>
      </section>

      {/* NEW */}
      {home.newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHead eyebrow="Just landed" title="New arrivals" link={{ to: "/search", search: { sort: "newest" }, label: "See everything new" }} />
          <div className="mt-8">
            <ProductGrid items={home.newest} />
          </div>
        </section>
      )}

      {/* INTERESTS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead eyebrow="Navigate by curiosity" title="Explore by interest" />
        <div className="mt-8 flex flex-wrap gap-2.5">
          {INTERESTS.map((t) => (
            <Link key={t} to="/search" search={{ q: t }} className="rounded-full border border-border bg-card/50 px-5 py-3 text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary">
              {t}
            </Link>
          ))}
        </div>
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead eyebrow="Mission brief" title="Why our store" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: Compass, t: "Curated by space lovers", d: "Every product is chosen by the Our Visible Universe team for curiosity, quality and wonder." },
            { icon: ShieldCheck, t: "Secure retailer checkout", d: "Purchases, payment, delivery and returns are handled by the linked retailer." },
            { icon: BadgeCheck, t: "Honest & transparent", d: "No invented prices or fake deals. We clearly disclose our affiliate relationship." },
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
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border px-6 py-14 text-center sm:px-12">
          <div className="nebula starfield absolute inset-0" />
          <div className="relative">
            <Sparkles className="mx-auto size-6 text-primary" />
            <h2 className="mx-auto mt-4 max-w-2xl text-4xl sm:text-5xl">Join the journey across the cosmos.</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">Daily astronomy, deep-space imagery and new product drops on Instagram.</p>
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
    </>
  );
}

function SectionHead({ eyebrow, title, link }: { eyebrow: string; title: string; link?: { to: string; search: Record<string, unknown>; label: string } }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-3xl sm:text-5xl">{title}</h2>
      </div>
      {link && (
        <Link to={link.to} search={link.search} className="hidden shrink-0 items-center gap-1 text-sm text-accent hover:underline sm:inline-flex">
          {link.label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
