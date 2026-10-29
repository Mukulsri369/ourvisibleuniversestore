# Deployment runbook — not executable until approval gates pass

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
