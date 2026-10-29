# Repository audit

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
