# Store publishing checkpoint — 31 October 2026

The existing Studio now exposes **Publish & history** using its independent MariaDB service. Administrators can publish a saved draft, inspect paginated version history, and restore an older design as a new version. Expected draft and published revisions, cookie authentication, fresh database roles, origin checks, document validation and audit events remain enforced by the server. Unsaved edits block publishing. Restoration explicitly preserves both the saved draft and current working edits.

The actual browser test revealed that the public homepage was still rendering the canonical document even after a successful backend publication. The public route now loads the narrow published-snapshot query and passes its document to the existing renderer. Missing, invalid or unavailable snapshots retain the existing canonical fallback. A built-application regression checks actual public HTML before and after a process restart.

Saving now adopts the server-normalized snapshot only when no newer edit arrived during the request. This prevents reconnect events from reporting normalization defaults as unsaved changes. Newer edits are preserved. Browsers without a WebGL API enter the existing Earth fallback before downloading the graphics implementation; the supported-browser renderer and scientific/visual parameters are unchanged.

## Actual local evidence

- TypeScript: passed for the publishing UI, route and integration regression.
- Node build: passed, including public route integration, normalized save handling and the unsupported-WebGL guard.
- Real MariaDB / built Node checks: **2 passed**, including public rendered HTML, session/origin/role checks, revisions, transactions and restart persistence.
- Focused editor/publishing tests: **6 passed**, including saved publication, unsaved-edit denial, revoked-admin denial, version restoration, preserved draft and reconnect status. Existing timing limits remain unchanged.
- Complete final Store suite: **243 passed, 0 failed, 0 skipped across 53 files**. An earlier concurrent diagnostic had 223 passes and 16 UI timeouts and was not counted as a release pass. After the unsupported-WebGL capability guard and with browser/build work stopped, the focused six checks and complete serial suite passed under the original timing limits. No scenario was removed or skipped and no time limit was increased.
- Actual built-browser workflow: saved/published baseline version 1; hid “Why shop with us”; saved draft revision 2; published version 2; public homepage no longer contained that heading; restored version 1 through confirmation, creating version 3; public heading returned; editor reload retained draft revision 2 with the section still hidden.
- Responsive check: the publishing/history dialog was exercised at an actual 390-pixel viewport, including scrollable history and usable controls. Proof is outside Git in `outputs/STORE_PUBLISHING_MOBILE_VERIFIED.jpg`.
- Disposable local account, category, page, draft, versions and events were cleaned; preview server stopped. No existing customer or production record was involved.

## Remaining work

Public catalogue/search/festival/category/related queries and click logging still require a verified independent UI path. Remaining admin category/settings/bulk/trash/import/price workflows and email delivery also remain. The new catalogue transport is work in progress and must not be described as verified by the publishing checks. Main Academy offline/provider replacement, broader browser/science/security testing and unresolved hosting compatibility checks remain outstanding. Razorpay provider checkout/webhook testing remains deferred and explicitly unverified. No deployment or purchase is recommended from this checkpoint.
