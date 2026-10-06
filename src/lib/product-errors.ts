export const DUPLICATE_AFFILIATE_MESSAGE = "This affiliate URL is already used by another product. Use a different URL before publishing.";

export function isDuplicateAffiliateError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  return typeof error.message === "string" && error.message.includes("This affiliate URL is already used by another product.");
}

export function productSaveErrorMessage(error: unknown): string {
  if (isDuplicateAffiliateError(error)) return DUPLICATE_AFFILIATE_MESSAGE;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Could not save the product.";
}