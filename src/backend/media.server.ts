import { randomUUID, createHash } from "node:crypto";
import { isAbsolute, resolve, join, dirname } from "node:path";
import { mkdir, writeFile, readFile, lstat } from "node:fs/promises";
import { database } from "./db.server";
import { independentAuth } from "./runtime.server";
import { requireAdmin } from "./authorization.server";
const safe = /^(products|categories|branding)\/[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/;
async function root() {
  const value = process.env.STORE_MEDIA_DIRECTORY;
  if (!value || !isAbsolute(value)) throw Error("Private media storage is not configured");
  let p = resolve(value);
  for (;;) {
    try {
      if ((await lstat(p)).isSymbolicLink()) throw Error("Media symlinks are not permitted");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    try {
      await lstat(join(p, ".git"));
      throw Error("Media must stay outside source repositories");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    const parent = dirname(p);
    if (parent === p) break;
    p = parent;
  }
  await mkdir(value, { recursive: true });
  return resolve(value);
}
async function bounded(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > max) {
      await reader.cancel();
      throw Error("Upload too large");
    }
    chunks.push(item.value);
  }
  return Buffer.concat(chunks);
}
function format(bytes: Buffer, type: string) {
  if (
    type === "image/png" &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "jpg";
  if (
    type === "image/webp" &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (type === "video/mp4" && bytes.toString("ascii", 4, 8) === "ftyp") return "mp4";
  if (type === "video/webm" && bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])))
    return "webm";
  throw Error("File content does not match a supported media type");
}
export async function handleMedia(request: Request): Promise<Response | null> {
  const url = new URL(request.url),
    publicPrefix = "/api/public/img/";
  if (request.method === "GET" && url.pathname.startsWith(publicPrefix)) {
    const path = url.pathname.slice(publicPrefix.length);
    if (!safe.test(path)) return new Response("Not found", { status: 404 });
    const [rows]: any = await database().execute(
      "SELECT content_type,sha256 FROM store_media_objects WHERE path=? AND deleted_at IS NULL",
      [path],
    );
    if (!rows.length) return new Response("Not found", { status: 404 });
    try {
      const filename = join(await root(), path);
      if ((await lstat(filename)).isSymbolicLink()) throw Error("Invalid media file");
      const bytes = await readFile(filename);
      if (createHash("sha256").update(bytes).digest("hex") !== rows[0].sha256)
        throw Error("Media integrity mismatch");
      return new Response(Uint8Array.from(bytes), {
        headers: {
          "content-type": rows[0].content_type,
          "x-content-type-options": "nosniff",
          "cache-control": "public,max-age=3600",
          "content-security-policy": "default-src 'none'",
        },
      });
    } catch {
      return new Response("Media unavailable", { status: 404 });
    }
  }
  if (url.pathname !== "/api/store/media") return null;
  try {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    if (request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin)
      return new Response(null, { status: 403 });
    const session = await independentAuth().api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified) return new Response(null, { status: 401 });
    await requireAdmin(session.user);
    if (url.searchParams.get("action") === "remove") {
      const value = JSON.parse((await bounded(request, 65536)).toString());
      if (
        !Array.isArray(value.paths) ||
        value.paths.length > 200 ||
        value.paths.some((p: unknown) => typeof p !== "string" || !safe.test(p))
      )
        throw Error("Invalid media paths");
      for (const p of value.paths)
        await database().execute(
          "UPDATE store_media_objects SET deleted_at=COALESCE(deleted_at,CURRENT_TIMESTAMP(6)) WHERE path=?",
          [p],
        );
      return Response.json({ success: true });
    }
    const folder = url.searchParams.get("folder");
    if (!["products", "categories", "branding"].includes(folder ?? ""))
      throw Error("Invalid media folder");
    const type = request.headers.get("content-type") ?? "",
      video = type.startsWith("video/");
    if (video && folder !== "products") throw Error("Videos belong to products");
    const bytes = await bounded(request, video ? 50 * 1024 * 1024 : 5 * 1024 * 1024),
      ext = format(bytes, type),
      path = folder + "/" + randomUUID() + "." + ext;
    const directory = await root();
    await mkdir(join(directory, folder!), { recursive: true });
    if ((await lstat(join(directory, folder!))).isSymbolicLink())
      throw Error("Invalid media folder");
    await writeFile(join(directory, path), bytes, { flag: "wx", mode: 0o600 });
    await database().execute(
      "INSERT INTO store_media_objects(path,owner_id,content_type,byte_length,sha256) VALUES(?,?,?,?,?)",
      [path, session.user.id, type, bytes.length, createHash("sha256").update(bytes).digest("hex")],
    );
    return Response.json({ path, url: publicPrefix + path });
  } catch {
    return Response.json({ error: "Media request could not be completed" }, { status: 400 });
  }
}
