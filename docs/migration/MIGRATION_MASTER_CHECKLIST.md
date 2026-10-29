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
