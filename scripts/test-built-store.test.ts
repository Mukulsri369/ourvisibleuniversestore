import { runWithStartContext } from "@tanstack/start-storage-context";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { readdir, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createClientRpc } from "@tanstack/start-client-core/client-rpc";
import { database, closeDatabase } from "../src/backend/db.server";
import { createIndependentAuth } from "../src/backend/auth.server";
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert.equal(process.env.DB_PORT, "3307");
assert.equal(process.env.DB_NAME, "ovu_store");
test("built Store uses real cookie login and server-function product writes with restart persistence", async () => {
  // Other integration files use the same loopback address and database-backed limiter.
  await delay(11000);
  const priorBase = process.env.TSS_SERVER_FN_BASE;
  process.env.TSS_SERVER_FN_BASE = "/_serverFn/";
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((r) => socket.close(() => r()));
  const base = "http://127.0.0.1:" + port;
  let child: ChildProcess | undefined,
    userId = "";
  const pid = randomUUID();
  const files = (await readdir(".output/server/_ssr")).filter((f) =>
    f.startsWith("store-api.functions-"),
  );
  const code = (
    await Promise.all(files.map((f) => readFile(".output/server/_ssr/" + f, "utf8")))
  ).join("\n");
  const ids = new Map<string, string>();
  for (const m of code.matchAll(/id: "([a-f0-9]+)",\s*name: "([a-zA-Z]+)"/g)) ids.set(m[2], m[1]);
  assert.ok(ids.has("saveStoreProduct"));
  async function rpc(name: string, method: "GET" | "POST", data: unknown, cookie = "") {
    const call = createClientRpc(ids.get(name)!);
    const envelope = await runWithStartContext(
      {
        getRouter: () => {
          throw Error("Client codec does not need a router");
        },
        request: new Request(base),
        startOptions: {},
        contextAfterGlobalMiddlewares: {},
        executedRequestMiddlewares: new Set(),
        handlerType: "serverFn",
      },
      () =>
        call({
          method,
          data,
          headers: { cookie, origin: base },
          fetch: (url: string, init: RequestInit) => fetch(base + url, init),
        }),
    );
    if (envelope.error) throw envelope.error;
    return envelope.result;
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const done = once(child, "exit");
      child.kill();
      await done;
    }
    child = undefined;
  }
  async function start() {
    let diagnostic = "",
      lastStatus = 0;
    child = spawn(process.execPath, [".output/server/index.mjs"], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PORT: String(port), NITRO_HOST: "127.0.0.1", BETTER_AUTH_URL: base },
    });
    child.stderr?.on("data", (chunk) => {
      diagnostic = (diagnostic + String(chunk)).slice(-2000);
    });
    for (let i = 0; i < 100; i++) {
      try {
        lastStatus = (await fetch(base + "/api/auth/get-session")).status;
        if (lastStatus === 200) return;
      } catch {}
      if (child.exitCode !== null) throw Error("Built server stopped");
      await delay(100);
    }
    throw Error("Built server unavailable, status " + lastStatus + "; " + diagnostic);
  }
  try {
    const email = randomUUID() + "@example.test",
      password = randomUUID() + "-Synthetic!";
    const auth = createIndependentAuth({ send: async () => {} });
    const created = await auth.api.signUpEmail({
      body: { name: "Synthetic built Store fixture", email, password },
    });
    userId = created.user.id;
    await database().execute("UPDATE auth_user SET emailVerified=true WHERE id=?", [userId]);
    await start();
    const login = await fetch(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
    await assert.rejects(() => rpc("storeAdminIdentity", "GET", undefined, cookie));
    await database().execute("INSERT INTO app_roles(user_id,role) VALUES(?,'admin')", [userId]);
    assert.equal((await rpc("storeAdminIdentity", "GET", undefined, cookie)).user.id, userId);
    const value = {
      id: pid,
      expectedRevision: 0,
      name: "Synthetic built product",
      slug: pid,
      affiliate_url: "https://www.amazon.in/dp/SYNTHETIC?tag=" + pid,
      active: true,
      price: 42.5,
      features: ["Synthetic feature"],
      tags: ["synthetic"],
    };
    assert.equal((await rpc("saveStoreProduct", "POST", value, cookie)).revision, 1);
    assert.equal((await rpc("storePublicProduct", "GET", { slug: pid })).name, value.name);
    await assert.rejects(() => rpc("saveStoreProduct", "POST", value, cookie));
    const loaded=await rpc('loadStoreProduct','GET',{id:pid},cookie);assert.equal(typeof loaded.active,'boolean');assert.equal(typeof loaded.featured,'boolean');
    assert.equal((await rpc('saveStoreProduct','POST',{...value,expectedRevision:loaded.revision,active:loaded.active,featured:loaded.featured},cookie)).revision,2);
    const page = await fetch(base + "/product/" + pid);
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes(value.name));
    await stop();
    await start();
    assert.equal((await rpc("loadStoreProduct", "GET", { id: pid }, cookie)).revision, 2);
    assert.equal((await rpc("storePublicProduct", "GET", { slug: pid })).price, 42.5);
  } finally {
    await stop();
    if (userId) {
      await database().execute("DELETE FROM store_admin_audit WHERE actor_id=?", [userId]);
      await database().execute("DELETE FROM products WHERE id=?", [pid]);
      await database().execute("DELETE FROM auth_user WHERE id=?", [userId]);
    }
    if (priorBase === undefined) delete process.env.TSS_SERVER_FN_BASE;
    else process.env.TSS_SERVER_FN_BASE = priorBase;
    await closeDatabase();
  }
});
