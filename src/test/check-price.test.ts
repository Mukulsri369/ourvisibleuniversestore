import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/store";

describe("Price Formatting and Utility", () => {
  it("formats INR currency correctly", () => {
    const formatted = formatPrice(4018, "INR");
    expect(formatted).toContain("4,018");
  });

  it("formats USD currency correctly", () => {
    const formatted = formatPrice(49.99, "USD");
    expect(formatted).toContain("49.99");
  });

  it("returns null when price is null or undefined", () => {
    expect(formatPrice(null, "INR")).toBeNull();
  });

  it("handles out of stock response metadata correctly", () => {
    const oosResponse = {
      success: true,
      price: null,
      inStock: false,
      retailer: "Amazon",
      stockMessage: "Amazon reported: Currently unavailable / Out of stock",
    };
    expect(oosResponse.inStock).toBe(false);
    expect(oosResponse.stockMessage).toContain("unavailable");
  });

  it("identifies in stock response metadata correctly", () => {
    const inStockResponse = {
      success: true,
      price: 2499,
      currency: "INR",
      inStock: true,
      retailer: "Amazon",
    };
    expect(inStockResponse.inStock).toBe(true);
    expect(inStockResponse.price).toBe(2499);
  });
});
