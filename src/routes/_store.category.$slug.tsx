import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/store/Pagination";
import { ProductBrowser, validateBrowseSearch } from "@/components/store/ProductBrowser";
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
  return (
    <>
      <PageHeader eyebrow="Category" title={cat!.name} text={cat!.description} />
      <ProductBrowser search={search} to={`/category/${slug}`} lockCategory={slug} />
    </>
  );
}
