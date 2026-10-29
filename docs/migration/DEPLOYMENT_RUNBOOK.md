# Deployment runbook — not executable until approval gates pass

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

Local foundation: install from package lock; supply server-only environment settings outside Git; use a dedicated *_migrator account for db:migrate; switch to DML-only *_app for runtime; npm run build:node and start:node with host-assigned PORT/NITRO_HOST. OVU_BACKEND=mariadb mounts the new backend, but existing frontend features are still provider-dependent: do not deploy this checkpoint as a completed migration. Confirm UTC, migration checksums, independent session/provider configuration and all workflows before any staging rollout.

## Original audit baseline


No hosting or production deployment has been performed.

## Gate A: local release candidate

Complete independent database/auth/storage/backend/payment implementations on migration branches. Pin dependency lockfiles, runtime and source commits. Run full original tests plus real MariaDB migrations/concurrency, isolation tests, Razorpay Test Mode, browser SSR/routes/mobile/3D/Academy/certificate/Store workflows and restart persistence. Scan built client/server output for provider calls and secrets. Verify content/media inventories and record measured memory/startup/request durations. Obtain a verified encrypted source/data/object backup and restore proof.

## Gate B: hosting purchase approval

Resolve every open item in HOSTINGER_COMPATIBILITY_REPORT.md, including actual annual total and renewal. Present the tested release, limitations and exact plan. STOP and request explicit purchase approval; never buy automatically.

## Gate C: approved isolated staging

After purchase and approval, configure separate runtime and migration DB users, per-app databases, Node version, host-assigned port, independent origins, TLS, secrets and durable storage/backups. Use provider-required DB prefixes. Install approved schemas and data only. Deploy to staging without DNS changes. Keep Razorpay test keys and webhook paths isolated from live. Run release acceptance against the real Hostinger environment, including storage across redeployment and restore. Verify scheduled bounded tasks and webhook retry handling.

## Gate D: separately approved cutover

Record old DNS/deployment/config state and rollback target. Arrange final exports plus a deliberate write/payment cutover window. Stop or queue old writes without losing captured payments, synchronize final deltas, reconcile Razorpay captured orders, and keep the old webhook route able to acknowledge/replay events until ownership transfers safely. Approve each production payment/config/data operation. Switch DNS only with separate approval after staging passes. Monitor authorization, checkout, entitlement, certificate, Store and 3D flows. Do not cancel Lovable after DNS alone.

## Post-cutover

Verify backups, restore drills, incident alerts, access expiry, payment reconciliation, user support and historical audit continuity. Retain an agreed observation period and explicit user approval before any Lovable cancellation. Exported customer records and secrets stay encrypted outside repositories throughout.
