import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { ProductGrid } from "@/components/store/ProductCard";
import { ProductDetailView } from "@/components/store/ProductDetailView";
import { absoluteUrl, productQuery, relatedQuery, settingsQuery, SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/_store/product/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    return { p };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData)
      return {
        meta: [
          { title: "Product not found | Our Visible Universe Store" },
          { name: "robots", content: "noindex" },
        ],
      };
    const p = loaderData.p;
    const t = `${p.name} | Our Visible Universe Store`;
    const d = (
      p.short_description ||
      p.description ||
      `${p.name} — curated by Our Visible Universe.`
    ).slice(0, 158);
    const img = absoluteUrl(p.image);
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img
          ? [
              { property: "og:image", content: img },
              { name: "twitter:image", content: img },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/product/${params.slug}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="eyebrow">Product unavailable</p>
      <h1 className="mt-3 text-4xl">Cosmic coordinates not found.</h1>
      <p className="mt-2 text-muted-foreground">
        This product may have moved or is no longer available.
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
        We couldn't load this product. Please check your connection and try again.
      </p>
      <Link
        to="/shop"
        className="mt-6 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground"
      >
        Return to Store
      </Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(slug));
  const p = data;
  if (!p) throw notFound();
  const { data: settings } = useQuery(settingsQuery);
  const { data: related = [] } = useQuery(relatedQuery(p));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>
        {p.category && (
          <>
            <ChevronRight className="size-3" />
            <Link
              to="/category/$slug"
              params={{ slug: p.category.slug }}
              className="hover:text-foreground"
            >
              {p.category.name}
            </Link>
          </>
        )}
      </nav>
      <ProductDetailView p={p} disclosure={settings?.affiliate_disclosure} />
      {related.length > 0 && (
        <section className="mt-20">
          <p className="eyebrow">Nearby in the cosmos</p>
          <h2 className="mt-2 text-3xl sm:text-4xl">Related products</h2>
          <div className="mt-8">
            <ProductGrid items={related} />
          </div>
        </section>
      )}
    </div>
  );
}
