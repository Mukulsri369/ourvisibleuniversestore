import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ProductBrowser, validateBrowseSearch } from "@/components/store/ProductBrowser";
import { CategoryCelestialWorld } from "@/components/store/CategoryCelestialWorld";
import { CategoryQualityBento } from "@/components/store/CategoryQualityBento";
import { getCelestialSystemForCategory } from "@/lib/celestial-catalog";
import { absoluteUrl, categoryQuery, categoryQualityProductsQuery, SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/_store/category/$slug")({
  validateSearch: validateBrowseSearch,
  loader: async ({ context, params }) => {
    const [cat, qualityProducts] = await Promise.all([
      context.queryClient.ensureQueryData(categoryQuery(params.slug)),
      context.queryClient.ensureQueryData(categoryQualityProductsQuery(params.slug)),
    ]);
    if (!cat) throw notFound();
    return { cat, qualityProducts };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData)
      return {
        meta: [
          { title: "Category not found | Our Visible Universe Store" },
          { name: "robots", content: "noindex" },
        ],
      };
    const c = loaderData.cat;
    const t = `${c.name} | Our Visible Universe Store`;
    const d = c.description || `Explore ${c.name} curated by Our Visible Universe.`;
    const img = absoluteUrl(c.image_url);
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img
          ? [
              { property: "og:image", content: img },
              { name: "twitter:image", content: img },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/category/${params.slug}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl">Cosmic coordinates not found.</h1>
      <p className="mt-2 text-muted-foreground">
        This category doesn't exist or is no longer available.
      </p>
      <Link
        to="/shop"
        className="mt-6 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground"
      >
        Return to Store
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl">Signal lost.</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn't load this category. Please try again.
      </p>
    </div>
  ),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { data: cat } = useSuspenseQuery(categoryQuery(slug));
  const { data: qualityProducts = [] } = useSuspenseQuery(categoryQualityProductsQuery(slug));
  const celestialSystem = getCelestialSystemForCategory(slug);

  return (
    <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
      {/* CELESTIAL ORBITAL STAGE (Planets, Moons, Atmospheric Corona, Telemetry HUD) */}
      <div className="pt-6 sm:pt-8">
        <CategoryCelestialWorld system={celestialSystem} />
      </div>

      {/* TOP QUALITY PRODUCT BENTO GRID */}
      {qualityProducts.length > 0 && (
        <CategoryQualityBento products={qualityProducts} categoryName={cat!.name} />
      )}

      {/* COMPLETE CATEGORY CATALOG BROWSER */}
      <section className="relative pt-6 pb-16">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/40 pb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Full Category Catalog
            </span>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              All {cat!.name} Gear
            </h3>
          </div>
          {cat!.description && (
            <p className="max-w-md text-xs sm:text-sm text-muted-foreground">{cat!.description}</p>
          )}
        </div>
        <ProductBrowser search={search} to={`/category/${slug}`} lockCategory={slug} />
      </section>
    </div>
  );
}
