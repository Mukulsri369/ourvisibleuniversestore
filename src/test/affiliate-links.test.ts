import { describe, expect, it } from "vitest";
import { toCard } from "@/lib/store";

const product = {
  id: "legacy-product",
  name: "Projector",
  slug: "projector",
  short_description: null,
  price: null,
  currency: "INR",
  featured: false,
  affiliate_url: null,
  amazon_url: "https://link.amazon/B0e362Ssb?tag=example&ref=original",
  created_at: "2026-10-06T00:00:00Z",
  categories: null,
  product_images: [],
};

describe("product purchase links", () => {
  it("preserves the exact legacy link when the new field is missing", () => {
    expect(toCard(product).affiliate_url).toBe(product.amazon_url);
  });

  it("prefers the exact retailer-neutral link over the legacy link", () => {
    const url = "https://www.flipkart.com/item?affid=example&ref=original";
    expect(toCard({ ...product, affiliate_url: url }).affiliate_url).toBe(url);
  });

  it("falls back for empty links and remains unavailable without any link", () => {
    expect(toCard({ ...product, affiliate_url: "  " }).affiliate_url).toBe(product.amazon_url);
    expect(toCard({ ...product, amazon_url: null }).affiliate_url).toBeNull();
  });
});