export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 5 * 1024 * 1024;

export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type))
    return `${file.name}: only JPG, JPEG, PNG or WEBP images are allowed.`;
  if (file.size > MAX_BYTES * 2) return `${file.name}: image is larger than 10 MB.`;
  return null;
}

/** Resize to max 1600px and re-encode as WebP for fast public pages. */
async function optimize(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (blob && blob.size < file.size) return blob;
  } catch {
    /* fall through to original */
  }
  return file;
}

export async function uploadImage(file: File, folder: "products" | "categories" | "branding") {
  const err = validateImage(file);
  if (err) throw new Error(err);
  const blob = await optimize(file);
  if (blob.size > MAX_BYTES)
    throw new Error(`${file.name}: image is still larger than 5 MB after optimisation.`);
  const ext =
    blob.type === "image/webp" ? "webp" : file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const response = await fetch("/api/store/media?folder=" + folder, {
    method: "POST",
    headers: { "content-type": blob.type || file.type },
    body: blob,
  });
  if (!response.ok) throw new Error("Upload failed");
  return response.json() as Promise<{ path: string; url: string }>;
}

export async function removeStoragePaths(paths: (string | null | undefined)[]) {
  const p = paths.filter(Boolean) as string[];
  if (p.length) {
    const response = await fetch("/api/store/media?action=remove", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paths: p }),
    });
    if (!response.ok) throw new Error("Media removal failed");
  }
}

export function pathFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const m = url.match(/\/api\/public\/img\/(.+)$/);
  return m ? m[1] : null;
}

/** Optional product video; stored in the same ordered media gallery as photos. */
export async function uploadProductVideo(file: File) {
  if (!["video/mp4", "video/webm"].includes(file.type))
    throw new Error("Choose an MP4 or WebM video.");
  if (file.size > 50 * 1024 * 1024) throw new Error("Video must be 50 MB or smaller.");
  const ext = file.type === "video/webm" ? "webm" : "mp4";
  const path = `products/${crypto.randomUUID()}.${ext}`;
  const response = await fetch("/api/store/media?folder=products", {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error("Video upload failed");
  return response.json() as Promise<{ path: string; url: string }>;
}
