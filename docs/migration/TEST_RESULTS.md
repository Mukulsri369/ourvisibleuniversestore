# Test results

Updated 2026-10-29. Results below are local development evidence, not production migration proof.

| Check | Result | Limit |
|---|---|---|
| MariaDB 11.8.9, port 3307, both databases | PASS | Local only |
| Both runtime users, DML-only exact schema grants | PASS | Cross-app/system/DDL negative checks passed |
| Reviewed migration replay/checksum/Unicode/JSON/FK/UTC/rollback | PASS, 4 tests | Main; no production import |
| Better Auth lifecycle, reset, revocation, CSRF, HTTPS and roles | PASS, 3 tests | In-memory test mail transport; no SMTP/Google provider test |
| Durable entitlement/payment/admin/expiry transactions | PASS, 8 tests | Includes 20 concurrent retries and refund-first delivery |
| Razorpay provider boundary/HMAC/recovery | PASS, 4 tests | Synthetic provider; no external payment request |
| Independent authenticated HTTP API | PASS, 1 workflow | Real MariaDB and Better Auth handler; built Node auth/session/anonymous denial HTTP smoke also passes |
| OVU official Node build | PASS | Provider runtime calls still exist |
| OVU realtime voice validation | PASS, 61 checks | Server-only fallback import boundary repaired |
| OVU original build/test:all | PASS at baseline | Existing suite is not independent service proof |
| Store original provider build | PASS | Official independent Node build also passes |
| Store retailer URL/DNS/address/limit validation | PASS, 4 tests | Not yet wired into all scraper paths |
| Store original suite after dependency/import repair | FAIL | 195 passed / 40 failed; 13 failing files / 52. No skipped/deleted assertions |
| Store typecheck | FAIL | Existing editor/public types and legacy tests disagree; new fetch Response body typing fixed afterward |
| Downloaded OVU export integrity/encryption | PASS | Archive header/hash/DPAPI round-trip, pg_restore extraction and reference/count inspection; full restore rehearsal pending |
| Store production export | BLOCKED | Lovable workspace paused/out of credits; no billing action |
| Real Razorpay Test Mode, SMTP, Google OAuth | NOT RUN | Private test configuration required |
| Full UI, mobile, 3D, Academy, Store workflows | NOT COMPLETE | No claim of parity or runtime independence |
| Production data import, deployment, cutover | NOT RUN | Explicit approval gates remain |

Raw logs remain in work/evidence outside source commits. No real payment or production write was performed. Both package lockfiles are retained for reproducible installs. Earlier npm audit reported 8 OVU dependency vulnerabilities including existing Lovable MCP dependencies; removals/upgrades require tested replacements, not force-fix.

Additional Store checks: independent authentication lifecycle/HTTPS tests PASS (3); real Store schema replay/Unicode/UTC/category/editor invariants PASS (2). OVU latest combined independent backend suite: 16 passing tests with no skips.

Migration portability: .gitattributes preserves the exact applied SQL bytes on Windows/Linux. Staged SQL blobs were compared byte-for-byte to the applied local files; checksums must never depend on Git line-ending conversion. No completed SQL statement or database ledger was rewritten.
