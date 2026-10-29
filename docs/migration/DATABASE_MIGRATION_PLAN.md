# MariaDB migration plan

Status: schema conversion NOT executed. Local databases exist; they contain no approved production import.

## Schema sources and mapping

Use DATABASE_OBJECT_INVENTORY.json together with every PostgreSQL migration. drizzle/schema.ts is intentionally empty. Include runtime-referenced Academy profile/certificate/completion tables even where generated Supabase types and migrations disagree; reconcile a read-only approved production schema export before import.

| PostgreSQL feature | MariaDB replacement and required verification |
|---|---|
| UUID and auth.users FK | Preserve UUID text IDs using CHAR(36) with binary/ASCII equality, or proven consistent binary UUID encoding; map to independent identity IDs without losing legacy linkage |
| timestamptz | DATETIME(6), UTC connection/session and application conversion; preserve original instants and access boundaries |
| jsonb | JSON with validation and explicit indexing strategy; verify JSON null, SQL NULL, booleans, numbers and ordering |
| text/uuid arrays | Ordered child tables where referential integrity matters; product category join table with position and legacy first-category compatibility |
| numeric/scientific data | Preserve exact precision/range, units and null semantics; use explicit DECIMAL or DOUBLE based on original fields; validate catalog sample tolerances |
| RLS/auth.uid/service_role | Server-owned sessions, ownership predicates, explicit roles, public projections and cross-user negative tests |
| PL/pgSQL RPC/SECURITY DEFINER | Parameterized server transactions with least-privilege connections; no raw privileged browser queries |
| advisory locks | InnoDB row lock on a durable user/environment entitlement aggregate; deterministic lock order and bounded deadlock retry |
| partial indexes/JSON operators | Explicit generated columns/normalized tables and tested equivalent unique constraints/filters |
| update/validation triggers | Preserve invariants transactionally; do not rely on frontend validation or case-insensitive collations for opaque affiliate URLs |
| NOTIFY PostgREST | Remove provider schema-cache notifications once server APIs own queries |

## Atomic purchase invariant

Preserve original 30/180/365-day behavior and sandbox/live separation. Verify Razorpay before any write. In one transaction lock the user's entitlement aggregate; check the unique (environment,payment_id) ledger again under lock; reject conflicting ownership/order/amount/currency; compute base=max(now, maximum eligible active expiry); insert payment/access records and commit exactly once. Concurrent different purchases extend access serially. Callback and webhook replay must return the same result without double extension. Rolled-back transactions must leave no active access. Define refund effects at the purchase level so unrelated grants/purchases survive.

## Store invariants

Migrate live/trashed/draft status behavior, effective affiliate-link duplicate prevention, category reference validation/order, slug uniqueness, public visibility, private settings, ordered image/video media and best-effort outbound logs. Preserve page-version immutability, draft revision compare-and-swap, publication audit and restore-as-new-version behavior from 0010_storefront_page_persistence.sql. Avoid a direct text replacement of PostgreSQL SQL.

## Migration runner

Create separate numbered MariaDB migrations with checksums and a schema_migrations ledger per database; take a migration lock, validate the current version and stop on drift. MariaDB DDL implicitly commits, so transactional wrapping alone cannot make DDL atomic: use explicit resumable steps and validated postconditions. Use migrator accounts only during upgrades; runtime app users receive DML only. Test empty install, repeat run, interrupted resume, rollback/restore and idempotent approved data import. No DROP-based rollback on production data.

## Data preservation gate

Privately export auth identity mappings, access passes, payment/order IDs, admin audit, student profiles/progress/completions, certificates/signing versions, Store tables and storage manifests. Keep encrypted dumps outside repositories and outputs. Verify row counts, monetary totals, identifiers, expiry instants, object checksums and FK integrity in a disposable restored copy. Export schema drift must be reconciled before writing an import. Accounts may be recreated for 4–6 users, but entitlements and historical records must remain traceable through legacy IDs. Manual grants require approved users and periods.
