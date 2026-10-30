import { z } from "zod";
import { createHash } from "node:crypto";
import { database, transaction } from "./db.server";
import { requireAdmin, type Principal } from "./authorization.server";
const productInput = z
  .object({
    id: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
    name: z.string().trim().min(1).max(300),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,199}$/),
    description: z.string().max(100000).nullable().default(null),
    short_description: z.string().max(2000).nullable().default(null),
    brand: z.string().max(200).nullable().default(null),
    affiliate_url: z.string().max(4000).nullable().default(null),
    amazon_url: z.string().max(4000).nullable().default(null),
    category_ids: z.array(z.string().uuid()).max(50).default([]),
    price: z.number().finite().min(0).max(9999999999.99).nullable().default(null),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("INR"),
    active: z.boolean().default(false),
    featured: z.boolean().default(false),
  })
  .strict();
function affiliate(value: string | null) {
  if (!value) return;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Secure affiliate URL required");
}
export async function saveProduct(principal: Principal | null, input: unknown) {
  const p = productInput.parse(input);
  affiliate(p.affiliate_url);
  affiliate(p.amazon_url);
  const categories = [...new Set(p.category_ids)];
  if (categories.length !== p.category_ids.length) throw new Error("Duplicate category");
  return transaction(async (c) => {
    const actor = await requireAdmin(principal, c);
    const [old]: any = await c.execute("SELECT * FROM products WHERE id=? FOR UPDATE", [p.id]);
    if ((old[0]?.revision ?? 0) !== p.expectedRevision || (!old.length && p.expectedRevision !== 0))
      throw new Error("Product revision conflict");
    const effective = p.affiliate_url || p.amazon_url;
    if (p.active && !effective) throw new Error("Published product requires an affiliate URL");
    if (effective) {
      const hash = createHash("sha256").update(effective).digest("hex");
      await c.execute(
        "INSERT INTO affiliate_url_locks(url_sha256) VALUES(?) ON DUPLICATE KEY UPDATE url_sha256=VALUES(url_sha256)",
        [hash],
      );
      if (p.active) {
        const [duplicates]: any = await c.execute(
          "SELECT id FROM products WHERE id<>? AND COALESCE(NULLIF(affiliate_url,''),amazon_url)=? LIMIT 1 FOR UPDATE",
          [p.id, effective],
        );
        if (duplicates.length) throw new Error("Affiliate URL already belongs to another product");
      }
    }
    for (const id of categories) {
      const [rows]: any = await c.execute("SELECT id FROM categories WHERE id=?", [id]);
      if (!rows.length) throw new Error("Unknown category");
    }
    const values = [
      p.name,
      p.slug,
      p.description,
      p.short_description,
      p.brand,
      p.affiliate_url,
      p.amazon_url,
      categories[0] ?? null,
      JSON.stringify(categories),
      p.price,
      p.currency,
      p.active,
      p.featured,
    ];
    if (old.length)
      await c.execute(
        "UPDATE products SET name=?,slug=?,description=?,short_description=?,brand=?,affiliate_url=?,amazon_url=?,category_id=?,category_ids=?,price=?,currency=?,active=?,featured=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP(6) WHERE id=?",
        [...values, p.id],
      );
    else
      await c.execute(
        "INSERT INTO products(name,slug,description,short_description,brand,affiliate_url,amazon_url,category_id,category_ids,price,currency,active,featured,id,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)",
        [...values, p.id],
      );
    await c.execute("DELETE FROM product_categories WHERE product_id=?", [p.id]);
    for (const [position, id] of categories.entries())
      await c.execute(
        "INSERT INTO product_categories(product_id,category_id,position) VALUES(?,?,?)",
        [p.id, id, position],
      );
    await c.execute(
      "INSERT INTO store_admin_audit(actor_id,action,entity_id,details) VALUES(?,?,?,?)",
      [
        actor.id,
        old.length ? "product_updated" : "product_created",
        p.id,
        JSON.stringify({ revision: p.expectedRevision + 1, categoryIds: categories }),
      ],
    );
    return { id: p.id, revision: p.expectedRevision + 1 };
  });
}
export async function publicProduct(slug: string) {
  const [rows]: any = await database().execute(
    "SELECT id,name,slug,description,short_description,brand,affiliate_url,amazon_url,category_ids,price,currency,featured FROM products WHERE slug=? AND active=true AND deleted_at IS NULL",
    [z.string().max(200).parse(slug)],
  );
  return rows[0] ?? null;
}
