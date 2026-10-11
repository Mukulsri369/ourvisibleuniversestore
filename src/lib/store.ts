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
  "id,name,slug,short_description,price,currency,featured,affiliate_url,amazon_url,created_at,category_id,category_ids,categories(name,slug),product_images(image_url,alt_text,sort_order)";

type RawCard = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
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

export async function fetchFestivalProducts(): Promise<ProductCardData[]> {
  try {
    const db = publicDb();
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
        liveProducts().eq("featured", true).order("updated_at", { ascending: false }).limit(16),
        liveProducts().order("created_at", { ascending: false }).limit(16),
        fetchFestivalProducts(),
        liveProducts().order("created_at", { ascending: false }).limit(120),
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
  return q.replace(/[%,()*\\"']/g, " ").trim();
}

export async function listProducts(p: ListParams) {
  const db = publicDb();
  const pageSize = p.pageSize ?? 24;
  const page = Math.max(1, p.page ?? 1);
  let query = liveProducts();

  if (p.category) {
    const { data: cat } = await db
      .from("categories")
      .select("id")
      .eq("slug", p.category)
      .eq("active", true)
      .maybeSingle();
    if (!cat) return { items: [] as ProductCardData[], total: 0, page, pageSize };
    query = query.contains("category_ids", [cat.id]);
  }

  const q = p.q ? clean(p.q) : "";
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    const pattern = `%${words.join("%")}%`;
    const tagWords = words.filter((w) => w.length >= 3);
    const [tagRes, catRes] = await Promise.all([
      tagWords.length
        ? db
            .from("product_tags")
            .select("product_id")
            .or(tagWords.map((w) => `tag.ilike.%${w}%`).join(","))
            .limit(500)
        : Promise.resolve({ data: [] as { product_id: string }[] }),
      db.from("categories").select("id").ilike("name", pattern).eq("active", true),
    ]);
    const ids = [...new Set((tagRes.data ?? []).map((t) => t.product_id))];
    const catIds = (catRes.data ?? []).map((c) => c.id);
    const ors = [
      `name.ilike.${pattern}`,
      `short_description.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `brand.ilike.${pattern}`,
    ];
    if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    if (catIds.length) ors.push(`category_ids.ov.{${catIds.join(",")}}`);
    query = query.or(ors.join(","));
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
      const { data, error } = await publicDb()
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
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
