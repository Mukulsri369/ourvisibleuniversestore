# Store migration report

Status: audited pinned source; runtime migration and local business tests pending.

Public catalogue/search, multiple categories, affiliate destinations, admin management, Store settings, private images, videos, extraction, price/availability checks and the visual editor are all in scope. Preserve DOM/layout/styles/Three.js/Motion behavior. GitHub snapshot and per-file actions are recorded in the inventories. Original unrelated local changes are preserved separately from this migration.

Replace src/lib/store.ts public reads/click writes, src/lib/admin.ts uploads/removals, auth/admin route checks and the visual editor Supabase persistence adapter with independent APIs. Public projections must filter unpublished/trashed content and exclude private contact settings. Each editor mutation requires verified admin authorization and revision checks. Preserve immutable published versions, recovery/history and restore semantics.

Keep /api/public/img/$ URL compatibility. Use private durable storage outside the web root, opaque generated file names, allowed path prefixes, normalized path containment, MIME/file-signature/size checks, resource bounds and authenticated uploads. Serve image caching and video byte ranges without exposing provider secrets. Backup objects and database together. Hostinger filesystem persistence across redeploys is unverified; do not store irreplaceable media in an ephemeral build directory.

Scraping/price routes currently perform direct outbound fetches without an explicit server admin guard in those handlers. Add authorization first. Restrict protocols and retailers; reject credentials, nonstandard ports and private/local/link-local/metadata addresses for IPv4 and IPv6; validate DNS answers and every redirect and pin the validated destination for the request to resist rebinding. Bound redirects, time, response bytes and concurrency; rate-limit and audit requests. Retailer API policies/robots/rate limits need per-retailer review. Retain cheerio/slim and existing shared currency/price parsing.

Database conversion must preserve effective affiliate URLs unchanged, database-enforced duplicate live-publication invariants, ordered category membership and first-category compatibility, media ordering, product trash/restore, admin approval and private Store settings. Migrate SQL page-persistence RPCs into real transactions, not client-only edits.

Required validation: catalogue visibility, filters/search, product slug routes, link byte equality, drafts/trash/restore, concurrent publishing duplicates, multiple-category changes, authorized/unauthorized uploads, range video playback, editor autosave conflict/history/recovery, save/publish/restore race tests, malicious fetch URLs/redirects/DNS answers, retailer price fixtures, retries/timeouts and app restart persistence. No claim of Store build/test success is made.
