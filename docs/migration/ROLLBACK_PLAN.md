# Rollback plan

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

New local foundation migrations are additive and checksummed. Do not edit completed SQL files or drop databases to undo code. Revert logical branch commits for code rollback; use an approved verified backup for any future data rollback. Keep app and migrator credentials separate. A DPAPI encrypted main export now exists privately, but inspection/restoration and Store backup remain incomplete, so the production preservation gate is still closed.

## Original audit baseline


Current rollback is trivial: no production service has changed. Existing Lovable sites, DNS and payment settings remain the production source of truth. Migration branches preserve source heads without rewriting history.

For local code, revert logical migration commits on the migration branch or restore an isolated checkout at the pinned baseline; do not force-push or reset unrelated user work. Existing older local Store modifications have not been edited. Do not drop local customer data as a schema rollback mechanism. Keep SQL migration checksums and schema-version evidence.

Before approved deployment, obtain encrypted production database/storage/config exports, source release hashes, old DNS records/TTL, webhook routing and a verified disposable restore. A GitHub source branch alone is not a database backup. Record secret locations/key versions without their values.

Cutover rollback triggers include failed paid authorization, missed/duplicate fulfillment, unreconciled transactions, data corruption, private data exposure, broken Academy/certificates/Store, and unrecoverable runtime failure. Pause new writes/checkouts or queue events according to the approved incident plan. Snapshot the new system first. Reconcile captured payments and all writes since cutover into the rollback destination; never restore an older snapshot over newer successful payments blindly. Reverse DNS/deployment/payment routing only with explicit approval and retain event replay/audit records. Keep identity/legacy-ID mapping so re-created accounts retain entitlements.

Storage rollback must restore object manifests/checksums together with referencing database rows. Avoid changing certificate signing keys without versioned verification compatibility. Rehearse the plan on staging and record recovery time and data-loss bounds before production cutover.
