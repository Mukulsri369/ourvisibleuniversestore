import type { Database } from "@/integrations/supabase/types";
import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
const admin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const [{ getRequest }, { independentAuth }, { requireAdmin }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("@/backend/runtime.server"),
    import("@/backend/authorization.server"),
  ]);
  const session = await independentAuth().api.getSession({ headers: getRequest().headers });
  const principal = await requireAdmin(session?.user ?? null);
  return next({ context: { principal } });
});
export const storeAdminIdentity = createServerFn({ method: "GET" })
  .middleware([admin])
  .handler(async ({ context }) => ({ user: context.principal }));
export const saveStoreProduct = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const { saveProduct } = await import("@/backend/products.server");
    return saveProduct(context.principal, data);
  });
export const loadStoreProduct = createServerFn({ method: "GET" })
  .middleware([admin])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | (Database["public"]["Tables"]["products"]["Row"] & {
          revision: number;
          product_images: Database["public"]["Tables"]["product_images"]["Row"][];
          product_features: Database["public"]["Tables"]["product_features"]["Row"][];
          product_tags: Database["public"]["Tables"]["product_tags"]["Row"][];
        })
      | null
    > => {
      const { database } = await import("@/backend/db.server");
      const [rows]: any = await database().execute("SELECT * FROM products WHERE id=?", [data.id]);
      if (!rows.length) return null;
      const product = rows[0];
      product.active = Boolean(product.active);
      product.featured = Boolean(product.featured);
      product.price = product.price === null ? null : Number(product.price);
      for (const table of ["product_images", "product_features", "product_tags"]) {
        const [children] = await database().execute(
          "SELECT * FROM " + table + " WHERE product_id=?",
          [data.id],
        );
        product[table] = children;
      }
      for (const key of ["created_at", "updated_at", "deleted_at", "price_updated_at"])
        if (product[key]) product[key] = new Date(product[key]).toISOString();
      return product;
    },
  );
export const availableStoreSlug = createServerFn({ method: "GET" })
  .middleware([admin])
  .inputValidator((input) =>
    z.object({ slug: z.string().max(200), id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { database } = await import("@/backend/db.server");
    const [rows]: any = await database().execute("SELECT id FROM products WHERE slug=? AND id<>?", [
      data.slug,
      data.id ?? "",
    ]);
    return rows.length === 0;
  });

export const storeAdminCategories = createServerFn({ method: "GET" })
  .middleware([admin])
  .handler(async (): Promise<Database["public"]["Tables"]["categories"]["Row"][]> => {
    const { database } = await import("@/backend/db.server");
    const [rows]: any = await database().execute(
      "SELECT * FROM categories ORDER BY sort_order,name",
    );
    return rows;
  });
export const storeDuplicateCatalog = createServerFn({ method: "GET" })
  .middleware([admin])
  .handler(async (): Promise<import("./duplicate-detector").CatalogProduct[]> => {
    const { database } = await import("@/backend/db.server");
    const [rows]: any = await database().execute(
      "SELECT p.*,c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 1000",
    );
    for (const row of rows) {
      const [images] = await database().execute(
        "SELECT image_url,sort_order FROM product_images WHERE product_id=? ORDER BY sort_order",
        [row.id],
      );
      row.product_images = images;
      row.categories = row.category_name ? { name: row.category_name } : null;
      row.active = Boolean(row.active);
      row.featured = Boolean(row.featured);
      row.price = row.price === null ? null : Number(row.price);
    }
    return rows;
  });

export const storePublicProduct = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { database } = await import("@/backend/db.server");
    const [rows]: any = await database().execute(
      "SELECT * FROM products WHERE slug=? AND active=true AND deleted_at IS NULL",
      [data.slug],
    );
    if (!rows.length) return null;
    const p = rows[0];
    for (const key of ["created_at", "updated_at", "deleted_at", "price_updated_at"])
      if (p[key]) p[key] = new Date(p[key]).toISOString();
    const [images]: any = await database().execute(
      "SELECT image_url,alt_text,sort_order FROM product_images WHERE product_id=? ORDER BY sort_order",
      [p.id],
    );
    const [features]: any = await database().execute(
      "SELECT feature,sort_order FROM product_features WHERE product_id=? ORDER BY sort_order",
      [p.id],
    );
    const [tags]: any = await database().execute(
      "SELECT tag FROM product_tags WHERE product_id=?",
      [p.id],
    );
    const [assigned]: any = await database().execute(
      "SELECT c.id,c.name,c.slug FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=? AND c.active=true ORDER BY pc.position",
      [p.id],
    );
    const [legacy]: any = await database().execute(
      "SELECT name,slug FROM categories WHERE id=? AND active=true",
      [p.category_id],
    );
    return {
      ...p,
      price: p.price === null ? null : Number(p.price),
      active: Boolean(p.active),
      featured: Boolean(p.featured),
      categories: legacy[0] ?? null,
      assigned_categories: assigned,
      product_images: images,
      product_features: features,
      product_tags: tags,
    };
  });

export const updateStoreProductPrice = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        expectedRevision: z.number().int().min(0),
        price: z.number().finite().nonnegative().nullable(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        active: z.literal(false).optional(),
        retailer: z.string().optional(),
        retailer_product_id: z.string().optional(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { database, transaction } = await import("@/backend/db.server");
    return transaction(async (c) => {
      const { requireAdmin } = await import("@/backend/authorization.server");
      await requireAdmin(context.principal, c);
      const [rows]: any = await c.execute("SELECT revision FROM products WHERE id=? FOR UPDATE", [
        data.id,
      ]);
      if (!rows.length || rows[0].revision !== data.expectedRevision)
        throw new Error("Product revision conflict");
      await c.execute(
        "UPDATE products SET price=?,currency=?,active=COALESCE(?,active),retailer=COALESCE(?,retailer),retailer_product_id=COALESCE(?,retailer_product_id),price_updated_at=CURRENT_TIMESTAMP(6),updated_at=CURRENT_TIMESTAMP(6),revision=revision+1 WHERE id=?",
        [
          data.price,
          data.currency,
          data.active ?? null,
          data.retailer ?? null,
          data.retailer_product_id ?? null,
          data.id,
        ],
      );
      await c.execute(
        "INSERT INTO store_admin_audit(actor_id,action,entity_id,details) VALUES(?,?,?,?)",
        [
          context.principal.id,
          "product_price_updated",
          data.id,
          JSON.stringify({
            revision: data.expectedRevision + 1,
            price: data.price,
            currency: data.currency,
          }),
        ],
      );
      return { revision: data.expectedRevision + 1 };
    });
  });

export const storePublicCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<Database["public"]["Tables"]["categories"]["Row"][]> => {
    const { database } = await import("@/backend/db.server");
    const [rows]: any = await database().execute(
      "SELECT * FROM categories WHERE active=true ORDER BY sort_order,name",
    );
    return rows;
  },
);
export const storePublicSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Database["public"]["Tables"]["site_settings"]["Row"] | null> => {
    const { database } = await import("@/backend/db.server");
    const [rows]: any = await database().execute(
      "SELECT id,store_name,logo_url,instagram_url,affiliate_disclosure,footer_text,social_links,updated_at FROM site_settings WHERE id=1",
    );
    if (!rows.length) return null;
    const row = rows[0],
      social =
        typeof row.social_links === "string" ? JSON.parse(row.social_links) : row.social_links;
    const allowed = [
      "instagram",
      "facebook",
      "youtube",
      "twitter",
      "x",
      "linkedin",
      "tiktok",
      "pinterest",
      "festival_special",
      "festival_product_ids",
      "category_spotlights",
    ];
    return {
      ...row,
      contact_email: null,
      updated_at: new Date(row.updated_at).toISOString(),
      social_links: Object.fromEntries(
        Object.entries(social).filter(([key]) => allowed.includes(key)),
      ),
    };
  },
);

export const listStoreAdminProducts = createServerFn({ method: "GET" })
  .middleware([admin])
  .inputValidator((input) =>
    z
      .object({
        q: z.string().max(200),
        category: z.string().max(36),
        status: z.string().max(20),
        featured: z.string().max(20),
        page: z.number().int().min(1).max(100000),
      })
      .strict()
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{ rows: import("./admin-queries").AdminRow[]; total: number; size: number }> => {
      const { database } = await import("@/backend/db.server");
      const clauses = ["p.deleted_at IS NULL"],
        args: (string | number | boolean)[] = [];
      if (data.q) {
        clauses.push("INSTR(LOWER(p.name),LOWER(?))>0");
        args.push(data.q);
      }
      if (data.category) {
        clauses.push("(p.category_id=? OR JSON_CONTAINS(p.category_ids,JSON_QUOTE(?)))");
        args.push(data.category, data.category);
      }
      if (["active", "inactive"].includes(data.status)) {
        clauses.push("p.active=?");
        args.push(data.status === "active");
      }
      if (["yes", "no"].includes(data.featured)) {
        clauses.push("p.featured=?");
        args.push(data.featured === "yes");
      }
      const where = clauses.join(" AND ");
      const [count]: any = await database().execute(
        "SELECT COUNT(*) AS n FROM products p WHERE " + where,
        args,
      );
      const [rows]: any = await database().execute(
        "SELECT p.*,c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE " +
          where +
          " ORDER BY p.created_at DESC,p.id LIMIT 20 OFFSET ?",
        [...args, (data.page - 1) * 20],
      );
      for (const row of rows) {
        const [images] = await database().execute(
          "SELECT image_url,sort_order FROM product_images WHERE product_id=? ORDER BY sort_order",
          [row.id],
        );
        row.product_images = images;
        row.categories = row.category_name ? { name: row.category_name } : null;
        row.active = Boolean(row.active);
        row.featured = Boolean(row.featured);
        row.price = row.price === null ? null : Number(row.price);
        for (const key of ["created_at", "updated_at", "price_updated_at", "deleted_at"])
          if (row[key]) row[key] = new Date(row[key]).toISOString();
      }
      return { rows, total: Number(count[0].n), size: 20 };
    },
  );
