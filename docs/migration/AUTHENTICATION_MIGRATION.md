# Independent authentication

## Verified foundation checkpoint — 2026-10-29

This checkpoint supersedes the access-blocked baseline notes below. The migration is IN PROGRESS. Source release hashes are pinned; the actual deployed production commits remain unverified.

- Full local terminal, GitHub clone/fetch and MariaDB connections now work. Both app users authenticate to MariaDB 11.8.9 on port 3307 and have SELECT/INSERT/UPDATE/DELETE only on their exact escaped database grants. Cross-app/system access and runtime DDL are denied. Separate migrator accounts have applied the schemas. MySQL port 3306 is unchanged.
- Credentials remain Windows-DPAPI encrypted in a user-only directory outside both repositories. No customer records or credentials are committed.
- Reviewed MariaDB migrations and checksum/step ledgers are implemented. UTC is initialized on every physical connection. Application authorization must replace PostgreSQL RLS at each endpoint; schema creation alone does not provide that replacement.
- Better Auth 1.7.14 and mysql2 provide the independent authentication foundation. Main database tests verify registration, verification, login/logout, reset-token reuse denial, session revocation, role checks and CSRF. SMTP/OAuth delivery is not configured or externally verified.
- The main payment-access ledger passes real MariaDB concurrency, replay, ownership, amount/currency, expiry, audit and refund tests. Synthetic provider tests validate raw-body webhook HMAC, callback HMAC, order ownership, interrupted-checkout recovery and refund-first delivery. These are NOT Razorpay Test Mode transactions. Existing frontend/provider integrations still require replacement.
- Production records, domains, payment configurations and deployments remain unchanged. An authorized read-only OVU database export was created in Lovable storage. The browser download approval gate rejected automation; the user downloaded it manually. Its PostgreSQL archive header and SHA-256 were checked, and a DPAPI-encrypted copy round-tripped successfully outside Git. The official pg_restore 17.11 client parsed the archive and extracted all schema/data sections privately without executing SQL. FK/reference and table counts were inspected; a full disposable restore/import rehearsal remains pending. The export has only public.access_passes and no Academy application tables. Historical amounts/currencies are absent; do not invent them from current plan prices. Store project Cosmic Cart is paused for exhausted workspace credits; its database export is blocked. No top-up or reactivation was performed.
- Lovable/Supabase packages and runtime calls remain. Neither app meets completion criteria. No hosting purchase is recommended at this checkpoint.

Implemented files: src/backend/auth.server.ts, authorization.server.ts, email.server.ts, runtime.server.ts and main http.server.ts. The Node server mounts /api/auth/* and /api/backend/* only with OVU_BACKEND=mariadb; original production settings are untouched. SMTP requires TLS with certificate checks and no token/console fallback. The existing Supabase UI, MCP OAuth and many server functions are not migrated yet. Cookie-session backend APIs require verified users; admin mutations additionally require explicit roles, same-origin JSON, bounded bodies and audit IDs. Actual SMTP delivery, Google OAuth and browser form integration remain pending.

## Original audit baseline


Status: design decision prepared; not implemented or verified.

Use an established library with TanStack Start integration and a MySQL-compatible adapter, with MariaDB compatibility proven locally before adopting its generated tables. Better Auth is the initial candidate: official documentation covers MySQL and TanStack cookies ([installation](https://better-auth.com/docs/installation), [TanStack integration source](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/tanstack.mdx)). Pin an audited release and verify its actual schema on MariaDB 11.8.9; documentation is not a compatibility test.

Preserve registration, login/logout, email verification, reset flows and Google OAuth if configured in the original service. Existing Supabase sessions will not remain valid: explicitly plan reauthentication and link recreated identities to immutable legacy user IDs. Do not copy or invent password hashing. Existing password hash portability needs an approved export and library support; otherwise use secure invite/reset flows for the small customer group.

Use opaque server-backed sessions, HttpOnly cookies, Secure in production, appropriate SameSite, rotation, revocation and expiry. Password reset/verification tokens must be single-use, time-limited and stored as verifier hashes. Never log tokens. Configure email delivery and OAuth client secrets privately; external callbacks/production settings require approval. Validate return destinations and prevent account-linking by unverified email.

Keep TanStack server-function CSRF protection, add origin/CSRF controls to mutations outside server functions, and verify permissions on every API. Ignore user-editable metadata for admin privileges. Maintain explicit per-app roles; no implicit shared-cookie access between .in and .store domains. Decide cross-domain SSO only if required by current behavior.

Migrate paid-route protection, subscription admin, Academy profile/progress/certificate APIs, Store admin/scraping/media/editor APIs and MCP OAuth. MCP must retain signed-in user scoping and protected-resource metadata. Public certificate lookup returns a minimal safe projection, not private student records. Admin grant/revoke/expiry/role changes require immutable actor/target/reason/request-ID audit records.

Required tests: anonymous denial, cross-user denial, forged metadata denial, admin role changes, session fixation/replay/revocation, reset enumeration resistance, invalid/expired/reused reset tokens, OAuth state/PKCE, email verification, safe redirects, CSRF, expiry boundaries and persistence across restart. Real email/OAuth provider tests remain blocked until private configuration is available.
