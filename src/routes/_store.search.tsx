import { createFileRoute } from "@tanstack/react-router";
import { SearchBox } from "@/components/store/StoreChrome";
import { ProductBrowser, validateBrowseSearch } from "@/components/store/ProductBrowser";

export const Route = createFileRoute("/_store/search")({
  validateSearch: validateBrowseSearch,
  head: ({ match }) => {
    const q = (match.search as { q?: string }).q;
    const t = q
      ? `“${q}” — Search | Our Visible Universe Store`
      : "Search | Our Visible Universe Store";
    const d = "Search astronomy and space products by name, category or interest.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex, follow" },
      ],
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  return (
    <>
      <div className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <p className="eyebrow">Search the cosmos</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">
            {search.q ? <>Results for “{search.q}”</> : "Search products"}
          </h1>
          <div className="mt-6">
            <SearchBox key={search.q} defaultValue={search.q} />
          </div>
        </div>
      </div>
      <ProductBrowser search={search} to="/search" />
    </>
  );
}
