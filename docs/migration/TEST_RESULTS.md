# Test results

Baseline source: OVU ba30dc9035a229eb475c5d36ec7ef1b6bf2db263, Store b73f3b0f666e0f97d523f59c3b122de5a4547227. Date 2026-10-29.

| Check | Result | Limits |
|---|---|---|
| Saved DBeaver MariaDB login | PASS | 11.8.9-MariaDB, port 3307, root@localhost observed in query |
| Local DB creation | PASS | Both schemas displayed as utf8mb4; configured collation utf8mb4_unicode_ci |
| OVU GitHub tracked source hashes | PASS | All non-env tracked files matched, normalized LF |
| Store snapshot restoration | PASS | All pinned non-env tracked files match GitHub hashes after LF normalization; earlier checkout's unrelated changes preserved |
| OVU npm run build | PASS (exit 0) | Original provider config; Cloudflare output. Not independent Node proof |
| OVU npm run test:auth | PASS (exit 0) | Navigation/storage/redirect checks; not real independent auth |
| OVU npm run test:all | PASS (exit 0) | Existing suite; AI/TTS fallback and placeholder persistence are not service/database proof |
| Terminal MariaDB app connections | BLOCKED | Windows socket 10013 in restricted tool session, for both local app credential tests |
| Direct remote Git operations | BLOCKED | Restricted runtime DNS/thread and MSYS access errors; GitHub connector still works |
| Restricted account creation/grants | UNVERIFIED | Provisioning attempted through DBeaver; do not claim effective grants or credential validity |
| Store build/test | NOT RUN | Independent dependency installation/lockfile baseline remains pending |
| Independent MariaDB integration/concurrency | NOT RUN | No schema migration implemented, terminal access blocked |
| Browser SSR/mobile/3D parity | NOT RUN | Original build alone is insufficient |
| Razorpay Test Mode | NOT RUN | No test credentials configured, no payment performed |
| Production export/import/backup restore | NOT RUN | Production access/approval and verified export required |
| Hostinger staging runtime | NOT RUN | No plan purchased; compatibility report preliminary |

Raw baseline logs are kept locally in work/evidence, outside GitHub documentation. No production tests, transactions or service changes were performed. Cached dependencies were copied from an existing local installation; a fresh reproducible install against lockfiles must also pass before release.
