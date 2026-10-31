import {
  storePublicProduct,
  storePublicCategories,
  storePublicSettings,
} from "./store-api.functions";
import { storePublicCatalogue, storeOutboundClick } from "./catalogue-api.functions";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { productCategoryIds } from "./product-categories";

export const SITE_URL =
  (import.meta.env?.["VITE_SITE_URL"] as string | undefined) ??
  "https://store.ourvisibleuniverse.com";
export const STORE_NAME = "Our Visible Universe";

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Settings = Database["public"]["Tables"]["site_settings"]["Row"];

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description?: string | null;
  price: number | null;
  currency: string | null;
  featured: boolean;
  affiliate_url: string | null;
  created_at: string;
  category: { name: string; slug: string } | null;
  category_id?: string | null;
  category_ids?: string[];
  image: string | null;
  imageAlt: string | null;
  images?: { image_url: string; alt_text: string | null }[];
};

export type ProductFull = ProductCardData & {
  description: string | null;
  brand: string | null;
  category_id: string | null;
  category_ids: string[];
  assigned_categories: { name: string; slug: string }[];
  retailer: string | null;
  retailer_product_id: string | null;
  price_updated_at: string | null;
  images: { image_url: string; alt_text: string | null }[];
  features: string[];
  tags: string[];
};

type RawCard = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description?: string | null;
  brand?: string | null;
  price: number | null;
  currency: string | null;
  featured: boolean;
  affiliate_url: string | null;
  created_at: string;
  categories: { name: string; slug: string } | null;
  category_id?: string | null;
  category_ids?: string[] | null;
  amazon_url?: string | null;
  product_images: { image_url: string; alt_text: string | null; sort_order: number }[] | null;
};

export function toCard(r: RawCard): ProductCardData {
  const imgs = [...(r.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const catIds = Array.isArray(r.category_ids)
    ? r.category_ids
    : r.category_id
      ? [r.category_id]
      : [];
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    short_description: r.short_description,
    description: r.description ?? null,
    price: r.price,
    currency: r.currency,
    featured: r.featured,
    affiliate_url: r.affiliate_url?.trim() ? r.affiliate_url : (r.amazon_url ?? null),
    created_at: r.created_at,
    category: r.categories,
    category_id: r.category_id ?? null,
    category_ids: catIds,
    image: imgs[0]?.image_url ?? null,
    imageAlt: imgs[0]?.alt_text ?? null,
    images: imgs.map((img) => ({
      image_url: img.image_url,
      alt_text: img.alt_text,
    })),
  };
}

export function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency ?? ""} ${price}`;
  }
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidAffiliateUrl(value: string) {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && Boolean(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function absoluteUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Pure unbiased Fisher-Yates shuffle returning a newly randomized array copy.
 */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

// ---------- Queries ----------

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: () => storePublicSettings(),
  staleTime: 60_000,
});

export const LEGACY_CATEGORY_SLUG_MAP: Record<string, string> = {
  lights: "cosmic-lighting",
  lamp: "cosmic-lighting",
  projectors: "cosmic-lighting",
  lighting: "cosmic-lighting",
  spaceart: "space-wall-art",
  posters: "space-wall-art",
  "space-art": "space-wall-art",
  "space-b-day-party": "space-party-supplies",
  "bday-party": "space-party-supplies",
  clock: "clocks-timepieces",
  clocks: "clocks-timepieces",
  books: "books-guides",
  "mobile-accessories": "tech-accessories",
  "space-gadgets": "tech-accessories",
  gadgets: "tech-accessories",
  showpieces: "space-decor",
  "astronomy-apparel": "space-decor",
};

export const categoriesQuery = queryOptions({
  queryKey: ["categories", "public"],
  queryFn: () => storePublicCategories(),
  staleTime: 60_000,
});

export type FestivalSpecialConfig = {
  product_ids?: string[];
  title?: string;
  eyebrow?: string;
  description?: string;
  enabled?: boolean;
};

async function automaticFestivalProducts(limit: 12 | 16): Promise<ProductCardData[]> {
  const tagged = await storePublicCatalogue({
    data: { tagTerms: ["diwali", "light"], sort: "featured", limit },
  });
  const cards = tagged.data.map(toCard);
  if (cards.length < 8) {
    const text = await storePublicCatalogue({
      data: { textTerms: ["diwali", "light"], nameTerms: ["lamp"], sort: "featured", limit: 16 },
    });
    for (const row of text.data) {
      if (!cards.some((card) => card.id === row.id)) cards.push(toCard(row));
      if (cards.length >= (limit === 12 ? 8 : 16)) break;
    }
  }
  return cards;
}
export async function fetchFestivalProducts(): Promise<ProductCardData[]> {
  try {
    const settings = await storePublicSettings();
    const social = (settings?.social_links as Record<string, unknown> | null) ?? {};
    const special = (social.festival_special as FestivalSpecialConfig | undefined) ?? {};
    if (special.enabled === false) return [];
    const ids = Array.isArray(social.festival_product_ids)
      ? (social.festival_product_ids as string[])
      : special.product_ids;
    if (ids) {
      if (!ids.length) return [];
      const { data } = await storePublicCatalogue({ data: { ids, limit: 500 } });
      const rows = new Map(data.map((row) => [row.id, row]));
      return ids.flatMap((id) => (rows.has(id) ? [toCard(rows.get(id)!)] : []));
    }
    return await automaticFestivalProducts(12);
  } catch (error) {
    console.warn("[Store] Festival products unavailable");
    return [];
  }
}
export async function fetchAutoFestivalProductIds(): Promise<string[]> {
  try {
    return (await automaticFestivalProducts(16)).map((row) => row.id);
  } catch {
    return [];
  }
}

export const festivalQuery = queryOptions({
  queryKey: ["festival", "diwali"],
  queryFn: () => fetchFestivalProducts(),
  staleTime: 60_000,
});

export const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    try {
      const [featured, newest, festival, all] = await Promise.all([
        storePublicCatalogue({ data: { featured: true, sort: "updated", limit: 24 } }),
        storePublicCatalogue({ data: { sort: "newest", limit: 24 } }),
        fetchFestivalProducts(),
        storePublicCatalogue({ data: { sort: "newest", limit: 500 } }),
      ]);
      return {
        featured: featured.data.map(toCard),
        newest: newest.data.map(toCard),
        festival,
        allProducts: all.data.map(toCard),
      };
    } catch {
      return {
        featured: [],
        newest: [],
        festival: [],
        allProducts: [],
      };
    }
  },
});

export type ListParams = {
  q?: string | undefined;
  category?: string | undefined; // slug
  featured?: boolean | undefined;
  sort?: "featured" | "newest" | "price_asc" | "price_desc" | undefined;
  min?: number | undefined;
  max?: number | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
};

function clean(q: string) {
  return q.replace(/[%(),*\\"':;!?[\]{}]/g, " ").trim();
}

/**
 * Computes a fine-grained relevance score for a product against a search query.
 * Heavily prioritizes matching user terms in short_description and description fields,
 * with exact phrase rewards and all-term coverage multipliers.
 */
export function computeProductRelevance(
  p: {
    name: string;
    short_description?: string | null;
    description?: string | null;
    brand?: string | null;
    categories?: { name: string; slug: string } | null;
  },
  fullQuery: string,
  searchTerms: string[],
): number {
  const qClean = fullQuery.toLowerCase().trim();
  if (!qClean || searchTerms.length === 0) return 0;

  const shortDesc = (p.short_description || "").toLowerCase();
  const desc = (p.description || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  const brand = (p.brand || "").toLowerCase();
  const catName = (p.categories?.name || "").toLowerCase();

  let score = 0;
  let termsFoundInShortDesc = 0;
  let termsFoundInDesc = 0;
  let termsFoundInAny = 0;

  // 1. EXACT FULL-PHRASE MATCHES (Highest signal for user's intent)
  if (shortDesc.includes(qClean)) score += 180;
  if (desc.includes(qClean)) score += 120;
  if (name.includes(qClean)) score += 160;

  // 2. PER-TERM MATCHING WITH HEAVY EMPHASIS ON SHORT_DESCRIPTION AND DESCRIPTION
  for (const term of searchTerms) {
    let termFoundInProduct = false;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wholeWordRegex = new RegExp(`\\b${escaped}\\b`, "gi");

    // --- SHORT DESCRIPTION (Primary highlight requested) ---
    const shortExactMatches = (shortDesc.match(wholeWordRegex) || []).length;
    if (shortExactMatches > 0) {
      score += Math.min(shortExactMatches, 5) * 40; // 40 pts per exact whole-word match
      termsFoundInShortDesc++;
      termFoundInProduct = true;
    } else if (shortDesc.includes(term)) {
      score += 20; // 20 pts per substring match
      termsFoundInShortDesc++;
      termFoundInProduct = true;
    }

    // --- DESCRIPTION FIELD (Rich specs, materials, and use-cases) ---
    const descExactMatches = (desc.match(wholeWordRegex) || []).length;
    if (descExactMatches > 0) {
      score += Math.min(descExactMatches, 8) * 25; // 25 pts per exact whole-word match
      termsFoundInDesc++;
      termFoundInProduct = true;
    } else if (desc.includes(term)) {
      score += 14; // 14 pts per substring match
      termsFoundInDesc++;
      termFoundInProduct = true;
    }

    // --- NAME / TITLE ---
    const nameExactMatches = (name.match(wholeWordRegex) || []).length;
    if (nameExactMatches > 0) {
      score += Math.min(nameExactMatches, 3) * 35;
      termFoundInProduct = true;
    } else if (name.includes(term)) {
      score += 18;
      termFoundInProduct = true;
    }

    // --- BRAND & CATEGORY ---
    if (brand.includes(term)) {
      score += 20;
      termFoundInProduct = true;
    }
    if (catName.includes(term)) {
      score += 25;
      termFoundInProduct = true;
    }

    if (termFoundInProduct) {
      termsFoundInAny++;
    }
  }

  // 3. COVERAGE REWARD (Multi-word queries: products containing all words beat single-word repeats)
  const coverageRatio = termsFoundInAny / searchTerms.length;
  if (coverageRatio === 1) {
    score += 120; // All words specified by the user exist in the product!
  } else if (coverageRatio >= 0.75) {
    score += 60;
  } else if (coverageRatio >= 0.5) {
    score += 30;
  }

  // Extra bonus if all search words are present within the short description
  if (searchTerms.length > 1 && termsFoundInShortDesc === searchTerms.length) {
    score += 70;
  }
  // Extra bonus if all search words are present within the description
  if (searchTerms.length > 1 && termsFoundInDesc === searchTerms.length) {
    score += 50;
  }

  return score;
}

export async function listProducts(p: ListParams) {
  const pageSize = Math.max(1, Math.min(500, Math.floor(p.pageSize ?? 24)));
  const page = Math.max(1, p.page ?? 1);

  const q = p.q ? clean(p.q) : "";

  // ----------------------------------------------------
  // INTELLIGENT RELEVANCE-BASED SEARCH (when p.q is present)
  // ----------------------------------------------------
  if (q) {
    const rawWords = q
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
      .filter((w) => w.length > 0);

    const STOP_WORDS = new Set([
      "a",
      "an",
      "the",
      "and",
      "or",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "is",
      "it",
      "by",
      "from",
    ]);
    const coreWords = rawWords.filter((w) => !STOP_WORDS.has(w) && w.length >= 2);
    const searchTerms = coreWords.length > 0 ? coreWords : rawWords;

    const { data: rawList } = await storePublicCatalogue({
      data: {
        ...catalogueFilters(p),
        terms: searchTerms.slice(0, 30),
        limit: 200,
      },
    });

    // Calculate fine-grained relevance score prioritizing short_description and description
    const scoredList = rawList
      .map((item) => ({
        item,
        score: computeProductRelevance(item, q, searchTerms),
      }))
      .filter((x) => x.score > 0);

    // Sort by user's explicit preference or by highest relevance score
    if (p.sort === "price_asc") {
      scoredList.sort((a, b) => (a.item.price ?? Infinity) - (b.item.price ?? Infinity));
    } else if (p.sort === "price_desc") {
      scoredList.sort((a, b) => (b.item.price ?? -Infinity) - (a.item.price ?? -Infinity));
    } else if (p.sort === "newest") {
      scoredList.sort(
        (a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime(),
      );
    } else {
      // Default: Highest relevance score first. Ties broken by featured status, then newest
      scoredList.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.item.featured !== a.item.featured) return b.item.featured ? 1 : -1;
        return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
      });
    }

    const total = scoredList.length;
    const from = (page - 1) * pageSize;
    const paged = scoredList.slice(from, from + pageSize).map((x) => toCard(x.item));

    return { items: paged, total, page, pageSize };
  }

  const { data, count } = await storePublicCatalogue({
    data: {
      ...catalogueFilters(p),
      sort: p.sort ?? "featured",
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  });
  return { items: data.map(toCard), total: count, page, pageSize };
}

function categoryAliases(slug: string) {
  return [
    ...new Set(
      [
        slug,
        LEGACY_CATEGORY_SLUG_MAP[slug],
        ...Object.entries(LEGACY_CATEGORY_SLUG_MAP)
          .filter(([, target]) => target === slug)
          .map(([legacy]) => legacy),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
}
function catalogueFilters(p: ListParams) {
  return {
    ...(p.category ? { categorySlugs: categoryAliases(p.category) } : {}),
    ...(p.featured ? { featured: true } : {}),
    ...(p.min != null && !Number.isNaN(p.min) ? { min: p.min } : {}),
    ...(p.max != null && !Number.isNaN(p.max) ? { max: p.max } : {}),
  };
}

export const productsQuery = (p: ListParams) =>
  queryOptions({ queryKey: ["products", p], queryFn: () => listProducts(p) });

export const categoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    queryFn: async () => {
      const categories = await storePublicCategories();
      for (const candidate of categoryAliases(slug)) {
        const category = categories.find((row) => row.slug === candidate);
        if (category) return category;
      }
      return null;
    },
  });

export async function fetchProductFull(slug: string): Promise<ProductFull | null> {
  const data = await storePublicProduct({ data: { slug } });
  if (!data) return null;
  const r = data as unknown as RawCard & {
    category_id: string | null;
    category_ids: string[];
    description: string | null;
    brand: string | null;
    retailer: string | null;
    retailer_product_id: string | null;
    price_updated_at: string | null;
    product_features: { feature: string; sort_order: number }[];
    product_tags: { tag: string }[];
  };
  const imgs = [...(r.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const categoryIds = productCategoryIds(r);
  const assigned: { id: string; name: string; slug: string }[] = data.assigned_categories;
  return {
    ...toCard(r),
    category_id: r.category_id,
    category_ids: categoryIds,
    assigned_categories: categoryIds.flatMap((id) => {
      const category = assigned?.find((c) => c.id === id);
      return category ? [{ name: category.name, slug: category.slug }] : [];
    }),
    description: r.description,
    brand: r.brand,
    retailer: r.retailer,
    retailer_product_id: r.retailer_product_id,
    price_updated_at: r.price_updated_at,
    images: imgs.map((i) => ({ image_url: i.image_url, alt_text: i.alt_text })),
    features: [...(r.product_features ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => f.feature),
    tags: (r.product_tags ?? []).map((t) => t.tag),
  };
}

export const productQuery = (slug: string) =>
  queryOptions({ queryKey: ["product", slug], queryFn: () => fetchProductFull(slug) });

export const relatedQuery = (p: {
  id: string;
  category_id: string | null;
  category_ids?: string[];
  tags: string[];
}) =>
  queryOptions({
    queryKey: ["related", p.id, productCategoryIds(p), p.tags],
    queryFn: async () => {
      const out: ProductCardData[] = [];
      const categoryIds = productCategoryIds(p);
      if (categoryIds.length) {
        const { data } = await storePublicCatalogue({
          data: { categoryIds, excludeId: p.id, sort: "featured", limit: 4 },
        });
        out.push(...data.map(toCard));
      }
      if (out.length < 4 && p.tags.length) {
        const { data } = await storePublicCatalogue({
          data: { tags: p.tags, excludeId: p.id, limit: 20 },
        });
        for (const row of data) {
          if (!out.some((card) => card.id === row.id)) out.push(toCard(row));
          if (out.length >= 4) break;
        }
      }
      if (out.length < 4) {
        const { data } = await storePublicCatalogue({
          data: { excludeId: p.id, featured: true, limit: 8 },
        });
        for (const row of data) {
          if (!out.some((card) => card.id === row.id)) out.push(toCard(row));
          if (out.length >= 4) break;
        }
      }
      return out;
    },
  });

export async function fetchCategoryQualityProducts(slug: string): Promise<ProductCardData[]> {
  try {
    const categories = await storePublicCategories();
    const cat = categories.find((row) => row.slug === slug);
    if (!cat) return [];
    const { data: featured } = await storePublicCatalogue({
      data: { categoryIds: [cat.id], featured: true, sort: "newest", limit: 4 },
    });
    const cards = featured.map(toCard);
    if (cards.length < 4) {
      const { data: more } = await storePublicCatalogue({
        data: { categoryIds: [cat.id], sort: "newest", limit: 8 },
      });
      for (const row of more) {
        if (!cards.some((card) => card.id === row.id)) cards.push(toCard(row));
        if (cards.length >= 4) break;
      }
    }
    return cards;
  } catch (err) {
    console.error("Failed to fetch quality products for category:", err);
    return [];
  }
}

export const categoryQualityProductsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category-quality-products", slug],
    queryFn: () => fetchCategoryQualityProducts(slug),
    staleTime: 60_000,
  });

/** Fire-and-forget outbound affiliate click log. Never blocks navigation. */
export function logOutboundClick(productId: string) {
  try {
    void storeOutboundClick({ data: { productId } }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/** Public homepage query result shared with the visual editor. */
export type HomeData = {
  featured: ProductCardData[];
  newest: ProductCardData[];
  festival: ProductCardData[];
  allProducts: ProductCardData[];
};
