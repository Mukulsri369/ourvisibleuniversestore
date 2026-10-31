import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchBox } from "@/components/store/StoreChrome";
import {
  ProductBrowser,
  validateBrowseSearch,
  browseProductsQuery,
} from "@/components/store/ProductBrowser";
import { SpaceLaserLine } from "@/components/store/SpaceLaserLine";

export const Route = createFileRoute("/_store/search")({
  validateSearch: validateBrowseSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(browseProductsQuery(deps)).catch(() => undefined);
  },
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

const POPULAR_SEARCHES = [
  "levitating lamp",
  "galaxy projector",
  "glow in the dark",
  "telescope",
  "astronaut",
  "solar system",
];

function SearchPage() {
  const search = Route.useSearch();
  return (
    <>
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 text-center">
          <p className="eyebrow">Search the cosmos</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">
            {search.q ? <>Results for “{search.q}”</> : "Search products"}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
            Scans product names, short descriptions, and full descriptions to find the best matching
            products.
          </p>
          <div className="mt-6 max-w-xl mx-auto">
            <SearchBox key={search.q} defaultValue={search.q} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 mr-1">
              Popular:
            </span>
            {POPULAR_SEARCHES.map((term) => (
              <Link
                key={term}
                to="/search"
                search={{ q: term }}
                className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] text-foreground/80 hover:border-primary/50 hover:bg-secondary hover:text-primary transition-colors"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SpaceLaserLine
          label="SPECTRUM SCAN"
          coordinates={search.q ? `TARGET: ${search.q.toUpperCase()}` : "DEEP SKY GRID"}
          className="my-6 sm:my-8"
        />
        <ProductBrowser search={search} to="/search" />
      </div>
    </>
  );
}
