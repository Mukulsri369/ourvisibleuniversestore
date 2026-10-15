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
      <h1 className="text-3xl font-semibold">Product not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This product may have moved or is no longer available.
      </p>
      <Link
        to="/shop"
        className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-xs sm:text-sm font-semibold text-primary-foreground"
      >
        Back to store
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Unable to load product</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Please check your connection and try again.
      </p>
      <Link
        to="/shop"
        className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-xs sm:text-sm font-semibold text-primary-foreground"
      >
        Back to store
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
        <section className="mt-16 sm:mt-20">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Related products</h2>
          <div className="mt-6 sm:mt-8">
            <ProductGrid items={related} />
          </div>
        </section>
      )}
    </div>
  );
}
