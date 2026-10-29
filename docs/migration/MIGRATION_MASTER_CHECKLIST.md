# OVU migration master checklist

Updated 2026-10-29. Status: IN PROGRESS, blocked at terminal network/database access. This is not a completion declaration.

## Verified

- DBeaver saved connection authenticates to MariaDB 11.8.9 at 127.0.0.1:3307 as root@localhost.
- Created ovu_main and ovu_store with utf8mb4 / utf8mb4_unicode_ci. DBeaver information_schema query displayed both rows. SHOW DATABASES was executed as part of follow-up verification.
- GitHub access verified for both public repositories. Isolated migration/mariadb-hostinger branches created from pinned default-branch heads.
- Main tracked source checked against GitHub blob hashes, with no differences after LF normalization.
- Store baseline reconstructed from its pinned GitHub tree; all non-env tracked hashes match. Earlier unrelated local work remains in its original directory.
- Full file inventory and dependency candidate scan produced for both applications.
- OVU original build, auth-navigation validation and test:all baseline passed using copied existing dependencies. Original build emits Cloudflare output, not independent Node output.
- Four local credential sets generated and protected using Windows DPAPI and a current-user-only directory outside both source repositories.

## Incomplete

- Account provisioning was attempted in the existing DBeaver session; account creation, grants and credential login are NOT yet verified.
- Application schema conversion, auth replacement, durable fulfillment, Store persistence and independent storage are not implemented.
- No production customer data or objects exported/imported. Deployed production commit IDs have not been independently verified.
- Store dependency installation/build/tests are pending; do not infer success from the OVU baseline.
- Independent Node runtime, end-to-end workflows, browser visual parity and mobile/3D tests remain pending.
- Hostinger report is preliminary; no annual checkout quote or measured runtime suitability yet.

## Next executable sequence

1. Restore terminal network access, then verify provisioned local users or complete provisioning through the saved root connection. Confirm DML-only app grants and schema-only migrator grants with positive and negative tests.
2. Obtain clean Store dependencies and lockfile; complete original Store baseline. Preserve pinned source artifacts.
3. Add independent Node build in isolation while retaining TanStack Start, official plugins and the SSR error wrapper. Test built entry with host-assigned PORT.
4. Implement versioned MariaDB schema/authorization and real transactional concurrency tests, then independent auth/storage/APIs.
5. Replace fulfillment only after replay, duplicate, refund and expiry tests pass. Use Razorpay Test Mode exclusively.
6. Run all original validations plus real local business workflows and visual/mobile/3D regression checks.
7. Resolve Hostinger engine/version/storage/runtime limits and annual/renewal costs. STOP for purchase approval.
8. Deployment, data import, DNS cutover and Lovable cancellation each remain gated by explicit approval.
