# Repository audit

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

The main branch now merges the remote audit history without rewriting commits. Store is a fresh clone of migration/mariadb-hostinger. Earlier unrelated local Store edits are preserved in their original directory. Main realtime voice modules used server AI fallbacks that the official Node build correctly rejected in the browser graph; an isomorphic request-context wrapper now preserves the fallback only on the server, with all realtime validation checks passing.

## Original audit baseline


## Source provenance

| Application | GitHub default-branch HEAD observed 2026-10-29 | Migration branch |
|---|---|---|
| OVU | ba30dc9035a229eb475c5d36ec7ef1b6bf2db263 | migration/mariadb-hostinger |
| Store | b73f3b0f666e0f97d523f59c3b122de5a4547227 | migration/mariadb-hostinger |

These are repository heads, NOT confirmed deployed production commits. Do not advertise them as production backups. Both applications use React 19, TanStack Start 1.168.60, router 1.170.41, Vite 8 and Nitro 3 beta. Both drizzle/schema.ts files are empty: derive actual schemas from migrations, database types and runtime queries, then reconcile against an approved schema export.

## Runtime boundaries

Both vite.config.ts files import @lovable.dev/vite-tanstack-config; this config supplies multiple plugins and defaults Nitro to Cloudflare. Preserve src/server.ts SSR error handling and src/start.ts CSRF middleware. Replace the build wrapper deliberately with official TanStack/React/Tailwind/paths/Nitro plugins and a Node preset; a Vite preview is not the production process.

OVU additionally imports @lovable.dev/cloud-auth-js and @lovable.dev/mcp-js. MCP at /mcp, OAuth consent and protected-resource metadata are existing functionality and require independent replacements, not deletion. The paid universe route, account, checkout, subscription administration, Academy functions and certificate verification all cross provider boundaries. Scientific data, simulations, shaders and camera state must remain unchanged.

Store persistence includes product/category/media/settings/admin/click records AND a sizeable visual page editor: immutable published versions, optimistic draft concurrency, history recovery, publication and restore operations. Its Supabase persistence adapter is a major migration boundary. Product videos and range serving are also required.

## Security findings requiring remediation before cutover

1. OVU src/integrations/supabase/client.server.ts has an in-memory placeholder backend selected by placeholder configuration. It can report successful writes without durable MariaDB persistence. Remove this production fallback after replacement; integration tests must require a real database.
2. OVU Academy certificate/learning server modules contain hardcoded signing fallbacks. Remove fallback signing secrets, fail closed, and protect real keys externally. Keep legacy verification compatibility through explicit signing-key versions after approved export.
3. Store /api/admin/scrape-product and /api/admin/check-price handlers do not show a server-side admin authorization check and fetch user-influenced URLs. A private UI route does not secure a standalone HTTP endpoint. Require verified admin sessions, CSRF/rate controls, constrained retailer destinations and redirect/DNS/IP defenses.
4. Existing SQL uses auth.users/auth.uid, service_role and RLS. A privileged MariaDB connection is not equivalent authorization. Replace each policy with explicit server checks, ownership predicates and negative tests.
5. Razorpay verifies signatures and re-fetches captured payments, but fulfillment relies on a PostgreSQL RPC. The current webhook handles payment.captured only; durable events/refunds/reconciliation need implementation.
6. Source .env files are tracked. Inventory records variable names without values. An anonymous publishable key alone is not a privileged secret; real privileged credentials must be reviewed and rotated privately if exposure is confirmed. No production secret rotation has been performed.
7. COSMOS AI/TTS/live-session server functions need independent authorization, validated inputs and rate limits. Preserve existing Web Speech fallback but do not count it as successful paid AI-service validation.

## Audit limits

FILE_MIGRATION_INVENTORY.csv lists every pinned tracked file. LOVABLE_DEPENDENCY_INVENTORY.md lists pattern hits with line references and actions. Manual review focused on payment/auth/server/storage/fetch boundaries. Pattern hits include tooling and comments; exhaustive dynamic runtime coverage still requires local workflow tests and approved production configuration/schema inventory.
