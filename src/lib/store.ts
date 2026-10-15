import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { productCategoryIds } from "./product-categories";

export const SITE_URL =
  (import.meta.env?.["VITE_SITE_URL"] as string | undefined) ??
  "https://store.ourvisibleuniverse.com";
export const STORE_NAME = "Our Visible Universe";

const DEFAULT_SUPABASE_URL = "https://c--e5dc52fc-4129-47cd-9ba2-1c20a9af2f78-prod.lovable.cloud";
const DEFAULT_SUPABASE_KEY = "sb_publishable_LnvKmEnYxmXbvplWO-pkgw_6cxxCkYL";

let _client: ReturnType<typeof createClient<Database>> | null = null;

/** Session-less client for public reads. Row Level Security limits it to live products. */
export function publicDb() {
  if (_client) return _client;
  const url =
    (import.meta.env?.["VITE_SUPABASE_URL"] as string | undefined) ||
    (process.env["SUPABASE_URL"] as string | undefined) ||
    DEFAULT_SUPABASE_URL;
  const key =
    (import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
    (process.env["SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
    DEFAULT_SUPABASE_KEY;

  _client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key && key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        if (key) {
          h.set("apikey", key);
        }
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  return _client;
}

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

export const CARD_SELECT =
  "id,name,slug,short_description,description,price,currency,featured,affiliate_url,amazon_url,created_at,category_id,category_ids,categories(name,slug),product_images(image_url,alt_text,sort_order)";

export const SEARCH_SELECT = `${CARD_SELECT},brand`;

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

function liveProducts() {
  return publicDb()
    .from("products")
    .select(CARD_SELECT, { count: "exact" })
    .eq("active", true)
    .is("deleted_at", null);
}

// ---------- Queries ----------

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await publicDb()
      .from("public_site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data ? { ...data, contact_email: null } : null;
  },
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
  queryFn: async () => {
    const { data, error } = await publicDb()
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export type FestivalSpecialConfig = {
  product_ids?: string[];
  title?: string;
  eyebrow?: string;
  description?: string;
  enabled?: boolean;
};

export async function fetchFestivalProducts(): Promise<ProductCardData[]> {
  try {
    const db = publicDb();

    // 1. Check if configured in site_settings (via public_site_settings view)
    const { data: settingsRow } = await db
      .from("public_site_settings")
      .select("social_links")
      .eq("id", 1)
      .maybeSingle();

    const social = (settingsRow?.social_links as Record<string, unknown> | null) || {};
    const festSpecial = (social.festival_special as Record<string, unknown> | undefined) || {};

    // If admin explicitly disabled festival section, return empty list
    if (festSpecial.enabled === false) {
      return [];
    }

    const configuredIds: string[] | null = Array.isArray(social.festival_product_ids)
      ? (social.festival_product_ids as string[])
      : Array.isArray(festSpecial.product_ids)
        ? (festSpecial.product_ids as string[])
        : null;

    if (configuredIds !== null) {
      if (configuredIds.length === 0) {
        return [];
      }
      const { data: products } = await liveProducts().in("id", configuredIds);
      if (products && products.length > 0) {
        const productMap = new Map<string, RawCard>();
        for (const p of products as unknown as RawCard[]) {
          productMap.set(p.id, p);
        }
        // Preserve exact admin-curated order
        const ordered: RawCard[] = [];
        for (const id of configuredIds) {
          const item = productMap.get(id);
          if (item) ordered.push(item);
        }
        return ordered.map(toCard);
      }
      return [];
    }

    // Fallback: automatic detection by diwali and light tags
    const { data: tagRows } = await db
      .from("product_tags")
      .select("product_id")
      .or("tag.ilike.%diwali%,tag.ilike.%light%")
      .limit(200);

    const taggedIds = [...new Set((tagRows ?? []).map((t) => t.product_id))];

    const festivalCards: RawCard[] = [];
    const seenIds = new Set<string>();

    if (taggedIds.length > 0) {
      const { data: taggedProducts } = await liveProducts()
        .in("id", taggedIds)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);

      if (taggedProducts) {
        for (const p of taggedProducts as unknown as RawCard[]) {
          if (!seenIds.has(p.id)) {
            festivalCards.push(p);
            seenIds.add(p.id);
          }
        }
      }
    }

    if (festivalCards.length < 8) {
      const { data: textProducts } = await liveProducts()
        .or(
          "name.ilike.%diwali%,name.ilike.%light%,name.ilike.%lamp%,short_description.ilike.%diwali%,short_description.ilike.%light%",
        )
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(16);

      if (textProducts) {
        for (const p of textProducts as unknown as RawCard[]) {
          if (!seenIds.has(p.id)) {
            festivalCards.push(p);
            seenIds.add(p.id);
          }
          if (festivalCards.length >= 8) break;
        }
      }
    }

    return festivalCards.map(toCard);
  } catch (err) {
    console.warn("[Store] fetchFestivalProducts error:", err);
    return [];
  }
}

export async function fetchAutoFestivalProductIds(): Promise<string[]> {
  try {
    const db = publicDb();
    const { data: tagRows } = await db
      .from("product_tags")
      .select("product_id")
      .or("tag.ilike.%diwali%,tag.ilike.%light%")
      .limit(100);

    const taggedIds = [...new Set((tagRows ?? []).map((t) => t.product_id))];
    const ids: string[] = [];
    const seen = new Set<string>();

    if (taggedIds.length > 0) {
      const { data } = await liveProducts()
        .in("id", taggedIds)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(16);
      if (data) {
        for (const p of data as unknown as RawCard[]) {
          if (!seen.has(p.id)) {
            ids.push(p.id);
            seen.add(p.id);
          }
        }
      }
    }

    if (ids.length < 8) {
      const { data } = await liveProducts()
        .or(
          "name.ilike.%diwali%,name.ilike.%light%,name.ilike.%lamp%,short_description.ilike.%diwali%,short_description.ilike.%light%",
        )
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(16);
      if (data) {
        for (const p of data as unknown as RawCard[]) {
          if (!seen.has(p.id)) {
            ids.push(p.id);
            seen.add(p.id);
          }
          if (ids.length >= 16) break;
        }
      }
    }
    return ids;
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
        liveProducts().eq("featured", true).order("updated_at", { ascending: false }).limit(24),
        liveProducts().order("created_at", { ascending: false }).limit(24),
        fetchFestivalProducts(),
        liveProducts().order("created_at", { ascending: false }).limit(500),
      ]);
      if (featured.error) throw featured.error;
      if (newest.error) throw newest.error;
      return {
        featured: (featured.data as unknown as RawCard[]).map(toCard),
        newest: (newest.data as unknown as RawCard[]).map(toCard),
        festival,
        allProducts: ((all.data ?? []) as unknown as RawCard[]).map(toCard),
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
  const db = publicDb();
  const pageSize = p.pageSize ?? 24;
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

    // Build PostgREST candidate filter across name, short_description, description, brand & tags
    const tagWords = searchTerms.filter((w) => w.length >= 2);
    const [tagRes, catRes] = await Promise.all([
      tagWords.length
        ? db
            .from("product_tags")
            .select("product_id")
            .or(tagWords.map((w) => `tag.ilike.%${w}%`).join(","))
            .limit(500)
        : Promise.resolve({ data: [] as { product_id: string }[] }),
      searchTerms.length
        ? db
            .from("categories")
            .select("id")
            .or(searchTerms.map((w) => `name.ilike.%${w}%`).join(","))
            .eq("active", true)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

    const tagProductIds = [...new Set((tagRes.data ?? []).map((t) => t.product_id))];
    const matchingCatIds = (catRes.data ?? []).map((c) => c.id);

    const ors: string[] = [];
    for (const term of searchTerms) {
      ors.push(`name.ilike.%${term}%`);
      ors.push(`short_description.ilike.%${term}%`);
      ors.push(`description.ilike.%${term}%`);
      ors.push(`brand.ilike.%${term}%`);
    }
    if (tagProductIds.length) ors.push(`id.in.(${tagProductIds.slice(0, 100).join(",")})`);
    if (matchingCatIds.length) ors.push(`category_ids.ov.{${matchingCatIds.join(",")}}`);

    let searchQuery = publicDb()
      .from("products")
      .select(SEARCH_SELECT)
      .eq("active", true)
      .is("deleted_at", null);

    if (p.category) {
      const candidateSlugs = Array.from(
        new Set(
          [
            p.category,
            LEGACY_CATEGORY_SLUG_MAP[p.category],
            ...Object.entries(LEGACY_CATEGORY_SLUG_MAP)
              .filter(([, target]) => target === p.category)
              .map(([legacy]) => legacy),
          ].filter(Boolean) as string[],
        ),
      );

      const { data: matchedCats } = await db
        .from("categories")
        .select("id")
        .in("slug", candidateSlugs)
        .eq("active", true);

      const catIds = (matchedCats ?? []).map((c) => c.id);
      if (catIds.length === 0) return { items: [] as ProductCardData[], total: 0, page, pageSize };
      searchQuery = searchQuery.overlaps("category_ids", catIds);
    }

    if (ors.length > 0) {
      searchQuery = searchQuery.or(ors.join(","));
    }
    if (p.featured) searchQuery = searchQuery.eq("featured", true);
    if (p.min != null && !Number.isNaN(p.min)) searchQuery = searchQuery.gte("price", p.min);
    if (p.max != null && !Number.isNaN(p.max)) searchQuery = searchQuery.lte("price", p.max);

    // Fetch candidate products (up to 200 matches)
    const { data: candidates, error: searchErr } = await searchQuery.limit(200);
    if (searchErr) throw searchErr;

    const rawList = (candidates as unknown as RawCard[]) ?? [];

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

  // ----------------------------------------------------
  // STANDARD CATALOG BROWSING (when no search query is specified)
  // ----------------------------------------------------
  let query = liveProducts();

  if (p.category) {
    const candidateSlugs = Array.from(
      new Set(
        [
          p.category,
          LEGACY_CATEGORY_SLUG_MAP[p.category],
          ...Object.entries(LEGACY_CATEGORY_SLUG_MAP)
            .filter(([, target]) => target === p.category)
            .map(([legacy]) => legacy),
        ].filter(Boolean) as string[],
      ),
    );

    const { data: matchedCats } = await db
      .from("categories")
      .select("id")
      .in("slug", candidateSlugs)
      .eq("active", true);

    const catIds = (matchedCats ?? []).map((c) => c.id);
    if (catIds.length === 0) return { items: [] as ProductCardData[], total: 0, page, pageSize };
    query = query.overlaps("category_ids", catIds);
  }

  if (p.featured) query = query.eq("featured", true);
  if (p.min != null && !Number.isNaN(p.min)) query = query.gte("price", p.min);
  if (p.max != null && !Number.isNaN(p.max)) query = query.lte("price", p.max);

  switch (p.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { items: (data as unknown as RawCard[]).map(toCard), total: count ?? 0, page, pageSize };
}

export const productsQuery = (p: ListParams) =>
  queryOptions({ queryKey: ["products", p], queryFn: () => listProducts(p) });

export const categoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    queryFn: async () => {
      const db = publicDb();
      // 1. Try exact slug first
      const { data, error } = await db
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;

      // 2. Try forward legacy mapped slug (e.g. lights -> cosmic-lighting)
      const mapped = LEGACY_CATEGORY_SLUG_MAP[slug];
      if (mapped && mapped !== slug) {
        const { data: mData } = await db
          .from("categories")
          .select("*")
          .eq("slug", mapped)
          .eq("active", true)
          .maybeSingle();
        if (mData) return mData;
      }

      // 3. Try reverse mapped slugs (e.g. before migration is executed, cosmic-lighting -> lights)
      for (const [legacy, target] of Object.entries(LEGACY_CATEGORY_SLUG_MAP)) {
        if (target === slug) {
          const { data: lData } = await db
            .from("categories")
            .select("*")
            .eq("slug", legacy)
            .eq("active", true)
            .maybeSingle();
          if (lData) return lData;
        }
      }

      return null;
    },
  });

export async function fetchProductFull(slug: string): Promise<ProductFull | null> {
  const { data, error } = await publicDb()
    .from("products")
    .select(
      `${CARD_SELECT},description,brand,retailer,retailer_product_id,price_updated_at,product_features(feature,sort_order),product_tags(tag)`,
    )
    .eq("slug", slug)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
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
  const { data: assigned, error: categoryError } = categoryIds.length
    ? await publicDb()
        .from("categories")
        .select("id,name,slug")
        .in("id", categoryIds)
        .eq("active", true)
    : { data: [], error: null };
  if (categoryError) throw categoryError;
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
      const db = publicDb();
      const out: ProductCardData[] = [];
      const categoryIds = productCategoryIds(p);
      if (categoryIds.length) {
        const { data } = await liveProducts()
          .overlaps("category_ids", categoryIds)
          .neq("id", p.id)
          .order("featured", { ascending: false })
          .limit(4);
        out.push(...((data ?? []) as unknown as RawCard[]).map(toCard));
      }
      if (out.length < 4 && p.tags.length) {
        const { data: tagRows } = await db
          .from("product_tags")
          .select("product_id")
          .in("tag", p.tags)
          .limit(100);
        const ids = [...new Set((tagRows ?? []).map((t) => t.product_id))].filter(
          (id) => id !== p.id && !out.some((o) => o.id === id),
        );
        if (ids.length) {
          const { data } = await liveProducts()
            .in("id", ids.slice(0, 20))
            .limit(4 - out.length);
          out.push(...((data ?? []) as unknown as RawCard[]).map(toCard));
        }
      }
      if (out.length < 4) {
        const { data } = await liveProducts().neq("id", p.id).eq("featured", true).limit(8);
        for (const c of ((data ?? []) as unknown as RawCard[]).map(toCard)) {
          if (out.length >= 4) break;
          if (!out.some((o) => o.id === c.id)) out.push(c);
        }
      }
      return out;
    },
  });

export async function fetchCategoryQualityProducts(slug: string): Promise<ProductCardData[]> {
  try {
    const db = publicDb();
    const { data: cat } = await db
      .from("categories")
      .select("id")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    if (!cat) return [];

    // Prioritize explicitly featured products in this category
    const { data: featuredData } = await liveProducts()
      .contains("category_ids", [cat.id])
      .eq("featured", true)
      .order("created_at", { ascending: false })
      .limit(4);

    const cards: ProductCardData[] = ((featuredData ?? []) as unknown as RawCard[]).map(toCard);
    const seenIds = new Set(cards.map((c) => c.id));

    // If fewer than 4, fill remaining slots with the latest products in this category
    if (cards.length < 4) {
      const { data: moreData } = await liveProducts()
        .contains("category_ids", [cat.id])
        .order("created_at", { ascending: false })
        .limit(8);

      if (moreData) {
        for (const item of moreData as unknown as RawCard[]) {
          if (!seenIds.has(item.id)) {
            cards.push(toCard(item));
            seenIds.add(item.id);
            if (cards.length >= 4) break;
          }
        }
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
    void publicDb()
      .from("outbound_clicks")
      .insert({ product_id: productId })
      .then(() => undefined);
  } catch {
    /* ignore */
  }
}
