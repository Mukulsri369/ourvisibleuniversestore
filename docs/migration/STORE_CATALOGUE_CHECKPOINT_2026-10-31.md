# Independent public catalogue — 31 October 2026

The public data layer now calls independent server functions for homepage rails, festival selections, shop/search/category browsing, category aliases, related products, category-quality picks and outbound click analytics. Its session-less Lovable/Supabase client and hardcoded public connection configuration have been removed. The remaining import from the legacy schema file is type-only; other Store admin/provider paths still exist and the Supabase package must remain until those replacements are verified.

The original relevance-scoring function is byte-for-byte unchanged. Stopword filtering, the 200-product search-candidate bound, price/newest/relevance sorting, page totals, featured/newest/home limits, curated festival order, automatic tag/text selection and exact affiliate link bytes are retained. Categories match all normalized memberships and the legacy primary category. Festival lamp matching remains name-only; “diwali” and “light” match names and short descriptions as before. The server always excludes inactive/deleted products, uses parameterized SQL and validates/limits filters independently of browser types.

Shop, search and category route loaders now await the same query used by ProductBrowser. This fixes the first built-app check which found only loading placeholders in the server response. Existing filters, layout, scientific backgrounds and error/retry UI are retained.

Anonymous click logging accepts only a public product ID, enforces the configured origin, does not store visitor identities, and has a shared durable limit of 1,000 accepted events per minute. It never blocks affiliate navigation. Its short transaction retries MariaDB snapshot/lock conflicts at most three times after rollback. A real concurrent near-limit test caught a snapshot conflict and now verifies that only one competing request gets the last slot, capped requests add no event, and the next window works. Analytics are approximate and must not be used as payment or entitlement evidence.

## Verification

- Eight new query workflow tests passed: home limits, festival order/fill, relevance/pagination/price sort, category aliases, duplicate-free related products, nonblocking analytics failure and database-error fallback.
- Six focused category-selection and affiliate-link tests passed. The original category test still exercises second-category search/browse and related memberships; its old PostgREST-string mocks now assert the independent endpoint input, with real SQL membership tests providing the persistence evidence.
- TypeScript and independent Node build passed with the final analytics retry/test changes.
- Built Node plus real MariaDB: shop/search HTML, real cookies, product save/read, public catalogue, click-origin denial, published-page HTML and process restart checks passed. The final combined built/catalogue rerun passed **2 checks**. A separate page transaction check also passed in the preceding **3-check** run.
- Actual desktop browser: two published synthetic products, ascending-price order, featured-only filtering, storefront search, category navigation, product detail, related products and populated homepage/festival rails passed. The unpublished synthetic draft never appeared; a private-only search term returned zero results. A multiword query still uses the original any-term/relevance behavior, so a shared word may return other published products.
- Actual 390-pixel mobile browser: filters opened, maximum price 1,000 returned only the 899-priced fixture, and no horizontal document overflow was observed. Evidence outside Git: `outputs/STORE_CATALOGUE_MOBILE_VERIFIED.jpg`.
- Catalogue browser fixtures deliberately had no images; their placeholders were expected. Image upload/read evidence belongs to the earlier product/media checkpoint, not this catalogue test.
- The disposable browser account, category and all three products were cleaned and the preview stopped. One initial fixture setup rejected an unsupported relative image URL; its partial account/category fixture was separately identified and cleaned before retrying with no images.
- Complete final suite: **251 passed, 0 failed, 0 skipped across 54 files**. No timing budgets, scenarios or assertions were removed to make this change pass.

## Remaining limits

The Store is not yet fully independent: category/settings/festival editing, bulk/trash/duplicate operations, extraction/price API authorization and safe outbound fetching, admin onboarding/email delivery, complete media lifecycle and broader workflows remain to be finished. Source audit found existing extraction/price handlers that still need independent authorization and the prepared SSRF-safe fetcher. They are development blockers, not production changes. Main Academy offline/provider replacement and final hosting compatibility/resource verification remain. Razorpay provider testing is deferred and unverified.
