## Verified local checkpoint — 30 October 2026

This section supersedes the historical 29 October notes below. Production, real customers, payments, deployments and DNS remain unchanged. The Store backup exception is already authorized; missing original data does not block reversible local development.

- Store product UI checkpoint `2522c0a` is pushed on the migration branch. Independent sign-in, product creation/editing, images, list and public detail were exercised in the browser.
- Editor drafts, page versions, authorized publishing/rollback and audit events now use independent MariaDB server functions. Browser draft save/reload works. Publishing/version-management controls are the next UI integration task.
- Full Store suite: **239 passed, 0 failed, 0 skipped**. TypeScript and independent Node build pass. Combined backend suite: 11 passed; latest built-app/page-service regression: 2 passed; schema invariants: 2 passed. See EDITOR_MARIADB_CHECKPOINT_2026-10-30.md and raw evidence outside Git.
- Remaining: public catalogue and remaining admin CRUD/import/price routes; publishing/history UI; complete Store business/mobile/security workflows; Academy offline/provider replacement. The new catalogue service has a real MariaDB test but is not yet connected to the public screens.
- Razorpay provider testing remains deferred and unverified. No customer import or access restoration has occurred.
- Hostinger annual Unlimited quote: ₹4,233.84 including current tax; eligibility is conditional. See HOSTINGER_VERIFIED_FACTS_2026-10-30.md. No purchase recommendation or authorization is implied.

### Historical foundation notes

## Store backup exception authorized — 30 October 2026

The user explicitly authorized local Store development and MariaDB migration without a verified Lovable Store backup. The GitHub repository is the source of truth for code. Missing data must be documented and never invented. This removes the backup prerequisite for reversible local development and testing only; it does not authorize production deletion, deployment, purchases, DNS/payment changes, customer access modifications or Lovable cancellation.

No Store database or object-storage export is available. Original product records, categories, customized settings, product images not committed to the repository, click history and visual-editor drafts/published versions cannot currently be verified or restored. Source code and checked-in assets are recoverable from GitHub. Local tests use named synthetic fixtures and clean them up; they are not original records. Empty schema creation is not production data recovery.

A new internal MariaDB product service validates administrator roles, strict fields, HTTPS affiliate URLs, exact category references, atomic ordered category updates, revision conflicts and duplicate affiliate URLs on publication. It records administrative audits and filters public reads to active/non-deleted products. Migration 0003 adds revision tracking. The service is not connected to Store UI/API routes yet.

Verification: 8 backend/authentication/retailer/product tests pass with no skips; 2 real Store schema/replay/Unicode/JSON/FK/UTC tests pass; official Node build passes. The original 40 editor test failures and source type mismatches remain unresolved and were not skipped or removed. Pending: wire product APIs/admin/catalog, complete editor persistence/storage/imports and repair original tests, then browser/mobile/integration QA. Academy offline/provider replacement and Hostinger compatibility remain open. Actual Razorpay provider testing remains deferred and unverified.

# OVU migration master checklist

Updated 2026-10-29. Status: IN PROGRESS. Production cutover is not authorized.

## Completed and verified

- Both repositories are on isolated migration/mariadb-hostinger branches with original source and audit history preserved.
- Both local databases, four restricted account logins, effective privilege boundaries and UTF-8 configuration are verified.
- Main: Better Auth schema, 23 source application tables, payment ledger/locking/audit/identity-map tables applied through repeatable migrations. Store: auth schema, 11 original tables and added relationship/invariant tables applied.
- Main MariaDB tests: schema replay/checksum drift, Unicode/JSON/FKs, UTC pool initialization and transaction rollback (4 tests); authentication/reset/session/role/HTTPS checks (3); access/concurrency/refunds/admin/expiry (8); synthetic Razorpay provider/HMAC/recovery (4); cookie-authenticated HTTP authorization/audit (1).
- Main independent Node build passes. Built Node HTTP smoke passes homepage/science/learn/auth/catalog, /api/auth/get-session (200) and anonymous /api/backend/access denial (401). Existing realtime voice boundary validation passes all 61 checks. Main TypeScript passed with the payment endpoints.
- Store original provider and official Node builds pass. New outbound-retailer validation tests pass (4). Its original test suite remains failing: latest run 195 passed, 40 failed, 13 failing files out of 52. Missing peer dependency/import paths were repaired without removing assertions. Store typecheck also exposes existing source/test API mismatches; no release approval.
- Main downloaded backup has a valid PostgreSQL archive header, 356090 bytes, SHA-256 57ACA90478F0D22FD425A2D34213782EE710015682A929DA226FA031EAB68CA9. Encrypted copy and pg_restore schema/data extraction verified. No orphaned entitlement identities or duplicate payment references found. No customer import performed.

## Current work and blockers

1. Inspect the main export safely and reconcile deployed schema drift. Store data/storage export is blocked by the paused Lovable workspace; preserve current services and await an available backup or user-approved source access.
2. Finish backend/API replacements and connect existing UI to independent cookie authentication, payment/access APIs, Academy/certificates/catalog and Store persistence/storage. Provider runtime calls still exist.
3. Finish failed-attempt payment history, owner-controlled roles/invites, admin UI and reconciliation tools; do not grant real customer access without authorized identities/periods.
4. Repair original Store API/fixture/typecheck failures; retain all assertions and test budgets. Run complete local business/visual/mobile/3D workflows.
5. Configure test-only Razorpay, SMTP and Google OAuth privately when required. No real provider end-to-end workflow has passed yet.
6. Complete Hostinger measured compatibility and actual annual/renewal quote. Stop before any purchase, deployment, DNS/payment changes or Lovable cancellation for explicit approval.

Additional Store verification: independent authentication lifecycle/HTTPS tests pass (3); real Store schema replay/Unicode/UTC/category FK/editor JSON/same-page publication tests pass (2). These do not resolve the original editor suite/typecheck failures.

Migration portability: .gitattributes preserves the exact applied SQL bytes on Windows/Linux. Staged SQL blobs were compared byte-for-byte to the applied local files; checksums must never depend on Git line-ending conversion. No completed SQL statement or database ledger was rewritten.
