import { createFileRoute } from "@tanstack/react-router";

// Serves store images (product/category/logo) from private storage.
// Only images inside the store bucket are reachable; paths are validated.
export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[a-zA-Z0-9/_\-.]+$/.test(path) || path.includes("..") || !/^(products|categories|branding)\//.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("store-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": data.type || "image/webp",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
