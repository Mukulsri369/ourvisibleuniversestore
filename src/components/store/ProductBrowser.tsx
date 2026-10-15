import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { categoriesQuery, productsQuery, type ListParams } from "@/lib/store";
import { ProductGrid } from "./ProductCard";
import { EmptyState, Pager } from "./Pagination";

export type BrowseSearch = {
  q?: string | undefined;
  category?: string | undefined;
  featured?: boolean | undefined;
  sort?: ListParams["sort"] | undefined;
  min?: number | undefined;
  max?: number | undefined;
  page?: number | undefined;
};

export function validateBrowseSearch(s: Record<string, unknown>): BrowseSearch {
  const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
  const sorts = ["featured", "newest", "price_asc", "price_desc"];
  return {
    q: typeof s["q"] === "string" && s["q"] ? s["q"].slice(0, 100) : undefined,
    category: typeof s["category"] === "string" && s["category"] ? s["category"] : undefined,
    featured: s["featured"] === true || s["featured"] === "true" ? true : undefined,
    sort: sorts.includes(String(s["sort"])) ? (s["sort"] as ListParams["sort"]) : undefined,
    min: Number.isFinite(num(s["min"])) ? num(s["min"]) : undefined,
    max: Number.isFinite(num(s["max"])) ? num(s["max"]) : undefined,
    page: Number.isFinite(num(s["page"])) && Number(s["page"]) > 1 ? Number(s["page"]) : undefined,
  };
}

export function ProductBrowser({
  search,
  to,
  lockCategory,
}: {
  search: BrowseSearch;
  to: string;
  lockCategory?: string;
}) {
  const navigate = useNavigate();
  const params: ListParams = {
    ...search,
    category: lockCategory ?? search.category,
    page: search.page ?? 1,
  };
  const { data, isLoading, isError, refetch } = useQuery(productsQuery(params));
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [showFilters, setShowFilters] = useState(false);

  const set = (patch: Partial<BrowseSearch>) =>
    navigate({
      to,
      search: (prev: BrowseSearch) => ({ ...prev, ...patch, page: undefined }),
      replace: true,
    } as never);

  const field =
    "h-11 rounded-full border border-input bg-secondary/60 px-4 text-sm text-foreground focus:border-primary/50 focus:outline-none";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isLoading
            ? "Loading products…"
            : search.q
              ? `${data?.total ?? 0} result${data?.total === 1 ? "" : "s"} for “${search.q}”`
              : `${data?.total ?? 0} product${data?.total === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`${field} inline-flex items-center gap-2 md:hidden`}
          >
            <SlidersHorizontal className="size-4" /> Filters
          </button>
          <select
            aria-label="Sort"
            value={search.sort ?? "featured"}
            onChange={(e) => set({ sort: e.target.value as BrowseSearch["sort"] })}
            className={field}
          >
            <option value="featured">{search.q ? "Best match" : "Featured"}</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
      </div>

      <div className={`${showFilters ? "flex" : "hidden"} mt-4 flex-wrap gap-2 md:flex`}>
        {!lockCategory && (
          <select
            aria-label="Category"
            value={search.category ?? ""}
            onChange={(e) => set({ category: e.target.value || undefined })}
            className={field}
          >
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          min={0}
          inputMode="decimal"
          placeholder="Min price"
          defaultValue={search.min}
          onBlur={(e) => set({ min: e.target.value ? Number(e.target.value) : undefined })}
          className={`${field} w-32`}
        />
        <input
          type="number"
          min={0}
          inputMode="decimal"
          placeholder="Max price"
          defaultValue={search.max}
          onBlur={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })}
          className={`${field} w-32`}
        />
        <label className={`${field} inline-flex cursor-pointer items-center gap-2`}>
          <input
            type="checkbox"
            checked={!!search.featured}
            onChange={(e) => set({ featured: e.target.checked || undefined })}
            className="accent-primary"
          />
          Featured only
        </label>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-secondary/60" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Unable to load products"
            text="Please check your connection and try again."
          >
            <button
              onClick={() => refetch()}
              className="h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
          </EmptyState>
        ) : data && data.items.length ? (
          <>
            <ProductGrid items={data.items} />
            <Pager
              page={data.page}
              total={data.total}
              pageSize={data.pageSize}
              to={to}
              search={search}
            />
          </>
        ) : (
          <EmptyState
            title={search.q ? `No products found for “${search.q}”` : "No products found"}
            text="Try a different search term or browse all categories."
          />
        )}
      </div>
    </div>
  );
}
