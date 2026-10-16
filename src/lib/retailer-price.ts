import type { CheerioAPI } from "cheerio/slim";
import { currencyForUrl } from "./retailer-currency";

/** Never substitute another country's offer when the requested market is unavailable. */
export function amazonPriceDomains(hostname: string): string[] {
  const host = hostname.toLowerCase();
  return /^(?:[a-z0-9-]+\.)*amazon\.[a-z.]+$/.test(host) && currencyForUrl(`https://${host}`)
    ? [host]
    : [];
}

export function detectPriceCurrency(text: string, fallback: string): string {
  if (/₹|\bRs\.?\b|\bINR\b/i.test(text)) return "INR";
  if (/\bCAD\b|C\$/i.test(text)) return "CAD";
  if (/\bAUD\b|A\$/i.test(text)) return "AUD";
  if (/\bAED\b/i.test(text)) return "AED";
  if (/£|\bGBP\b/i.test(text)) return "GBP";
  if (/€|\bEUR\b/i.test(text)) return "EUR";
  if (/\bUSD\b|US\$/i.test(text)) return "USD";
  if (text.includes("$")) return ["CAD", "AUD"].includes(fallback) ? fallback : "USD";
  return fallback;
}

export function parseRetailerPrice(raw: string, currency = "USD"): number | null {
  // Preserve decimal cents, including European decimal commas; never concatenate ranges.
  const matches = raw.trim().match(/\d+(?:[.,\s\u00a0\u202f]\d+)*/g);
  if (!matches || matches.length !== 1) return null;
  let value = matches[0].replace(/[\s\u00a0\u202f]/g, "");
  const dot = value.lastIndexOf(".");
  const comma = value.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    value = comma > dot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = value.length - comma - 1;
    value = decimals === 2 || (currency === "EUR" && decimals === 1)
      ? value.replace(",", ".")
      : value.replace(/,/g, "");
  } else if (dot >= 0 && currency === "EUR" && value.length - dot - 1 === 3) {
    value = value.replace(/\./g, "");
  }
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
}

/** Read only the product's buy-box, not list prices, installments, or recommendation cards. */
export function amazonPriceCandidates($: CheerioAPI): string[] {
  const candidates: string[] = [];
  const selectors = [
    "#corePriceDisplay_desktop_feature_div .priceToPay",
    "#corePriceDisplay_mobile_feature_div .priceToPay",
    "#corePrice_desktop .priceToPay",
    "#apex_desktop .priceToPay",
    "#apex_mobile .priceToPay",
    ".priceToPay",
    "#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price)",
    "#corePriceDisplay_mobile_feature_div .a-price:not(.a-text-price)",
    "#corePrice_desktop .a-price:not(.a-text-price)",
    "#apex_desktop .a-price:not(.a-text-price)",
    "#apex_mobile .a-price:not(.a-text-price)",
  ];
  for (const selector of selectors) {
    const node = $(selector).first();
    const full = node.find(".a-offscreen").first().text().trim();
    if (full) candidates.push(full);
    else {
      const whole = node.find(".a-price-whole").first().text().trim().replace(/[.,]$/, "");
      const fraction = node.find(".a-price-fraction").first().text().trim();
      const symbol = node.find(".a-price-symbol").first().text().trim();
      if (whole && /^\d{2}$/.test(fraction)) candidates.push(`${symbol}${whole}.${fraction}`);
    }
  }
  for (const selector of ["#priceblock_dealprice", "#priceblock_saleprice", "#priceblock_ourprice"]) {
    const text = $(selector).first().text().trim();
    if (text) candidates.push(text);
  }
  return [...new Set(candidates)];
}