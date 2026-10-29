# Independent authentication

Status: design decision prepared; not implemented or verified.

Use an established library with TanStack Start integration and a MySQL-compatible adapter, with MariaDB compatibility proven locally before adopting its generated tables. Better Auth is the initial candidate: official documentation covers MySQL and TanStack cookies ([installation](https://better-auth.com/docs/installation), [TanStack integration source](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/tanstack.mdx)). Pin an audited release and verify its actual schema on MariaDB 11.8.9; documentation is not a compatibility test.

Preserve registration, login/logout, email verification, reset flows and Google OAuth if configured in the original service. Existing Supabase sessions will not remain valid: explicitly plan reauthentication and link recreated identities to immutable legacy user IDs. Do not copy or invent password hashing. Existing password hash portability needs an approved export and library support; otherwise use secure invite/reset flows for the small customer group.

Use opaque server-backed sessions, HttpOnly cookies, Secure in production, appropriate SameSite, rotation, revocation and expiry. Password reset/verification tokens must be single-use, time-limited and stored as verifier hashes. Never log tokens. Configure email delivery and OAuth client secrets privately; external callbacks/production settings require approval. Validate return destinations and prevent account-linking by unverified email.

Keep TanStack server-function CSRF protection, add origin/CSRF controls to mutations outside server functions, and verify permissions on every API. Ignore user-editable metadata for admin privileges. Maintain explicit per-app roles; no implicit shared-cookie access between .in and .store domains. Decide cross-domain SSO only if required by current behavior.

Migrate paid-route protection, subscription admin, Academy profile/progress/certificate APIs, Store admin/scraping/media/editor APIs and MCP OAuth. MCP must retain signed-in user scoping and protected-resource metadata. Public certificate lookup returns a minimal safe projection, not private student records. Admin grant/revoke/expiry/role changes require immutable actor/target/reason/request-ID audit records.

Required tests: anonymous denial, cross-user denial, forged metadata denial, admin role changes, session fixation/replay/revocation, reset enumeration resistance, invalid/expired/reused reset tokens, OAuth state/PKCE, email verification, safe redirects, CSRF, expiry boundaries and persistence across restart. Real email/OAuth provider tests remain blocked until private configuration is available.
