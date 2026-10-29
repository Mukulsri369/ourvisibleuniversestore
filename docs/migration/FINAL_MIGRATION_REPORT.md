# Migration progress report — INCOMPLETE

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

This is a progress checkpoint, not a final completion report. Phase 1 is verified; source audit and branch protection are complete; schemas and main backend foundations are implemented and tested. UI/API replacement, Store test repair, full regression, external test-provider workflows, data reconciliation and final hosting compatibility remain open.

## Original audit baseline


This file is intentionally a progress record, not a completion certificate.

Completed: local MariaDB connection/database creation; pinned GitHub migration branches; isolated source preservation; file/dependency/schema-object inventories; focused auth/payment/storage/Store security review; original OVU build/auth/test:all baselines; preliminary independent architecture, data/rollback/deployment and Hostinger research.

Pending verification: four restricted local accounts and grants. Their credentials have been generated privately and encrypted outside the repositories; DBeaver provisioning was attempted but successful account creation was not confirmed. Terminal tests are blocked by socket permission error 10013.

Not completed: independent application/runtime/auth/MariaDB/storage implementations, production exports or customer imports, Store baseline/workflow validation, actual Razorpay Test Mode, full browser/visual/3D/mobile acceptance, exact annual Hostinger quote and real deployment compatibility. No customer accounts were manually granted access and no live payment was made.

Current blocker: restricted tool-session network/process access prevents direct Git downloads and terminal local MariaDB connections. User action requested: enable full access for this migration session. After access returns, verify the local accounts before further schema work, finish Store dependency baseline, and proceed through the checklist. External email/OAuth/Razorpay test setup and approved production export will require private user authentication when reached.

Production state: unchanged. Existing Lovable sites remain live. No hosting purchased, DNS changed, production databases modified, live payment settings changed or subscription cancelled.
