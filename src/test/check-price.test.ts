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
});
