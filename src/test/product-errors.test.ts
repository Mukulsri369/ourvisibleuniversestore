import { describe, expect, it } from "vitest";
import { DUPLICATE_AFFILIATE_MESSAGE, isDuplicateAffiliateError, productSaveErrorMessage } from "@/lib/product-errors";

describe("affiliate publishing errors", () => {
  it("recognizes database duplicate errors returned as plain objects", () => {
    const error = { code: "23505", message: DUPLICATE_AFFILIATE_MESSAGE };
    expect(isDuplicateAffiliateError(error)).toBe(true);
    expect(productSaveErrorMessage(error)).toBe(DUPLICATE_AFFILIATE_MESSAGE);
  });
  it("does not confuse duplicate slugs with duplicate affiliate links", () => {
    const error = { code: "23505", message: "Duplicate product slug." };
    expect(isDuplicateAffiliateError(error)).toBe(false);
    expect(productSaveErrorMessage(error)).toBe(error.message);
  });
  it("handles unexpected failures safely", () => {
    expect(isDuplicateAffiliateError(null)).toBe(false);
    expect(productSaveErrorMessage(undefined)).toBe("Could not save the product.");
  });
});