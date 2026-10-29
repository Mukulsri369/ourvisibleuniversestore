# Rollback plan

Current rollback is trivial: no production service has changed. Existing Lovable sites, DNS and payment settings remain the production source of truth. Migration branches preserve source heads without rewriting history.

For local code, revert logical migration commits on the migration branch or restore an isolated checkout at the pinned baseline; do not force-push or reset unrelated user work. Existing older local Store modifications have not been edited. Do not drop local customer data as a schema rollback mechanism. Keep SQL migration checksums and schema-version evidence.

Before approved deployment, obtain encrypted production database/storage/config exports, source release hashes, old DNS records/TTL, webhook routing and a verified disposable restore. A GitHub source branch alone is not a database backup. Record secret locations/key versions without their values.

Cutover rollback triggers include failed paid authorization, missed/duplicate fulfillment, unreconciled transactions, data corruption, private data exposure, broken Academy/certificates/Store, and unrecoverable runtime failure. Pause new writes/checkouts or queue events according to the approved incident plan. Snapshot the new system first. Reconcile captured payments and all writes since cutover into the rollback destination; never restore an older snapshot over newer successful payments blindly. Reverse DNS/deployment/payment routing only with explicit approval and retain event replay/audit records. Keep identity/legacy-ID mapping so re-created accounts retain entitlements.

Storage rollback must restore object manifests/checksums together with referencing database rows. Avoid changing certificate signing keys without versioned verification compatibility. Rehearse the plan on staging and record recovery time and data-loss bounds before production cutover.
