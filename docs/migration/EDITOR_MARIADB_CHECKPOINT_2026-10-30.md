# Editor MariaDB checkpoint — 30 October 2026

## Independent persistence

The default browser adapter now calls narrow independent server functions instead of Supabase. The old import path is a compatibility re-export; the unchanged in-memory transaction simulator has moved to a separate test implementation. The server provides private page/draft reads, atomic draft saves, archive, version metadata, authorized publication, immutable version creation, rollback as a new version, optional draft synchronization and publication audit events.

Every private operation checks the actual cookie session and fresh database role. Every write checks the role again inside its transaction. State-changing server functions enforce the configured origin. Server-side validation recomputes document schema/checksums instead of trusting browser metadata; publishing also enforces the existing visible-content eligibility rules. Page locks serialize competing writes and revision checks prevent stale saves/publishes. Public reads expose only a published snapshot and exclude draft/actor/release-note columns. No production data was changed.

Real MariaDB tests cover draft isolation, non-admin denial, stale saves, simultaneous competing publishes, version history, rollback, wrong-page version rejection, invalid document rollback and role revocation. Built Node HTTP tests additionally exercise cookie authentication, actual TanStack serialization, origin denial, draft/save/publish, structured conflicts and process restart persistence.

Browser verification used a disposable admin and an initially absent local homepage record. Renaming a layer and clicking Save Draft produced revision 1. Reloading restored the saved name and revision. Evidence: `outputs/STORE_EDITOR_MARIADB_DRAFT.jpg` outside Git. The fixture account, draft, category and preview server were cleaned up. This does not establish a complete browser publishing/version-management workflow: publishing controls still need to be connected to the admin UI.

## Test repairs, without hiding the failures

Existing test scenario names and behavioral requirements remain. No suite was skipped, no scenario was deleted and no timing threshold was increased. These are explicit contract repairs:

- History tests now use the actual transaction/interaction APIs, canonical node IDs, array roots, `style`/`responsive` and valid generic text/section fixtures. Structural commands use their actual field names. Wrap/unwrap/delete tests use a generic editable text node rather than a nonexistent canonical node.
- Autosave and save-race suites now invoke the production `AutosaveCoordinator` and revision reconciliation functions. Their former helper factories did not exist. The same nine scenarios exercise debounce/max-wait, undo, manual-save deduplication, newer edits during an in-flight save, monotonic revisions, stale responses, conflict stops and bounded retries. Returned documents and submitted revisions are asserted using the real executor contract; generation assertions inspect the coordinator's actual tracking state.
- Recovery tests use scoped checkpoints and the actual `none` result with its `identical_to_server` reason. Expired/corrupt checkpoints must be removed; token-bearing content must be rejected. Clock-controlled fixtures prevent historical test dates from becoming accidentally expired.
- SQL DTO/category/settings/geometry fixtures match actual persisted/public types. No original product records or settings were reconstructed from these synthetic fixtures.
- The route source assertion now requires independent authentication instead of requiring the removed Supabase call. Real HTTP tests additionally deny non-admins and revoked roles.
- Compact card width expectations were stale: Git blob `96e4716:src/components/store/ProductCard.tsx` already contains the 1.75-card mobile formula and 180/205/220/238px responsive rules. Assertions now verify those pinned values. ProductCard styling itself was not changed.
- Chrome counts now target explicit `data-store-chrome` markers on the existing navigation header/footer. A legitimate featured-section HTML header is not a second global navigation. The exact zero/one chrome assertions remain.

The tests uncovered real implementation issues: recovery-dialog callback names, bearer-prefixed JWT recovery acceptance, unscoped admin recovery keys, repeated full history validation, the clean-saved draft button state, and a missing FeaturedCollectionIntro in the editor renderer. These were repaired. History validation caches compare complete serialized snapshots, revalidate changed roots and retain whole-document structural limits; mutation and cross-root duplicate-ID negative tests were added. The initial load is explicitly validated before the existing edit/undo/redo timing measurements, matching the application lifecycle.

Editor context defaults and selection/hover callbacks now keep stable identities across style edits, using the existing current-document reference. This prevents unrelated memoized nodes from rerendering merely because empty objects/forwarding callbacks were recreated. No test timeout was increased. Public design snapshots also redact optional author email metadata after validating the stored version, while preserving private historical records and recomputing the public projection checksum.

## Verification limits

TypeScript and the Node build pass. Targeted history/recovery tests pass (16), autosave tests pass (5), save-race tests pass (4), history UI tests pass (2), and homepage parity/structural-history/baseline tests pass (13). Final complete suite: **239 passed, 0 failed, 0 skipped**, with all 52 files passing. Combined backend/auth/media/product/retailer/page checks: **11 passed**. The latest built Node/page regression rerun passed **2 tests**, and schema replay/invariants passed **2 tests**. No Razorpay provider call was made.

The Store is not yet fully independent: public home/search/category/festival/related queries and remaining admin management/import/price paths still need provider replacement. Publishing/version-management UI, email delivery, exhaustive mobile/security workflows, Academy offline synchronization and final Hostinger approval evidence remain outstanding. Actual Razorpay provider testing remains deferred and unverified.

The recursive Zod node schema is now constructed once rather than once per visited node. All validation rules and performance budgets remain unchanged. Persistence cache entries compare exact serialized content before hash reuse; only detached, deeply frozen validated results receive reference-cache hits, and hash-cache size is bounded. A negative test rejects mutable caller changes and proves normalized snapshots cannot be modified.
