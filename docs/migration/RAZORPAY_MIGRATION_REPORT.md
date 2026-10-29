# Razorpay migration report

Status: original implementation audited; MariaDB fulfillment NOT implemented; no live transactions or configuration changed.

Existing src/lib/razorpay.server.ts validates configured test/live key prefixes, verifies checkout HMAC, retrieves payment and order from Razorpay, requires captured status, compares ownership/amount/currency/plan, then calls apply_access_purchase. Preserve these protections. Plans currently offer 30/180/365 days in INR and USD; use src/lib/plans.ts as the price source rather than copying values into client-trusted inputs.

src/lib/razorpay.functions.ts gates checkout/confirmation using Supabase middleware and reads access passes through user-scoped queries. Replace these with independent sessions and authorized repository APIs. Retain starts_at<=now<expires_at plus active status and environment checks; a future expiry alone does not authorize access.

The existing public webhook verifies the raw body but only fulfills payment.captured. Implement a bounded raw-byte reader, strict signature validation and separate test/live secrets, durable unique event IDs, durable order ownership and immutable amount/currency snapshots, transactionally idempotent fulfillment, refunds/failures/disputes according to explicit rules and retryable error handling. A transient database error should not be treated as a permanently malformed event. Never trust the browser success callback to activate access.

Add local fake-transport contract tests plus actual Razorpay Test Mode end-to-end evidence: good/bad signatures, wrong account/order/amount/currency/mode, uncaptured payments, callback/webhook races, duplicate concurrent deliveries, reordered events, lost checkout redirect, retry after DB failure, partial/full refunds, cancelled checkout, stackable purchases and expiry. Do not initiate provider-side refund or change live webhooks without approval. Preserve historical transactions through a legacy mapping/import ledger rather than fabricated purchases.

Official references: [checkout signature verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/). Test credentials must be entered privately into the approved local secret store; none were requested in chat or committed.
