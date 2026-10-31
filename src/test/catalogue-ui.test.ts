import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCardRow } from "@/backend/catalogue.server";
import {
  categoryQuery,
  fetchFestivalProducts,
  homeQuery,
  listProducts,
  logOutboundClick,
  relatedQuery,
  type Category,
  type Settings,
} from "@/lib/store";
import { storePublicCatalogue, storeOutboundClick } from "@/lib/catalogue-api.functions";
import { storePublicCategories, storePublicSettings } from "@/lib/store-api.functions";
vi.mock("@/lib/catalogue-api.functions", () => ({
  storePublicCatalogue: vi.fn(),
  storeOutboundClick: vi.fn(),
}));
vi.mock("@/lib/store-api.functions", () => ({
  storePublicCategories: vi.fn(),
  storePublicSettings: vi.fn(),
  storePublicProduct: vi.fn(),
}));
const catalogue = vi.mocked(storePublicCatalogue),
  settings = vi.mocked(storePublicSettings);
const row = (index: number): PublicCardRow => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  name: `Synthetic product ${index}`,
  slug: `synthetic-${index}`,
  short_description: null,
  description: null,
  brand: null,
  price: index,
  currency: "INR",
  featured: false,
  affiliate_url: `https://www.amazon.in/dp/SYNTHETIC?tag=Exact%2BBytes&ref=${index}`,
  amazon_url: null,
  created_at: "2026-10-01T00:00:00Z",
  category_id: null,
  category_ids: [],
  categories: null,
  product_images: [{ image_url: "/synthetic.webp", alt_text: "Synthetic image", sort_order: 0 }],
});
const withSocial = (social_links: Settings["social_links"]): Settings => ({
  id: 1,
  store_name: "Synthetic store",
  logo_url: null,
  footer_text: "Synthetic footer",
  affiliate_disclosure: "Synthetic affiliate disclosure",
  instagram_url: null,
  contact_email: null,
  updated_at: "2026-10-01T00:00:00Z",
  social_links,
});
beforeEach(() => {
  vi.resetAllMocks();
  catalogue.mockResolvedValue({ data: [], count: 0 });
  settings.mockResolvedValue(null);
  vi.mocked(storePublicCategories).mockResolvedValue([]);
});
describe("independent public catalogue UI queries", () => {
  it("loads all homepage rails with their existing limits and sort orders", async () => {
    settings.mockResolvedValue(withSocial({ festival_special: { enabled: false } }));
    catalogue.mockImplementation(async ({ data }) => ({
      data: [row(data.sort === "updated" ? 1 : data.limit === 500 ? 3 : 2)],
      count: 1,
    }));
    const home = await (homeQuery.queryFn as () => Promise<any>)();
    expect(home.featured[0].id).toBe(row(1).id);
    expect(home.newest[0].id).toBe(row(2).id);
    expect(home.allProducts[0].id).toBe(row(3).id);
    expect(home.festival).toEqual([]);
    expect(catalogue).toHaveBeenCalledWith({
      data: { featured: true, sort: "updated", limit: 24 },
    });
    expect(catalogue).toHaveBeenCalledWith({ data: { sort: "newest", limit: 24 } });
    expect(catalogue).toHaveBeenCalledWith({ data: { sort: "newest", limit: 500 } });
  });
  it("preserves curated festival order, skips unavailable IDs and keeps affiliate bytes", async () => {
    settings.mockResolvedValue(
      withSocial({ festival_product_ids: [row(2).id, row(9).id, row(1).id] }),
    );
    catalogue.mockResolvedValue({ data: [row(1), row(2)], count: 2 });
    const products = await fetchFestivalProducts();
    expect(products.map((p) => p.id)).toEqual([row(2).id, row(1).id]);
    expect(products[0].affiliate_url).toBe(row(2).affiliate_url);
  });
  it("fills automatic festival selections without duplicates and stops at eight", async () => {
    catalogue
      .mockResolvedValueOnce({ data: Array.from({ length: 6 }, (_, i) => row(i + 1)), count: 6 })
      .mockResolvedValueOnce({ data: [row(1), row(7), row(8), row(9)], count: 4 });
    expect((await fetchFestivalProducts()).map((p) => p.id)).toEqual(
      Array.from({ length: 8 }, (_, i) => row(i + 1).id),
    );
    expect(catalogue).toHaveBeenLastCalledWith({
      data: { textTerms: ["diwali", "light"], nameTerms: ["lamp"], sort: "featured", limit: 16 },
    });
  });
  it("preserves relevance scoring, stopwords, price sorting and paginated totals", async () => {
    const high = {
      ...row(2),
      short_description: "Astronomy telescope for deep sky astronomy",
      name: "Synthetic optics",
    };
    const low = { ...row(1), name: "Synthetic telescope", featured: true };
    catalogue.mockResolvedValue({ data: [low, high], count: 2 });
    const first = await listProducts({ q: "the telescope for astronomy", pageSize: 1 });
    expect(first.items.map((p) => p.id)).toEqual([high.id]);
    expect(first.total).toBe(2);
    expect(catalogue).toHaveBeenCalledWith({
      data: { terms: ["telescope", "astronomy"], limit: 200 },
    });
    const second = await listProducts({ q: "the telescope for astronomy", pageSize: 1, page: 2 });
    expect(second.items[0].id).toBe(low.id);
    const price = await listProducts({ q: "telescope astronomy", sort: "price_asc" });
    expect(price.items.map((p) => p.id)).toEqual([low.id, high.id]);
  });
  it("prefers exact category slugs and supports forward and reverse aliases", async () => {
    const legacy = { id: row(1).id, slug: "lights" } as Category;
    const mapped = { id: row(2).id, slug: "cosmic-lighting" } as Category;
    vi.mocked(storePublicCategories).mockResolvedValue([mapped, legacy]);
    expect(await (categoryQuery("lights").queryFn as () => Promise<Category>)()).toEqual(legacy);
    vi.mocked(storePublicCategories).mockResolvedValue([mapped]);
    expect(await (categoryQuery("lights").queryFn as () => Promise<Category>)()).toEqual(mapped);
    vi.mocked(storePublicCategories).mockResolvedValue([legacy]);
    expect(await (categoryQuery("cosmic-lighting").queryFn as () => Promise<Category>)()).toEqual(
      legacy,
    );
  });
  it("combines category, tag and featured related products without duplicates", async () => {
    catalogue
      .mockResolvedValueOnce({ data: [row(1)], count: 1 })
      .mockResolvedValueOnce({ data: [row(1), row(2)], count: 2 })
      .mockResolvedValueOnce({ data: [row(2), row(3), row(4), row(5)], count: 4 });
    const query = relatedQuery({
      id: row(9).id,
      category_id: row(10).id,
      category_ids: [row(10).id, row(11).id],
      tags: ["synthetic"],
    });
    const products = await (query.queryFn as () => Promise<any[]>)();
    expect(products.map((p) => p.id)).toEqual([row(1).id, row(2).id, row(3).id, row(4).id]);
    expect(catalogue).toHaveBeenNthCalledWith(1, {
      data: {
        categoryIds: [row(10).id, row(11).id],
        excludeId: row(9).id,
        sort: "featured",
        limit: 4,
      },
    });
  });
  it("does not let analytics failure block an affiliate navigation", async () => {
    vi.mocked(storeOutboundClick).mockRejectedValue(new Error("Synthetic unavailable analytics"));
    expect(logOutboundClick(row(1).id)).toBeUndefined();
    await Promise.resolve();
    expect(storeOutboundClick).toHaveBeenCalledWith({ data: { productId: row(1).id } });
  });
  it("keeps the existing empty festival fallback on database failure", async () => {
    catalogue.mockRejectedValue(new Error("Synthetic database unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await fetchFestivalProducts()).toEqual([]);
    } finally {
      warning.mockRestore();
    }
  });
});
