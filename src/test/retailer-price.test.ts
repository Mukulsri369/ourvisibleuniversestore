import { describe, expect, it } from "vitest";
import { load } from "cheerio/slim";
import { amazonPriceCandidates, amazonPriceDomains, detectPriceCurrency, parseRetailerPrice } from "@/lib/retailer-price";

describe("retailer price accuracy", () => {
  it.each([
    ["$1,299.99", "USD", 1299.99],
    ["$49.95", "USD", 49.95],
    ["₹4,018.00", "INR", 4018],
    ["1.299,99 €", "EUR", 1299.99],
    ["49,95 €", "EUR", 49.95],
    ["1 299,99 €", "EUR", 1299.99],
  ])("parses %s without losing cents", (raw, currency, expected) => {
    expect(parseRetailerPrice(raw, currency)).toBe(expected);
  });
  it("rejects ambiguous ranges and invalid prices", () => {
    for (const raw of ["$10 - $20", "Currently unavailable", "0", "NaN", "$49.99 $59.99"]) {
      expect(parseRetailerPrice(raw)).toBeNull();
    }
  });
  it("keeps retries in the original Amazon marketplace", () => {
    expect(amazonPriceDomains("www.amazon.com")).toEqual(["www.amazon.com"]);
    expect(amazonPriceDomains("www.amazon.co.uk")).toEqual(["www.amazon.co.uk"]);
    expect(amazonPriceDomains("www.amazon.in")).toEqual(["www.amazon.in"]);
    expect(amazonPriceDomains("amzn.to")).toEqual([]);
    expect(amazonPriceDomains("www.ubuy.com")).toEqual([]);
    expect(amazonPriceDomains("amazon.com.attacker.example")).toEqual([]);
  });
  it("prefers the complete buy-box price over recommendations and list prices", () => {
    const $ = load(`<div class="recommendation"><span class="a-price"><span class="a-offscreen">$9.99</span></span></div>
      <div id="corePriceDisplay_desktop_feature_div"><span class="a-price a-text-price"><span class="a-offscreen">$99.99</span></span>
      <span class="a-price priceToPay"><span class="a-offscreen">$49.95</span><span class="a-price-whole">49.</span><span class="a-price-fraction">95</span></span></div>`);
    expect(amazonPriceCandidates($)).toEqual(["$49.95"]);
  });
  it("combines separately rendered dollars and cents", () => {
    const $ = load(`<span class="priceToPay"><span class="a-price-symbol">$</span><span class="a-price-whole">1,299.</span><span class="a-price-fraction">99</span></span>`);
    expect(parseRetailerPrice(amazonPriceCandidates($)[0])).toBe(1299.99);
  });
  it("does not report a truncated whole-only price", () => {
    expect(amazonPriceCandidates(load(`<span class="priceToPay"><span class="a-price-whole">49.</span></span>`))).toEqual([]);
  });
  it("preserves regional dollar currencies", () => {
    expect(detectPriceCurrency("$49.95", "CAD")).toBe("CAD");
    expect(detectPriceCurrency("$49.95", "AUD")).toBe("AUD");
    expect(detectPriceCurrency("$49.95", "USD")).toBe("USD");
  });
});