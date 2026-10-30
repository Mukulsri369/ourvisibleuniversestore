## Store backup exception authorized — 30 October 2026

The user explicitly authorized local Store development and MariaDB migration without a verified Lovable Store backup. The GitHub repository is the source of truth for code. Missing data must be documented and never invented. This removes the backup prerequisite for reversible local development and testing only; it does not authorize production deletion, deployment, purchases, DNS/payment changes, customer access modifications or Lovable cancellation.

No Store database or object-storage export is available. Original product records, categories, customized settings, product images not committed to the repository, click history and visual-editor drafts/published versions cannot currently be verified or restored. Source code and checked-in assets are recoverable from GitHub. Local tests use named synthetic fixtures and clean them up; they are not original records. Empty schema creation is not production data recovery.

A new internal MariaDB product service validates administrator roles, strict fields, HTTPS affiliate URLs, exact category references, atomic ordered category updates, revision conflicts and duplicate affiliate URLs on publication. It records administrative audits and filters public reads to active/non-deleted products. Migration 0003 adds revision tracking. The service is not connected to Store UI/API routes yet.

Verification: 8 backend/authentication/retailer/product tests pass with no skips; 2 real Store schema/replay/Unicode/JSON/FK/UTC tests pass; official Node build passes. The original 40 editor test failures and source type mismatches remain unresolved and were not skipped or removed. Pending: wire product APIs/admin/catalog, complete editor persistence/storage/imports and repair original tests, then browser/mobile/integration QA. Academy offline/provider replacement and Hostinger compatibility remain open. Actual Razorpay provider testing remains deferred and unverified.

# Store migration report

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

Store now has a fresh isolated Git checkout, reproducible dependency lock, applied MariaDB schema and reviewed outbound HTTPS guard. retailer-fetch.server.ts validates an approved retailer host, global-unicast DNS addresses, pins the checked address for TLS connections, rechecks redirects and enforces body/time limits. It must still replace all existing scraper fetch paths. Existing retailer bot blocking is a baseline limitation, not proof of a migration regression. The original editor tests/types reference APIs and fixture shapes that disagree with current implementation; 40 tests still fail. Cosmic Cart's database panel is paused/out of credits, blocking verified Store data/storage exports.

## Original audit baseline


Status: audited pinned source; runtime migration and local business tests pending.

Public catalogue/search, multiple categories, affiliate destinations, admin management, Store settings, private images, videos, extraction, price/availability checks and the visual editor are all in scope. Preserve DOM/layout/styles/Three.js/Motion behavior. GitHub snapshot and per-file actions are recorded in the inventories. Original unrelated local changes are preserved separately from this migration.

Replace src/lib/store.ts public reads/click writes, src/lib/admin.ts uploads/removals, auth/admin route checks and the visual editor Supabase persistence adapter with independent APIs. Public projections must filter unpublished/trashed content and exclude private contact settings. Each editor mutation requires verified admin authorization and revision checks. Preserve immutable published versions, recovery/history and restore semantics.

Keep /api/public/img/$ URL compatibility. Use private durable storage outside the web root, opaque generated file names, allowed path prefixes, normalized path containment, MIME/file-signature/size checks, resource bounds and authenticated uploads. Serve image caching and video byte ranges without exposing provider secrets. Backup objects and database together. Hostinger filesystem persistence across redeploys is unverified; do not store irreplaceable media in an ephemeral build directory.

Scraping/price routes currently perform direct outbound fetches without an explicit server admin guard in those handlers. Add authorization first. Restrict protocols and retailers; reject credentials, nonstandard ports and private/local/link-local/metadata addresses for IPv4 and IPv6; validate DNS answers and every redirect and pin the validated destination for the request to resist rebinding. Bound redirects, time, response bytes and concurrency; rate-limit and audit requests. Retailer API policies/robots/rate limits need per-retailer review. Retain cheerio/slim and existing shared currency/price parsing.

Database conversion must preserve effective affiliate URLs unchanged, database-enforced duplicate live-publication invariants, ordered category membership and first-category compatibility, media ordering, product trash/restore, admin approval and private Store settings. Migrate SQL page-persistence RPCs into real transactions, not client-only edits.

Required validation: catalogue visibility, filters/search, product slug routes, link byte equality, drafts/trash/restore, concurrent publishing duplicates, multiple-category changes, authorized/unauthorized uploads, range video playback, editor autosave conflict/history/recovery, save/publish/restore race tests, malicious fetch URLs/redirects/DNS answers, retailer price fixtures, retries/timeouts and app restart persistence. No claim of Store build/test success is made.
