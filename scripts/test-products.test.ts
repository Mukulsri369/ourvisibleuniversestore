import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { database, closeDatabase } from "../src/backend/db.server";
import { saveProduct, publicProduct } from "../src/backend/products.server";
assert.equal(process.env.DB_NAME, "ovu_store");
assert.equal(process.env.DB_PORT, "3307");
assert.equal(process.env.DB_HOST, "127.0.0.1");
test("product edits require admin, preserve atomic category membership, deny stale writes and duplicate publication", async () => {
  const id = randomUUID(),
    member = randomUUID(),
    category = randomUUID(),
    product = randomUUID(),
    second = randomUUID();
  const actor = { id, email: id + "@example.test", emailVerified: true };
  try {
    await database().execute(
      "INSERT INTO auth_user(id,name,email,emailVerified) VALUES(?,?,?,true),(?,?,?,true)",
      [id, "Synthetic admin", actor.email, member, "Synthetic member", member + "@example.test"],
    );
    await database().execute("INSERT INTO app_roles(user_id,role) VALUES(?,'admin')", [id]);
    await database().execute("INSERT INTO categories(id,name,slug) VALUES(?,?,?)", [
      category,
      "Synthetic test category",
      category,
    ]);
    const input = {
      id: product,
      expectedRevision: 0,
      name: "Synthetic local product",
      slug: product,
      category_ids: [category],
      images: [
        {
          image_url: "https://example.test/synthetic.webp",
          storage_path: null,
          alt_text: "Synthetic fixture",
        },
      ],
      features: ["Synthetic feature"],
      tags: ["synthetic-tag"],
      retailer: "Other",
      subcategory: "Synthetic subtype",
      affiliate_url: "https://www.amazon.in/dp/SYNTHETIC?tag=" + product,
    };
    await assert.rejects(() =>
      saveProduct({ id: member, email: "member@example.test", emailVerified: true }, input),
    );
    assert.equal((await saveProduct(actor, input)).revision, 1);
    assert.equal(await publicProduct(product), null);
    await assert.rejects(() => saveProduct(actor, input), /revision conflict/);
    assert.equal(
      (await saveProduct(actor, { ...input, expectedRevision: 1, active: true, price: 123.45 }))
        .revision,
      2,
    );
    assert.equal(Number((await publicProduct(product)).price), 123.45);
    await assert.rejects(
      () => saveProduct(actor, { ...input, expectedRevision: 2, category_ids: [randomUUID()] }),
      /Unknown category/,
    );
    const [links]: any = await database().execute(
      "SELECT category_id FROM product_categories WHERE product_id=?",
      [product],
    );
    assert.equal(links[0].category_id, category);
    await assert.rejects(
      () => saveProduct(actor, { ...input, id: second, slug: second, active: true }),
      /already belongs/,
    );
    const [gallery]: any = await database().execute(
      "SELECT image_url FROM product_images WHERE product_id=?",
      [product],
    );
    assert.equal(gallery.length, 1);
    assert.equal(gallery[0].image_url, "https://example.test/synthetic.webp");
    await assert.rejects(() =>
      saveProduct(actor, {
        ...input,
        expectedRevision: 2,
        price: 999,
        images: [{ image_url: "javascript:alert(1)", storage_path: null, alt_text: null }],
      }),
    );
    assert.equal(Number((await publicProduct(product)).price), 123.45);
    const [missing]: any = await database().execute("SELECT id FROM products WHERE id=?", [second]);
    assert.equal(missing.length, 0);
    await assert.rejects(() =>
      saveProduct(actor, {
        ...input,
        expectedRevision: 2,
        affiliate_url: "http://insecure.example",
      }),
    );
  } finally {
    await database().execute("DELETE FROM store_admin_audit WHERE actor_id=?", [id]);
    await database().execute("DELETE FROM products WHERE id IN (?,?)", [product, second]);
    await database().execute("DELETE FROM categories WHERE id=?", [category]);
    await database().execute("DELETE FROM auth_user WHERE id IN (?,?)", [id, member]);
    await closeDatabase();
  }
});
