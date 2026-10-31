import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { database, closeDatabase } from "../src/backend/db.server";
import { saveProduct } from "../src/backend/products.server";
import { publicCatalogue, recordPublicOutboundClick } from "../src/backend/catalogue.server";
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert.equal(process.env.DB_PORT, "3307");
assert.equal(process.env.DB_NAME, "ovu_store");
test("public catalogue preserves filters, category memberships, ordered images and affiliate bytes while excluding drafts/trash", async () => {
  const user = randomUUID(),
    category = randomUUID(),
    otherCategory = randomUUID(),
    ids = Array.from({ length: 4 }, () => randomUUID());
  const actor = { id: user, email: user + "@example.test", emailVerified: true };
  try {
    await database().execute(
      "INSERT INTO auth_user(id,name,email,emailVerified) VALUES(?,?,?,true)",
      [user, "Synthetic catalogue fixture", actor.email],
    );
    await database().execute("INSERT INTO app_roles(user_id,role) VALUES(?,'admin')", [user]);
    await database().execute("INSERT INTO categories(id,name,slug) VALUES(?,?,?),(?,?,?)", [
      category,
      "Synthetic Optical Lab",
      category,
      otherCategory,
      "Synthetic Lamps",
      otherCategory,
    ]);
    for (let i = 0; i < 4; i++)
      await saveProduct(actor, {
        id: ids[i],
        expectedRevision: 0,
        name: i === 0 ? "Synthetic Nova Telescope" : "Synthetic Moon Lamp " + i,
        slug: ids[i],
        description: i === 0 ? "A stellar optical instrument" : "A lunar light",
        affiliate_url: "https://www.amazon.in/dp/SYNTHETIC?tag=" + ids[i] + "&ref=Exact%2BBytes",
        category_ids: i === 0 ? [category, otherCategory] : [otherCategory],
        featured: i === 0,
        active: i !== 2,
        price: i === 0 ? 10 : i === 1 ? 20 : null,
        tags: i === 0 ? ["synthetic-optics"] : ["synthetic-diwali-light"],
        images: [
          { image_url: "https://example.test/second.webp", alt_text: "Second", storage_path: null },
          { image_url: "https://example.test/first.webp", alt_text: "First", storage_path: null },
        ],
      });
    await database().execute("UPDATE products SET deleted_at=CURRENT_TIMESTAMP(6) WHERE id=?", [
      ids[3],
    ]);
    const all = await publicCatalogue({ ids, sort: "price_asc", limit: 500 });
    assert.equal(all.count, 2);
    assert.deepEqual(
      all.data.map((p) => p.id),
      ids.slice(0, 2),
    );
    assert.equal(
      all.data[0].affiliate_url,
      "https://www.amazon.in/dp/SYNTHETIC?tag=" + ids[0] + "&ref=Exact%2BBytes",
    );
    assert.deepEqual(all.data[0].category_ids, [category, otherCategory]);
    assert.equal(all.data[0].categories!.name, "Synthetic Optical Lab");
    assert.deepEqual(
      all.data[0].product_images.map((i) => i.alt_text),
      ["Second", "First"],
    );
    assert.equal("storage_path" in all.data[0].product_images[0], false);
    assert.equal("revision" in all.data[0], false);
    assert.deepEqual(
      (await publicCatalogue({ ids, categorySlugs: [category] })).data.map((p) => p.id),
      [ids[0]],
    );
    assert.equal((await publicCatalogue({ ids, categorySlugs: [otherCategory] })).count, 2);
    assert.equal((await publicCatalogue({ ids, categoryIds: [otherCategory] })).count, 2);
    assert.equal((await publicCatalogue({ ids, featured: true })).count, 1);
    assert.equal((await publicCatalogue({ ids, min: 15, max: 25 })).data[0].id, ids[1]);
    assert.equal((await publicCatalogue({ ids, terms: ["nOvA"] })).data[0].id, ids[0]);
    assert.equal((await publicCatalogue({ ids, terms: ["optical"] })).data[0].id, ids[0]);
    assert.equal((await publicCatalogue({ ids, tagTerms: ["diwali"] })).data[0].id, ids[1]);
    assert.equal((await publicCatalogue({ ids, tags: ["synthetic-optics"] })).data[0].id, ids[0]);
    assert.equal((await publicCatalogue({ ids, terms: ["%' OR 1=1 --"] })).count, 0);
    assert.equal((await publicCatalogue({ ids, terms: ["_"] })).count, 0);
    const paged = await publicCatalogue({ ids, sort: "price_desc", limit: 1, offset: 1 });
    assert.equal(paged.count, 2);
    assert.equal(paged.data[0].id, ids[0]);
    assert.equal((await publicCatalogue({ ids, excludeId: ids[0] })).count, 1);
    await database().execute("UPDATE categories SET active=false WHERE id=?", [category]);
    assert.equal((await publicCatalogue({ ids, categorySlugs: [category] })).count, 0);
    await assert.rejects(() => publicCatalogue({ ids, includeDeleted: true }));
    await assert.rejects(() => publicCatalogue({ limit: 501 }));
    await assert.rejects(() => publicCatalogue({ sort: "p.id; DROP TABLE products" }));
    await database().execute(
      "UPDATE products SET name='Synthetic other item',short_description='lamp' WHERE id=?",
      [ids[0]],
    );
    assert.deepEqual(
      (
        await publicCatalogue({ ids, textTerms: ["diwali", "light"], nameTerms: ["lamp"] })
      ).data.map((p) => p.id),
      [ids[1]],
    );
    assert.equal(await recordPublicOutboundClick(ids[0]), true);
    assert.equal(await recordPublicOutboundClick(ids[2]), false);
    assert.equal(await recordPublicOutboundClick(ids[3]), false);
    const [clicks]: any = await database().execute(
      "SELECT product_id FROM outbound_clicks WHERE product_id IN (?,?,?,?)",
      ids,
    );
    assert.deepEqual(
      clicks.map((r: any) => r.product_id),
      [ids[0]],
    );
    // Local-only limiter fixture: restore the shared counter even if an assertion fails.
    const counterKey = "ovu-store:outbound:global",
      testNow = Date.now();
    const [priorCounter]: any = await database().execute(
      "SELECT `count`,lastRequest FROM auth_rate_limit WHERE `key`=?",
      [counterKey],
    );
    try {
      await database().execute(
        "UPDATE auth_rate_limit SET `count`=999,lastRequest=? WHERE `key`=?",
        [testNow, counterKey],
      );
      const competing = await Promise.all([
        recordPublicOutboundClick(ids[0], testNow),
        recordPublicOutboundClick(ids[0], testNow),
      ]);
      assert.equal(competing.filter(Boolean).length, 1);
      assert.equal(await recordPublicOutboundClick(ids[0], testNow + 1), false);
      assert.equal(await recordPublicOutboundClick(ids[0], testNow + 60_001), true);
    } finally {
      await database().execute("UPDATE auth_rate_limit SET `count`=?,lastRequest=? WHERE `key`=?", [
        priorCounter[0].count,
        priorCounter[0].lastRequest,
        counterKey,
      ]);
    }
    const [boundedClicks]: any = await database().execute(
      "SELECT COUNT(*) AS total FROM outbound_clicks WHERE product_id=?",
      [ids[0]],
    );
    assert.equal(Number(boundedClicks[0].total), 3);
  } finally {
    await database().execute("DELETE FROM store_admin_audit WHERE actor_id=?", [user]);
    for (const id of ids) await database().execute("DELETE FROM products WHERE id=?", [id]);
    await database().execute("DELETE FROM categories WHERE id IN (?,?)", [category, otherCategory]);
    await database().execute("DELETE FROM auth_user WHERE id=?", [user]);
    await closeDatabase();
  }
});
