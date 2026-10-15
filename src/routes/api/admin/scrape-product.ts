import { createFileRoute } from "@tanstack/react-router";
import * as cheerio from "cheerio/slim";
import { slugify } from "@/lib/store";
import { currencyForUrl } from "@/lib/retailer-currency";

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

const MOBILE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9,en-US;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

async function fetchAmazonMobile(
  hostname: string,
  asin: string,
): Promise<{ html: string; status: number; domain: string } | null> {
  const domains = [
    hostname.includes("amazon.") ? hostname : "www.amazon.in",
    "www.amazon.in",
    "www.amazon.com",
  ];
  const uniqueDomains = Array.from(new Set(domains));

  for (const domain of uniqueDomains) {
    try {
      const url = `https://${domain}/gp/aw/d/${asin}`;
      const res = await fetch(url, {
        headers: MOBILE_HEADERS,
        redirect: "follow",
      });
      if (res.ok) {
        const text = await res.text();
        if (
          text.length > 2000 &&
          !text.includes("503 - Service Unavailable") &&
          !text.includes("Robot Check")
        ) {
          return { html: text, status: res.status, domain };
        }
      }
    } catch {
      // try next candidate domain
    }
  }
  return null;
}

function isBlockedOrGenericTitle(title: string | undefined): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  return (
    t === "amazon.in" ||
    t === "amazon.com" ||
    t === "amazon" ||
    t === "flipkart.com" ||
    t === "flipkart" ||
    t.includes("robot check") ||
    t.includes("validatecaptcha") ||
    t.includes("just a moment") ||
    t.includes("attention required") ||
    t.includes("cloudflare") ||
    t.includes("access denied") ||
    t.includes("security check") ||
    t.includes("service unavailable") ||
    t.includes("page not found") ||
    t.includes("sign in") ||
    t.includes("continue shopping") ||
    t.includes("online shopping site") ||
    t.length < 3
  );
}

function extractUrlSlugHint(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Amazon slug: /slug-here/dp/ASIN or /gp/product/ASIN
    const amzMatch = url.pathname.match(/\/([a-zA-Z0-9_%-]+)\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (amzMatch && amzMatch[1]) {
      const decoded = decodeURIComponent(amzMatch[1])
        .replace(/[-_+]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (decoded.length > 3 && !decoded.toLowerCase().includes("amazon")) {
        return decoded;
      }
    }
    // Flipkart slug: /product-title-slug/p/itm...
    const fkMatch = url.pathname.match(/\/([a-zA-Z0-9_%-]+)\/p\//i);
    if (fkMatch && fkMatch[1]) {
      const decoded = decodeURIComponent(fkMatch[1])
        .replace(/[-_+]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (decoded.length > 3 && !decoded.toLowerCase().includes("flipkart")) {
        return decoded;
      }
    }
    // General path slug
    const segments = url.pathname.split("/").filter(Boolean);
    for (const seg of segments) {
      if (seg.length > 10 && seg.includes("-")) {
        const decoded = decodeURIComponent(seg).replace(/[-_+]/g, " ").replace(/\s+/g, " ").trim();
        if (
          decoded.length > 5 &&
          !/^[0-9a-f-]{15,}$/i.test(decoded) &&
          !decoded.toLowerCase().includes("product")
        ) {
          return decoded;
        }
      }
    }
  } catch {
    // Ignore URL parse error
  }
  return "";
}

function upgradeImageUrl(url: string | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("http")) return null;
  if (
    url.includes("sprite") ||
    url.includes("icon") ||
    url.includes("transparent-pixel") ||
    url.includes("pixel.gif") ||
    url.includes("play-button") ||
    url.includes("video")
  ) {
    return null;
  }
  // Amazon high-res upgrade: replace thumbnail dimension markers with ._SL1500_.
  if (url.includes("images-amazon.com") || url.includes("media-amazon.com")) {
    return url.replace(/\._[A-Z0-9_]+_\./i, "._SL1500_.");
  }
  // Flipkart resolution upgrade
  if (url.includes("rukminim")) {
    return url.replace(/\/image\/\d+\/\d+\//, "/image/1280/1280/");
  }
  return url;
}

export const Route = createFileRoute("/api/admin/scrape-product")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { url?: string };
          const rawUrl = body?.url?.trim();

          if (!rawUrl) {
            return new Response(JSON.stringify({ success: false, error: "URL is required" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          let parsedUrl: URL;
          try {
            parsedUrl = new URL(rawUrl);
          } catch {
            return new Response(JSON.stringify({ success: false, error: "Invalid URL provided" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          // Follow redirects to get the real canonical product URL (e.g. amzn.to / link.amazon -> amazon.in)
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
                error: `Unable to connect to product link: ${fetchErr instanceof Error ? fetchErr.message : "Network error"}`,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          } finally {
            clearTimeout(timeout);
          }

          const finalUrlStr = res.url || rawUrl;
          const finalUrl = new URL(finalUrlStr);
          const hostname = finalUrl.hostname.toLowerCase();

          // Detect retailer
          let retailer = "Other";
          if (hostname.includes("amazon.")) retailer = "Amazon";
          else if (hostname.includes("flipkart.")) retailer = "Flipkart";
          else if (hostname.includes("ubuy.")) retailer = "Ubuy";

          // Detect product ID (e.g. Amazon ASIN, Flipkart PID, or Ubuy ASIN)
          let retailerProductId = "";
          if (retailer === "Amazon") {
            const asinMatch = finalUrlStr.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
            if (asinMatch) retailerProductId = asinMatch[1].toUpperCase();
          } else if (retailer === "Flipkart") {
            retailerProductId = finalUrl.searchParams.get("pid") || "";
            if (!retailerProductId) {
              const pidMatch = finalUrlStr.match(/\/p\/([a-zA-Z0-9]+)/i);
              if (pidMatch) retailerProductId = pidMatch[1];
            }
          } else if (retailer === "Ubuy") {
            const ubuyAsinMatch =
              finalUrlStr.match(/(?:product|view\/product)\/([A-Z0-9]{10})/i) ||
              rawUrl.match(/(?:product|view\/product)\/([A-Z0-9]{10})/i);
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

          const isBlockedOrEmpty =
            res.status !== 200 ||
            html.length < 2000 ||
            html.includes("503 - Service Unavailable") ||
            html.includes("Robot Check") ||
            isCloudflareChallenge;

          if (
            (retailer === "Amazon" || retailer === "Ubuy") &&
            retailerProductId &&
            isBlockedOrEmpty
          ) {
            const mobResult = await fetchAmazonMobile(hostname, retailerProductId);
            if (mobResult) {
              html = mobResult.html;
              if (retailer === "Ubuy") retailer = "Amazon";
            } else if (isCloudflareChallenge) {
              let errorMsg = `The retailer (${hostname}) is protected by Cloudflare Bot Management (HTTP 403) and blocks automated scraping requests.`;
              if (retailer === "Ubuy" && retailerProductId) {
                errorMsg = `Ubuy (${hostname}) is protected by Cloudflare Bot Management (HTTP 403 Forbidden). This product corresponds to Amazon ASIN "${retailerProductId}". To auto-import full details and gallery photos, you can paste https://www.amazon.in/dp/${retailerProductId} (or https://www.amazon.com/dp/${retailerProductId}) into the fetcher, and keep your Ubuy link in the Affiliate URL field.`;
              }
              return new Response(
                JSON.stringify({
                  success: false,
                  error: errorMsg,
                  data: {
                    retailer,
                    retailer_product_id: retailerProductId,
                    affiliate_url: rawUrl,
                    suggested_source_url: retailerProductId
                      ? `https://www.amazon.in/dp/${retailerProductId}`
                      : undefined,
                  },
                }),
                {
                  status: 200,
                  headers: { "content-type": "application/json" },
                },
              );
            }
          } else if (isCloudflareChallenge) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `The retailer (${hostname}) is protected by Cloudflare Bot Management (HTTP 403).`,
                data: {
                  retailer,
                  retailer_product_id: retailerProductId,
                  affiliate_url: rawUrl,
                },
              }),
              {
                status: 200,
                headers: { "content-type": "application/json" },
              },
            );
          }

          // If the redirect resulted in a non-200 or captcha page, retry fetching the final canonical URL with browser headers
          if (
            res.status !== 200 ||
            isBlockedOrGenericTitle(html.match(/<title>([^<]+)<\/title>/i)?.[1])
          ) {
            try {
              const retryRes = await fetch(finalUrlStr, {
                headers: BROWSER_HEADERS,
                redirect: "follow",
              });
              if (retryRes.status === 200) {
                html = await retryRes.text();
              }
            } catch {
              // Keep original response html if retry fails
            }
          }

          const slugHint = extractUrlSlugHint(finalUrlStr) || extractUrlSlugHint(rawUrl);
          const $ = cheerio.load(html);

          // 1. Check Schema.org JSON-LD
          let schemaProduct = null as Record<string, any> | null;
          $('script[type="application/ld+json"]').each((_, el) => {
            try {
              const content = $(el).html();
              if (!content) return;
              const parsed = JSON.parse(content);
              if (parsed && typeof parsed === "object") {
                if (parsed["@type"] === "Product") {
                  schemaProduct = parsed;
                } else if (Array.isArray(parsed["@graph"])) {
                  const found = parsed["@graph"].find(
                    (item: Record<string, unknown>) => item["@type"] === "Product",
                  );
                  if (found) schemaProduct = found;
                }
              }
            } catch {
              // Ignore invalid JSON-LD blocks
            }
          });

          // 2. Extract Exact Product Title
          let rawName =
            $("#productTitle").text().trim() ||
            (typeof schemaProduct?.name === "string" ? schemaProduct.name : "") ||
            $('meta[property="og:title"]').attr("content") ||
            $("h1").first().text().trim() ||
            $("title").text().trim();

          // Strip marketplace branding suffixes only
          rawName = rawName
            .replace(/\s*:\s*Amazon\.[a-z.]+.*$/i, "")
            .replace(/\s*\|\s*Amazon\.[a-z.]+.*$/i, "")
            .replace(/^Amazon\.[a-z.]+:\s*Buy\s*/i, "")
            .replace(/\s*:\s*Buy\s+.*Online at Low Prices.*/i, "")
            .replace(/\s*\|\s*Flipkart\.com.*$/i, "")
            .replace(/\s*-\s*Flipkart$/i, "")
            .trim();

          if (isBlockedOrGenericTitle(rawName)) {
            rawName = slugHint || "";
          }

          // 3. Extract Authentic Brand
          let brand = "";
          if (schemaProduct?.brand) {
            const b = schemaProduct.brand as { name?: string } | string;
            brand = typeof b === "string" ? b : b.name || "";
          }
          if (!brand) {
            brand =
              $("#bylineInfo").text().trim() ||
              $('meta[property="product:brand"]').attr("content") ||
              $('a[id*="brand"]').text().trim() ||
              "";
          }
          brand = brand.replace(/^(Visit the|Brand:)\s*/i, "").trim();

          // 4. Extract Price and Currency
          let price = "";
          let currency = currencyForUrl(finalUrlStr) ?? currencyForUrl(rawUrl) ?? "INR";

          if (schemaProduct?.offers) {
            const offers = Array.isArray(schemaProduct.offers)
              ? schemaProduct.offers[0]
              : (schemaProduct.offers as Record<string, unknown>);
            if (offers) {
              if (offers.price) price = String(offers.price);
              if (typeof offers.priceCurrency === "string") currency = offers.priceCurrency;
            }
          }

          if (!price) {
            const ogPrice = $('meta[property="product:price:amount"]').attr("content");
            if (ogPrice) {
              price = ogPrice;
              currency = $('meta[property="product:price:currency"]').attr("content") || currency;
            }
          }

          if (!price) {
            const amazonPriceText =
              $(".a-price .a-offscreen").first().text().trim() ||
              $("#priceblock_ourprice").text().trim() ||
              $("#priceblock_dealprice").text().trim() ||
              $(".priceToPay span.a-price-whole").first().text().trim();

            if (amazonPriceText) {
              if (amazonPriceText.includes("$")) currency = "USD";
              else if (amazonPriceText.includes("£")) currency = "GBP";
              else if (amazonPriceText.includes("€")) currency = "EUR";
              else if (amazonPriceText.includes("₹")) currency = "INR";

              const num = amazonPriceText.replace(/[^0-9.]/g, "");
              if (num) price = num;
            }
          }

          if (!price && retailer === "Flipkart") {
            const fkPrice =
              $('div[class*="price"]').first().text().trim() ||
              $("div._30jeq3").first().text().trim();
            if (fkPrice) {
              const num = fkPrice.replace(/[^0-9.]/g, "");
              if (num) {
                price = num;
                currency = "INR";
              }
            }
          }

          // 5. Extract Authentic Specifications Table
          const specs: string[] = [];
          $("#productOverview_feature_div tr").each((_, tr) => {
            const k = $(tr)
              .find("td.a-span3, th, td:first-child")
              .text()
              .replace(/\s+/g, " ")
              .trim();
            const v = $(tr).find("td.a-span9, td:last-child").text().replace(/\s+/g, " ").trim();
            if (k && v && !k.toLowerCase().includes("customer reviews")) {
              specs.push(`${k}: ${v}`);
            }
          });

          // 6. Extract Exact "About this item" Feature Bullets
          const features: string[] = [];
          $("#feature-bullets li span.a-list-item").each((_, el) => {
            const text = $(el).text().replace(/\s+/g, " ").trim();
            if (
              text &&
              !text.toLowerCase().includes("make sure this fits") &&
              !text.toLowerCase().includes("see more product details")
            ) {
              features.push(text);
            }
          });

          // 7. Extract Exact Product Description
          let rawDesc =
            $("#productDescription").text().replace(/\s+/g, " ").trim() ||
            (typeof schemaProduct?.description === "string" ? schemaProduct.description : "") ||
            $('meta[property="og:description"]').attr("content") ||
            $('meta[name="description"]').attr("content") ||
            "";

          rawDesc = rawDesc
            .replace(/\s*:\s*Amazon\.[a-z.]+.*$/i, "")
            .replace(/\s*\|\s*Amazon\.[a-z.]+.*$/i, "")
            .replace(/\s*\|\s*Flipkart\.com.*$/i, "")
            .replace(/\s*-\s*Flipkart$/i, "")
            .trim();

          if (isBlockedOrGenericTitle(rawDesc)) {
            rawDesc = "";
          }

          const finalName = rawName || slugHint || "Original Product";

          // Assemble exact raw description without reformatting or AI rewriting
          const descSections: string[] = [];
          if (rawDesc && rawDesc !== finalName) {
            descSections.push(rawDesc);
          }
          if (features.length > 0 && (!rawDesc || !rawDesc.includes(features[0]))) {
            descSections.push("About this item:\n" + features.map((f) => `• ${f}`).join("\n"));
          }
          if (specs.length > 0) {
            descSections.push("Product Specifications:\n" + specs.join("\n"));
          }
          const finalDesc =
            descSections.join("\n\n") || rawDesc || features.join("\n\n") || finalName;

          // Short description: verbatim first bullet or first 200 characters of raw description
          let finalShort = "";
          if (features.length > 0) {
            finalShort = features[0];
          } else if (rawDesc) {
            finalShort = rawDesc.slice(0, 180).trim();
          } else if (specs.length > 0) {
            finalShort = specs.slice(0, 3).join(", ");
          } else {
            finalShort = finalName;
          }

          // 8. Extract All Original High-Resolution Gallery Images
          const imageUrls = new Set<string>();

          // A. Landing image & dynamic images
          $("#landingImage").each((_, el) => {
            const hires = $(el).attr("data-old-hires");
            if (hires) {
              const up = upgradeImageUrl(hires);
              if (up) imageUrls.add(up);
            }
            const dynamic = $(el).attr("data-a-dynamic-image");
            if (dynamic) {
              try {
                const parsed = JSON.parse(dynamic) as Record<string, number[]>;
                Object.keys(parsed).forEach((k) => {
                  const up = upgradeImageUrl(k);
                  if (up) imageUrls.add(up);
                });
              } catch {
                // Ignore dynamic image parse errors
              }
            }
            const src = $(el).attr("src");
            if (src) {
              const up = upgradeImageUrl(src);
              if (up) imageUrls.add(up);
            }
          });

          // B. Alt gallery images (#altImages)
          $("#altImages img").each((_, el) => {
            const src = $(el).attr("src");
            const up = upgradeImageUrl(src);
            if (up) imageUrls.add(up);
          });

          // C. Embedded colorImages JSON array in page scripts
          const colorMatches =
            html.match(/'colorImages':\s*\{\s*'initial':\s*(\[\s*\{[\s\S]*?\}\s*\])/) ||
            html.match(/"colorImages":\s*\{\s*"initial":\s*(\[\s*\{[\s\S]*?\}\s*\])/);
          if (colorMatches && colorMatches[1]) {
            try {
              const arr = JSON.parse(colorMatches[1].replace(/'/g, '"'));
              if (Array.isArray(arr)) {
                for (const item of arr) {
                  if (item.hiRes) {
                    const up = upgradeImageUrl(item.hiRes);
                    if (up) imageUrls.add(up);
                  }
                  if (item.large) {
                    const up = upgradeImageUrl(item.large);
                    if (up) imageUrls.add(up);
                  }
                }
              }
            } catch {
              // Ignore colorImages parse errors
            }
          }

          // D. Schema.org images
          if (schemaProduct?.image) {
            const imgs = Array.isArray(schemaProduct.image)
              ? schemaProduct.image
              : [schemaProduct.image];
            for (const img of imgs) {
              const u = typeof img === "string" ? img : (img as { url?: string })?.url;
              const up = upgradeImageUrl(u);
              if (up) imageUrls.add(up);
            }
          }

          // E. OpenGraph image
          const ogImg = $('meta[property="og:image"]').attr("content");
          if (ogImg) {
            const up = upgradeImageUrl(ogImg);
            if (up) imageUrls.add(up);
          }

          // F. Flipkart gallery images
          if (retailer === "Flipkart") {
            $('img[src*="rukminim"]').each((_, el) => {
              const src = $(el).attr("src");
              const up = upgradeImageUrl(src);
              if (up) imageUrls.add(up);
            });
          }

          // Filter out tracking icons, base64, svg, duplicate URLs
          const validImages = [...imageUrls].filter(
            (u) =>
              u &&
              /^https?:\/\//i.test(u) &&
              !u.includes("base64") &&
              !u.endsWith(".svg") &&
              !u.includes("nav-logo") &&
              !u.includes("favicon"),
          );

          // 9. Extract Relevant Product Tags
          const rawWords = `${finalName} ${brand}`
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(
              (w) =>
                w.length >= 4 &&
                !["with", "from", "this", "that", "item", "inch", "pack", "size"].includes(w),
            );
          const suggestedTags = Array.from(new Set(rawWords)).slice(0, 8);

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                name: finalName,
                slug: slugify(finalName),
                short_description: finalShort,
                description: finalDesc,
                features,
                brand,
                price,
                currency,
                retailer,
                retailer_product_id: retailerProductId,
                affiliate_url: rawUrl,
                images: validImages,
                tags: suggestedTags,
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        } catch (err) {
          console.error("[ScrapeProduct] Unexpected error:", err);
          return new Response(
            JSON.stringify({
              success: false,
              error:
                err instanceof Error ? err.message : "Failed to extract product details from URL",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
