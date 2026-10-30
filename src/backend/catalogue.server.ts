import { z } from "zod";
import { database } from "./db.server";

export const catalogueInput = z
  .object({
    categorySlugs: z.array(z.string().min(1).max(200)).max(30).optional(),
    featured: z.boolean().optional(),
    min: z.number().min(0).max(1e12).optional(),
    max: z.number().min(0).max(1e12).optional(),
    terms: z.array(z.string().min(1).max(80)).max(30).optional(),
    tagTerms: z.array(z.string().min(1).max(80)).max(10).optional(),
    textTerms: z.array(z.string().min(1).max(80)).max(10).optional(),
    tags: z.array(z.string().min(1).max(200)).max(100).optional(),
    ids: z.array(z.string().uuid()).max(500).optional(),
    categoryIds: z.array(z.string().uuid()).max(100).optional(),
    excludeId: z.string().uuid().optional(),
    sort: z.enum(["featured", "newest", "updated", "price_asc", "price_desc"]).default("featured"),
    limit: z.number().int().min(1).max(500).default(24),
    offset: z.number().int().min(0).max(1e6).default(0),
  })
  .strict();
export type CatalogueInput = z.input<typeof catalogueInput>;
export interface PublicCardRow {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  featured: boolean;
  affiliate_url: string | null;
  amazon_url: string | null;
  created_at: string;
  category_id: string | null;
  category_ids: string[];
  categories: { name: string; slug: string } | null;
  product_images: { image_url: string; alt_text: string | null; sort_order: number }[];
}
const markers = (values: readonly unknown[]) => values.map(() => "?").join(",");
// Public fields only: never include drafts/trash, storage paths, actor IDs or private settings.
const columns =
  "p.id,p.name,p.slug,p.short_description,p.description,p.brand,p.price,p.currency,p.featured,p.affiliate_url,p.amazon_url,p.created_at,p.category_id,p.category_ids,c.name AS category_name,c.slug AS category_slug";
const order = {
  featured: "p.featured DESC,p.created_at DESC,p.id",
  newest: "p.created_at DESC,p.id",
  updated: "p.updated_at DESC,p.id",
  price_asc: "p.price IS NULL,p.price ASC,p.id",
  price_desc: "p.price IS NULL,p.price DESC,p.id",
} as const;
const like = (value: string) => "%" + value.replace(/[!%_]/g, (m) => "!" + m) + "%";

/** Bounded, parameterized public catalogue query; publication filtering is unconditional. */
export async function publicCatalogue(input: unknown = {}) {
  const p = catalogueInput.parse(input),
    where = ["p.active=true", "p.deleted_at IS NULL"],
    values: (string | number | boolean)[] = [];
  if (p.featured !== undefined) {
    where.push("p.featured=?");
    values.push(p.featured);
  }
  if (p.min !== undefined) {
    where.push("p.price>=?");
    values.push(p.min);
  }
  if (p.max !== undefined) {
    where.push("p.price<=?");
    values.push(p.max);
  }
  if (p.ids) {
    if (!p.ids.length) return { data: [] as PublicCardRow[], count: 0 };
    where.push("p.id IN (" + markers(p.ids) + ")");
    values.push(...p.ids);
  }
  if (p.excludeId) {
    where.push("p.id<>?");
    values.push(p.excludeId);
  }
  if (p.categorySlugs) {
    if (!p.categorySlugs.length) return { data: [] as PublicCardRow[], count: 0 };
    where.push(
      "EXISTS(SELECT 1 FROM categories fc WHERE fc.active=true AND fc.slug IN (" +
        markers(p.categorySlugs) +
        ") AND (fc.id=p.category_id OR EXISTS(SELECT 1 FROM product_categories pc WHERE pc.product_id=p.id AND pc.category_id=fc.id)))",
    );
    values.push(...p.categorySlugs);
  }
  if (p.categoryIds) {
    if (!p.categoryIds.length) return { data: [] as PublicCardRow[], count: 0 };
    where.push(
      "(p.category_id IN (" +
        markers(p.categoryIds) +
        ") OR EXISTS(SELECT 1 FROM product_categories pc WHERE pc.product_id=p.id AND pc.category_id IN (" +
        markers(p.categoryIds) +
        ")))",
    );
    values.push(...p.categoryIds, ...p.categoryIds);
  }
  if (p.tags?.length) {
    where.push(
      "EXISTS(SELECT 1 FROM product_tags pt WHERE pt.product_id=p.id AND pt.tag IN (" +
        markers(p.tags) +
        "))",
    );
    values.push(...p.tags);
  }
  if (p.tagTerms?.length) {
    where.push(
      "EXISTS(SELECT 1 FROM product_tags pt WHERE pt.product_id=p.id AND (" +
        p.tagTerms.map(() => "LOWER(pt.tag) LIKE LOWER(?) ESCAPE '!'").join(" OR ") +
        "))",
    );
    values.push(...p.tagTerms.map(like));
  }
  if (p.textTerms?.length) {
    const terms: string[] = [];
    for (const term of p.textTerms)
      for (const column of ["p.name", "p.short_description"]) {
        terms.push("LOWER(" + column + ") LIKE LOWER(?) ESCAPE '!'");
        values.push(like(term));
      }
    where.push("(" + terms.join(" OR ") + ")");
  }
  if (p.terms?.length) {
    const terms: string[] = [];
    for (const term of p.terms) {
      const pattern = like(term);
      for (const column of ["p.name", "p.short_description", "p.description", "p.brand"]) {
        terms.push("LOWER(" + column + ") LIKE LOWER(?) ESCAPE '!'");
        values.push(pattern);
      }
      terms.push(
        "EXISTS(SELECT 1 FROM product_tags pt WHERE pt.product_id=p.id AND LOWER(pt.tag) LIKE LOWER(?) ESCAPE '!')",
      );
      values.push(pattern);
      terms.push(
        "EXISTS(SELECT 1 FROM categories sc WHERE sc.active=true AND LOWER(sc.name) LIKE LOWER(?) ESCAPE '!' AND (sc.id=p.category_id OR EXISTS(SELECT 1 FROM product_categories pc WHERE pc.product_id=p.id AND pc.category_id=sc.id)))",
      );
      values.push(pattern);
    }
    where.push("(" + terms.join(" OR ") + ")");
  }
  const filter = where.join(" AND ");
  const [counts]: any = await database().execute(
    "SELECT COUNT(*) AS total FROM products p WHERE " + filter,
    values,
  );
  const [records]: any = await database().execute(
    "SELECT " +
      columns +
      " FROM products p LEFT JOIN categories c ON c.id=p.category_id AND c.active=true WHERE " +
      filter +
      " ORDER BY " +
      order[p.sort] +
      " LIMIT ? OFFSET ?",
    [...values, p.limit, p.offset],
  );
  const ids = records.map((r: any) => r.id),
    images = new Map<string, PublicCardRow["product_images"]>();
  if (ids.length) {
    const [media]: any = await database().execute(
      "SELECT product_id,image_url,alt_text,sort_order FROM product_images WHERE product_id IN (" +
        markers(ids) +
        ") ORDER BY product_id,sort_order,id",
      ids,
    );
    for (const row of media) {
      const list = images.get(row.product_id) ?? [];
      list.push({ image_url: row.image_url, alt_text: row.alt_text, sort_order: row.sort_order });
      images.set(row.product_id, list);
    }
  }
  const data: PublicCardRow[] = records.map((r: any) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    short_description: r.short_description,
    description: r.description,
    brand: r.brand,
    price: r.price === null ? null : Number(r.price),
    currency: r.currency,
    featured: Boolean(r.featured),
    affiliate_url: r.affiliate_url,
    amazon_url: r.amazon_url,
    created_at: new Date(r.created_at).toISOString(),
    category_id: r.category_id,
    category_ids:
      typeof r.category_ids === "string" ? JSON.parse(r.category_ids) : (r.category_ids ?? []),
    categories: r.category_name ? { name: r.category_name, slug: r.category_slug } : null,
    product_images: images.get(r.id) ?? [],
  }));
  return { data, count: Number(counts[0].total) };
}
