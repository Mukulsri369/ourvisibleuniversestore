import { createServerFn } from "@tanstack/react-start";
import type { CatalogueInput } from "@/backend/catalogue.server";
import { z } from "zod";

/** The server revalidates every filter and always enforces public visibility. */
export const storePublicCatalogue = createServerFn({ method: "GET" })
  .inputValidator((input: CatalogueInput) => input)
  .handler(async ({ data }) => {
    const { publicCatalogue } = await import("@/backend/catalogue.server");
    return publicCatalogue(data);
  });

export const storeOutboundClick = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ productId: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin)
      throw new Error("Untrusted request origin");
    const { recordPublicOutboundClick } = await import("@/backend/catalogue.server");
    return recordPublicOutboundClick(data.productId);
  });
