import { createFileRoute } from "@tanstack/react-router";
import * as cheerio from "cheerio/slim";
import { supabase } from "@/integrations/supabase/client";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Ch-Ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

function parsePriceNumber(raw: string): number | null {
  if (!raw) return null;
  // Match first valid numeric pattern like 4,018.00 or 1499.50 or 1499
  // Remove commas used as thousands separators
  const cleaned = raw.replace(/,/g, "").trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return isNaN(num) || num <= 0 ? null : Math.round(num * 100) / 100;
}

function detectCurrency(text: string, fallback: string = "INR"): string {
  if (text.includes("₹") || text.includes("Rs") || text.includes("INR")) return "INR";
  if (text.includes("$") || text.includes("USD")) return "USD";
  if (text.includes("£") || text.includes("GBP")) return "GBP";
  if (text.includes("€") || text.includes("EUR")) return "EUR";
  if (text.includes("CAD") || text.includes("C$")) return "CAD";
  if (text.includes("AUD") || text.includes("A$")) return "AUD";
  return fallback;
}

export const Route = createFileRoute("/api/admin/check-price")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { url?: string; productId?: string };
          let targetUrl = body?.url?.trim();
          const productId = body?.productId?.trim();

          // If no URL provided but productId is, resolve from database
          if (!targetUrl && productId) {
            const { data: prod } = await supabase
              .from("products")
              .select("affiliate_url, amazon_url")
              .eq("id", productId)
              .maybeSingle();
            targetUrl = prod?.affiliate_url || prod?.amazon_url || undefined;
          }

          if (!targetUrl) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Product affiliate URL is required to check price",
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }

          let parsedUrl: URL;
          try {
            parsedUrl = new URL(targetUrl);
          } catch {
            return new Response(JSON.stringify({ success: false, error: "Invalid URL provided" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          // Follow redirects to get real retailer page
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 14000);

          let res: Response;
          try {
            res = await fetch(parsedUrl.toString(), {
              headers: BROWSER_HEADERS,
              redirect: "follow",
              signal: controller.signal,
            });
          } catch (fetchErr) {
            clearTimeout(timeout);
            return new Response(
              JSON.stringify({
                success: false,
                error: `Unable to connect to product link: ${
                  fetchErr instanceof Error ? fetchErr.message : "Network error"
                }`,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          } finally {
            clearTimeout(timeout);
          }

          const finalUrlStr = res.url || targetUrl;
          const finalUrl = new URL(finalUrlStr);
          const hostname = finalUrl.hostname.toLowerCase();

          let retailer = "Other";
          if (hostname.includes("amazon.")) retailer = "Amazon";
          else if (hostname.includes("flipkart.")) retailer = "Flipkart";
          else if (hostname.includes("ubuy.")) retailer = "Ubuy";

          let retailerProductId = "";
          if (retailer === "Amazon") {
            const asinMatch = finalUrlStr.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
            if (asinMatch) retailerProductId = asinMatch[1].toUpperCase();
          } else if (retailer === "Flipkart") {
            retailerProductId = finalUrl.searchParams.get("pid") || "";
          } else if (retailer === "Ubuy") {
            const ubuyAsinMatch =
              finalUrlStr.match(/(?:product|view\/product)\/([A-Z0-9]{10})/i) ||
              targetUrl.match(/(?:product|view\/product)\/([A-Z0-9]{10})/i);
            if (ubuyAsinMatch) retailerProductId = ubuyAsinMatch[1].toUpperCase();
          }

          let html = await res.text();

          // Check for Cloudflare Turnstile / Bot Management challenges
          const isCloudflareChallenge =
            res.status === 403 ||
            res.headers.get("cf-mitigated") === "challenge" ||
            html.includes("challenges.cloudflare.com") ||
            html.includes("cf-browser-verification") ||
            html.toLowerCase().includes("just a moment...");

          if (isCloudflareChallenge) {
            let errorMsg = `Retailer (${hostname}) blocked the request with Cloudflare Bot Management (HTTP 403 Forbidden). Price cannot be checked automatically from this URL.`;
            if (retailer === "Ubuy" && retailerProductId) {
              errorMsg = `Ubuy (${hostname}) is protected by Cloudflare Bot Management (HTTP 403 Forbidden). Automated price checking cannot bypass Cloudflare's bot challenge for ASIN "${retailerProductId}".`;
            }
            return new Response(
              JSON.stringify({
                success: false,
                error: errorMsg,
                retailer,
                retailer_product_id: retailerProductId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }

          // Retry with final URL if redirected or non-200
          if (res.status !== 200 || html.length < 500) {
            try {
              const retryRes = await fetch(finalUrlStr, {
                headers: BROWSER_HEADERS,
                redirect: "follow",
              });
              if (retryRes.status === 200) {
                html = await retryRes.text();
              }
            } catch {
              // Ignore retry error and use html
            }
          }

          function detectStockStatus(
            $: cheerio.CheerioAPI,
            retailer: string,
            jsonLdAvailability?: string,
          ): { inStock: boolean; reason?: string } {
            // 1. JSON-LD availability check
            if (jsonLdAvailability) {
              const avail = jsonLdAvailability.toLowerCase();
              if (
                avail.includes("outofstock") ||
                avail.includes("soldout") ||
                avail.includes("discontinued") ||
                avail.includes("backorder")
              ) {
                return { inStock: false, reason: "Schema.org reported OutOfStock" };
              }
              if (
                avail.includes("instock") ||
                avail.includes("preorder") ||
                avail.includes("limitedavailability")
              ) {
                return { inStock: true, reason: "Schema.org reported InStock" };
              }
            }

            // 2. OpenGraph / Meta tag checks
            const ogAvail = (
              $('meta[property="og:availability"]').attr("content") ||
              $('meta[property="product:availability"]').attr("content") ||
              $('meta[name="availability"]').attr("content") ||
              ""
            ).toLowerCase();
            if (ogAvail) {
              if (
                ogAvail.includes("out of stock") ||
                ogAvail.includes("oos") ||
                ogAvail.includes("unavailable")
              ) {
                return { inStock: false, reason: "Meta tag indicated out of stock" };
              }
              if (ogAvail.includes("in stock") || ogAvail.includes("instock")) {
                return { inStock: true, reason: "Meta tag indicated in stock" };
              }
            }

            // 3. Amazon specific checks
            if (retailer === "Amazon") {
              const availText = $("#availability").text().trim().toLowerCase();
              if (
                availText.includes("currently unavailable") ||
                availText.includes("we don't know when or if this item will be back in stock") ||
                availText.includes("temporarily out of stock") ||
                availText.includes("out of stock")
              ) {
                return {
                  inStock: false,
                  reason: "Amazon reported: Currently unavailable / Out of stock",
                };
              }

              if ($("#outOfStock").length > 0) {
                return { inStock: false, reason: "Amazon #outOfStock container detected" };
              }

              if (
                availText.includes("in stock") ||
                (availText.includes("only") && availText.includes("left in stock")) ||
                availText.includes("usually dispatched") ||
                availText.includes("order within")
              ) {
                return { inStock: true, reason: "Amazon reported: In stock" };
              }
            }

            // 4. Flipkart specific checks
            if (retailer === "Flipkart") {
              const fkOosText = [
                $("div._16FRp0").text(),
                $("div._3q9tY2").text(),
                $("div._2jc05C").text(),
                $("div._1V4wWZ").text(),
                $("span._1TP29H").text(),
              ]
                .join(" ")
                .toLowerCase();

              if (
                fkOosText.includes("currently out of stock") ||
                fkOosText.includes("sold out") ||
                fkOosText.includes("item is currently out of stock") ||
                fkOosText.includes("coming soon")
              ) {
                return { inStock: false, reason: "Flipkart reported: Currently Out of Stock" };
              }
            }

            // 5. Generic HTML out-of-stock tags
            const genericOos = $(
              '[class*="out-of-stock"], [class*="outofstock"], [class*="sold-out"], [class*="soldout"], [id*="out-of-stock"], [id*="sold-out"]',
            );
            if (genericOos.length > 0) {
              const txt = genericOos.text().trim().toLowerCase();
              if (
                txt.includes("out of stock") ||
                txt.includes("sold out") ||
                txt.includes("unavailable")
              ) {
                return { inStock: false, reason: "Page indicated out of stock" };
              }
            }

            return { inStock: true };
          }

          const $ = cheerio.load(html);

          let detectedPriceNum: number | null = null;
          let detectedCurrency = retailer === "Amazon" && hostname.endsWith(".com") ? "USD" : "INR";
          let rawPriceText = "";
          let jsonLdAvailability: string | undefined;

          // 1. Check Schema.org JSON-LD offers
          $('script[type="application/ld+json"]').each((_, el) => {
            try {
              const content = $(el).html();
              if (!content) return;
              const parsed = JSON.parse(content);
              const items = Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed["@graph"])
                  ? parsed["@graph"]
                  : [parsed];

              for (const item of items) {
                if (item?.offers) {
                  const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                  if (offer?.availability && !jsonLdAvailability) {
                    jsonLdAvailability = String(offer.availability);
                  }
                  if (item?.availability && !jsonLdAvailability) {
                    jsonLdAvailability = String(item.availability);
                  }
                  if (detectedPriceNum == null && offer?.price) {
                    const parsedNum = parsePriceNumber(String(offer.price));
                    if (parsedNum) {
                      detectedPriceNum = parsedNum;
                      rawPriceText = String(offer.price);
                      if (offer.priceCurrency) detectedCurrency = String(offer.priceCurrency);
                    }
                  }
                }
              }
            } catch {
              // Ignore json parse errors
            }
          });

          // 2. OpenGraph tags
          if (detectedPriceNum == null) {
            const ogPrice = $('meta[property="product:price:amount"]').attr("content");
            if (ogPrice) {
              const parsedNum = parsePriceNumber(ogPrice);
              if (parsedNum) {
                detectedPriceNum = parsedNum;
                rawPriceText = ogPrice;
                const ogCur = $('meta[property="product:price:currency"]').attr("content");
                if (ogCur) detectedCurrency = ogCur;
              }
            }
          }

          // 3. Amazon specific selectors
          if (detectedPriceNum == null && retailer === "Amazon") {
            const amazonCandidates = [
              $(".priceToPay span.a-price-whole").first().text().trim(),
              $(".a-price .a-offscreen").first().text().trim(),
              $("#priceblock_ourprice").text().trim(),
              $("#priceblock_dealprice").text().trim(),
              $("#priceblock_saleprice").text().trim(),
              $("#corePriceDisplay_desktop_feature_div .a-price .a-offscreen")
                .first()
                .text()
                .trim(),
              $("#corePrice_desktop .a-price .a-offscreen").first().text().trim(),
              $("#apex_desktop .a-price .a-offscreen").first().text().trim(),
            ].filter(Boolean);

            for (const candidate of amazonCandidates) {
              const parsedNum = parsePriceNumber(candidate);
              if (parsedNum) {
                detectedPriceNum = parsedNum;
                rawPriceText = candidate;
                detectedCurrency = detectCurrency(candidate, detectedCurrency);
                break;
              }
            }
          }

          // 4. Flipkart specific selectors
          if (detectedPriceNum == null && retailer === "Flipkart") {
            const fkCandidates = [
              $("div.Nx9bqj").first().text().trim(),
              $("div._30jeq3").first().text().trim(),
              $("div._16Jk6d").first().text().trim(),
              $('div[class*="price"]').first().text().trim(),
            ].filter(Boolean);

            for (const candidate of fkCandidates) {
              const parsedNum = parsePriceNumber(candidate);
              if (parsedNum) {
                detectedPriceNum = parsedNum;
                rawPriceText = candidate;
                detectedCurrency = "INR";
                break;
              }
            }
          }

          // 5. Generic e-commerce price selectors
          if (detectedPriceNum == null) {
            const genericCandidates = [
              $('[itemprop="price"]').attr("content") || $('[itemprop="price"]').text().trim(),
              $("[data-price]").attr("data-price"),
              $(".product-price").first().text().trim(),
              $(".current-price").first().text().trim(),
              $(".sale-price").first().text().trim(),
              $(".price").first().text().trim(),
            ].filter(Boolean);

            for (const candidate of genericCandidates) {
              const parsedNum = parsePriceNumber(candidate);
              if (parsedNum) {
                detectedPriceNum = parsedNum;
                rawPriceText = candidate;
                detectedCurrency = detectCurrency(candidate, detectedCurrency);
                break;
              }
            }
          }

          const stockResult = detectStockStatus($, retailer, jsonLdAvailability);

          if (detectedPriceNum == null) {
            if (!stockResult.inStock) {
              return new Response(
                JSON.stringify({
                  success: true,
                  price: null,
                  currency: detectedCurrency,
                  inStock: false,
                  retailer,
                  url: finalUrlStr,
                  stockMessage: stockResult.reason || "Product is out of stock on retailer site",
                }),
                { status: 200, headers: { "content-type": "application/json" } },
              );
            }

            return new Response(
              JSON.stringify({
                success: false,
                error: "Could not detect active price from retailer link",
                inStock: true,
                retailer,
                url: finalUrlStr,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              price: detectedPriceNum,
              currency: detectedCurrency,
              rawPriceText,
              inStock: stockResult.inStock,
              retailer,
              url: finalUrlStr,
              stockMessage: stockResult.reason,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        } catch (err) {
          console.error("[CheckPrice] Unexpected error:", err);
          return new Response(
            JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : "Failed to check price from URL",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
