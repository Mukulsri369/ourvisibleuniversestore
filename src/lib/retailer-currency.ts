/** Maps a retailer link's domain to its local store currency. Returns null when unknown. */
const AMAZON_TLD_CURRENCY: Record<string, string> = {
  com: "USD",
  in: "INR",
  "co.uk": "GBP",
  ca: "CAD",
  "com.au": "AUD",
  ae: "AED",
  de: "EUR",
  fr: "EUR",
  it: "EUR",
  es: "EUR",
  nl: "EUR",
  ie: "EUR",
  be: "EUR",
};

export function currencyForUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let host: string;
  try {
    host = new URL(value.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "a.co") return "USD";
  if (host === "amzn.in" || host.endsWith("flipkart.com") || host === "fkrt.it") return "INR";
  const m = host.match(/(?:^|\.)amazon\.(.+)$/);
  if (m) return AMAZON_TLD_CURRENCY[m[1]] ?? null;
  return null;
}
