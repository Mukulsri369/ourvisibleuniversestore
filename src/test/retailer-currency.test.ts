import { describe, expect, it } from "vitest";
import { currencyForUrl } from "@/lib/retailer-currency";

describe("currencyForUrl", () => {
  it("Amazon US is USD", () => expect(currencyForUrl("https://www.amazon.com/dp/B0X")).toBe("USD"));
  it("Amazon India is INR", () => expect(currencyForUrl("https://www.amazon.in/dp/B0X")).toBe("INR"));
  it("Amazon UK is GBP", () => expect(currencyForUrl("https://amazon.co.uk/dp/B0X")).toBe("GBP"));
  it("Amazon Canada is CAD", () => expect(currencyForUrl("https://www.amazon.ca/dp/B0X")).toBe("CAD"));
  it("Amazon Australia is AUD", () => expect(currencyForUrl("https://www.amazon.com.au/dp/X")).toBe("AUD"));
  it("Amazon Germany is EUR", () => expect(currencyForUrl("https://www.amazon.de/dp/X")).toBe("EUR"));
  it("Amazon UAE is AED", () => expect(currencyForUrl("https://www.amazon.ae/dp/X")).toBe("AED"));
  it("Flipkart is INR", () => expect(currencyForUrl("https://www.flipkart.com/x/p/itm1")).toBe("INR"));
  it("unknown short link is null", () => expect(currencyForUrl("https://amzn.to/abc")).toBeNull());
});
