# Hostinger compatibility report — preliminary, purchase NOT approved

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

No hosting purchase, production deployment or new compatibility claim was made during the foundation work. Node build success alone does not prove Hostinger compatibility. The existing preliminary plan/pricing/version/storage questions remain open until actual independent workflows and resource measurements pass.

## Original audit baseline


Checked official documentation 2026-10-29. Candidate: Business/Unlimited managed Node.js, subject to real runtime and resource validation. Cloud Startup and VPS remain Hostinger alternatives if essential requirements cannot fit. No purchase recommendation yet.

[Current Node limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/) list five Node websites for Business/Unlimited, shared process/thread resources, a 120-second request timeout, no inbound WebSockets and no permanent workers. Two apps fit the documented website count, but memory, startup and workload have not been measured. Price/extraction/catalog jobs must fit request limits or use supported cron/bounded jobs. Check whether COSMOS live sessions connect directly outbound to the AI provider; inbound proxy WebSockets would block this plan.

[Deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) lists Node 18/20/22/24 and an Other application type. TanStack Start is not an expressly verified preset here. Preserve TanStack and validate an official Nitro Node build, assigned PORT, SSR streaming/cookies, server functions, webhook raw bytes, restart behavior and static assets. Original OVU build currently emits Cloudflare wrangler output; that artifact cannot establish Hostinger Node compatibility. Current [TanStack hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) and [Nitro Node runtime](https://nitro.build/deploy/runtimes/node) guides describe an independent Node path.

[Hostinger DB engine article](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/) states MariaDB for Web/Cloud on port 3306. The newer [Node database guide](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/) uses the MySQL product label and recommends 127.0.0.1. Reconcile the exact provisioned engine/version, SQL features, account/database name prefixes, connection ceilings and database access from both Node apps with Hostinger before committing to a plan. Do not assume local 11.8.9 features or localhost:3307 carry over.

## Price evidence and remaining quote

[Indian Node hosting page](https://www.hostinger.com/in/nodejs-hosting) currently advertises Unlimited at INR199/month with INR9,552 due for 48 months, renewal INR649/month for the same term. Cloud Startup shows INR599/month with INR28,752 due for 48 months and INR1,599/month renewal. These are 48-month offers, NOT a verified annual purchase. Actual 12-month first-year total, GST, renewal term/tax, domains/email/storage/backup costs and any external AI/email costs remain unverified. Do not multiply the promotional monthly rate by 12 and present it as an annual checkout quote.

## Acceptance before purchase

Obtain written/visible confirmation of two independent domains/apps and SSL; exact DB engine/version/limits; persistent private storage across redeploy and restore; environment secrets; supported cron; resource memory/CPU; outbound email/provider access; webhook request/body handling; deploy startup command and billing/renewal quote for a 12-month term. Run both independent apps locally, measure startup/memory and validate business/3D/mobile workflows first. No hosting, DNS, payment or live services have been modified.
