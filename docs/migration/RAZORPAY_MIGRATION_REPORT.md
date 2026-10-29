# Razorpay migration report

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

Implemented main access.server.ts and payments.server.ts store server-created order ownership/prices before returning Checkout data, verify HMAC and authenticated provider snapshots, reconcile current refund state atomically and isolate test/live environments. Local live payments require production mode plus an explicit enable flag and have not been enabled. New independent endpoints cover checkout, confirmation, recovery and raw-body webhook processing. The old frontend/server-function/webhook paths still need switching after auth replacement. Failed attempts grant nothing but detailed failed-attempt history still needs implementation. No real Razorpay Test Mode payment or webhook delivery has been performed. Official references: https://razorpay.com/docs/webhooks/validate-test/ and https://github.com/razorpay/markdown-docs .

## Original audit baseline


Status: original implementation audited; MariaDB fulfillment NOT implemented; no live transactions or configuration changed.

Existing src/lib/razorpay.server.ts validates configured test/live key prefixes, verifies checkout HMAC, retrieves payment and order from Razorpay, requires captured status, compares ownership/amount/currency/plan, then calls apply_access_purchase. Preserve these protections. Plans currently offer 30/180/365 days in INR and USD; use src/lib/plans.ts as the price source rather than copying values into client-trusted inputs.

src/lib/razorpay.functions.ts gates checkout/confirmation using Supabase middleware and reads access passes through user-scoped queries. Replace these with independent sessions and authorized repository APIs. Retain starts_at<=now<expires_at plus active status and environment checks; a future expiry alone does not authorize access.

The existing public webhook verifies the raw body but only fulfills payment.captured. Implement a bounded raw-byte reader, strict signature validation and separate test/live secrets, durable unique event IDs, durable order ownership and immutable amount/currency snapshots, transactionally idempotent fulfillment, refunds/failures/disputes according to explicit rules and retryable error handling. A transient database error should not be treated as a permanently malformed event. Never trust the browser success callback to activate access.

Add local fake-transport contract tests plus actual Razorpay Test Mode end-to-end evidence: good/bad signatures, wrong account/order/amount/currency/mode, uncaptured payments, callback/webhook races, duplicate concurrent deliveries, reordered events, lost checkout redirect, retry after DB failure, partial/full refunds, cancelled checkout, stackable purchases and expiry. Do not initiate provider-side refund or change live webhooks without approval. Preserve historical transactions through a legacy mapping/import ledger rather than fabricated purchases.

Official references: [checkout signature verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/). Test credentials must be entered privately into the approved local secret store; none were requested in chat or committed.
