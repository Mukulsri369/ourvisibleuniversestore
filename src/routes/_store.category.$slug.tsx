import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ProductBrowser, validateBrowseSearch } from "@/components/store/ProductBrowser";
import { CategoryFullBackground } from "@/components/store/CategoryFullBackground";
import { SpaceLaserLine } from "@/components/store/SpaceLaserLine";
import { getCelestialSystemForCategory } from "@/lib/celestial-catalog";
import { absoluteUrl, categoryQuery, SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/_store/category/$slug")({
  validateSearch: validateBrowseSearch,
  loader: async ({ context, params }) => {
    const cat = await context.queryClient.ensureQueryData(categoryQuery(params.slug));
    if (!cat) throw notFound();
    return { cat };
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
    const celestialSystem = getCelestialSystemForCategory(params.slug);
    const t = `${c.name} | Our Visible Universe Store`;
    const d = `“${celestialSystem.quote.text}” — ${c.name} collection at Our Visible Universe.`;
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
  const celestialSystem = getCelestialSystemForCategory(slug);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* FULL-HEIGHT CELESTIAL BACKGROUND MOVING TILL THE BOTTOM OF THE PAGE */}
      <CategoryFullBackground system={celestialSystem} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-6 sm:pt-8 pb-16">
        {/* MINIMALIST CATEGORY HEADER WITH POETIC SPACE QUOTE */}
        <div className="relative overflow-hidden border-b border-border/40 pb-6 sm:pb-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs uppercase tracking-widest text-primary">
              <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
              <span>SECTOR // {celestialSystem.planetName}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
              {cat.name}
            </h1>

            {/* POETIC SPACE QUOTE — NO EXTRA EXPLANATORY WORDING */}
            <div className="mt-1 flex flex-wrap items-baseline gap-2 text-xs sm:text-sm text-muted-foreground/90 font-mono italic max-w-3xl">
              <span>“{celestialSystem.quote.text}”</span>
              <span className="text-[11px] sm:text-xs uppercase tracking-wider text-primary/80 not-italic shrink-0 font-sans font-medium">
                — {celestialSystem.quote.author}
              </span>
            </div>
          </div>
        </div>

        {/* COOL SPACE LASER LINE WITH CELESTIAL COORDINATES */}
        <SpaceLaserLine
          label={celestialSystem.laserLabel}
          coordinates={celestialSystem.coordinates}
          className="my-6 sm:my-8"
        />

        {/* DIRECT DENSE PRODUCT CATALOG BROWSER */}
        <ProductBrowser search={search} to={`/category/${slug}`} lockCategory={slug} />
      </div>
    </div>
  );
}
