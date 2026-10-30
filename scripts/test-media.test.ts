import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { database, closeDatabase } from "../src/backend/db.server";
import { createIndependentAuth } from "../src/backend/auth.server";
import { handleMedia } from "../src/backend/media.server";
assert.equal(process.env.DB_NAME, "ovu_store");
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert.equal(process.env.DB_PORT, "3307");
test("authorized media validates file signatures and origin, serves local content, and removes reversibly", async () => {
  // Respect the real shared login burst window; never disable production rate limits for tests.
  await delay(11000);
  const previous = process.env.STORE_MEDIA_DIRECTORY!;
  assert.ok(previous);
  await mkdir(previous, { recursive: true });
  const directory = await mkdtemp(join(previous, "test-"));
  process.env.STORE_MEDIA_DIRECTORY = directory;
  let userId = "",
    path = "";
  try {
    const auth = createIndependentAuth({ send: async () => {} }),
      base = process.env.BETTER_AUTH_URL!,
      email = randomUUID() + "@example.test",
      password = randomUUID() + "-Synthetic!";
    const created = await auth.api.signUpEmail({
      body: { email, password, name: "Synthetic media fixture" },
    });
    userId = created.user.id;
    await database().execute("UPDATE auth_user SET emailVerified=true WHERE id=?", [userId]);
    const login = await auth.handler(
      new Request(base + "/api/auth/sign-in/email", {
        method: "POST",
        headers: { origin: base, "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );
    assert.equal(login.status, 200);
    const cookie = login.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
    const upload = (bytes: Uint8Array, origin = base) =>
      handleMedia(
        new Request(base + "/api/store/media?folder=products", {
          method: "POST",
          headers: { cookie, origin, "content-type": "image/png" },
          body: bytes,
        }),
      );
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    assert.notEqual((await upload(png))!.status, 200);
    await database().execute("INSERT INTO app_roles(user_id,role) VALUES(?,'admin')", [userId]);
    assert.equal((await upload(png, "https://untrusted.example"))!.status, 403);
    assert.equal((await upload(Uint8Array.from([1, 2, 3])))!.status, 400);
    const response = (await upload(png))!;
    assert.equal(response.status, 200);
    const saved = await response.json();
    path = saved.path;
    const read = (await handleMedia(new Request(base + saved.url)))!;
    assert.equal(read.status, 200);
    assert.equal(read.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(new Uint8Array(await read.arrayBuffer()), png);
    const removed = (await handleMedia(
      new Request(base + "/api/store/media?action=remove", {
        method: "POST",
        headers: { cookie, origin: base, "content-type": "application/json" },
        body: JSON.stringify({ paths: [path] }),
      }),
    ))!;
    assert.equal(removed.status, 200);
    assert.equal((await handleMedia(new Request(base + saved.url)))!.status, 404);
    await database().execute("UPDATE store_media_objects SET deleted_at=NULL WHERE path=?", [path]);
    assert.equal((await handleMedia(new Request(base + saved.url)))!.status, 200);
  } finally {
    if (userId) {
      await database().execute("DELETE FROM store_media_objects WHERE owner_id=?", [userId]);
      await database().execute("DELETE FROM auth_user WHERE id=?", [userId]);
    }
    if (path) await unlink(join(directory, path));
    try {
      await rmdir(join(directory, "products"));
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    await rmdir(directory);
    process.env.STORE_MEDIA_DIRECTORY = previous;
    await closeDatabase();
  }
});
