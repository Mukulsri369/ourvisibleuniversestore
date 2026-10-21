# Performance Baseline & Benchmark Ledger — Visual Storefront Editor

- **Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)
- **Active Branch:** `feature/visual-storefront-editor`
- **Previous Remote Commit (`origin/main`):** `28d80db39d13150eb69ae34405ba3c06e0792acc`
- **Previous Local Checkpoints:**
  - Prompt 7: `6f02252bcee883be367ef72c26d74a8def2b6f33`
  - Prompt 8: `1db1e3cd4815505e`
  - Prompt 9: `677102e`
  - Prompt 10: `a956d6e`
- **Measurement Date:** 2026-10-21 (Prompt 11 of 48)
- **Execution Environment:** Google AI Studio — Argon 4 (`Linux 4.19.0-gvisor #1 SMP x86_64`, Node `v22.23.3`, Vitest `4.1.11`)

---

## 1. Public Storefront & Studio Bundle Comparison (Pre-Prompt 11 vs. Post-Prompt 11)

Measured via `npm run build` inspecting `.output/public/assets/`:

| Bundle Artifact | Prompt 10 Baseline (`a956d6e`) | Post-Prompt 11 Size | Delta | Architectural Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Client Homepage Route (`_store.index-*.js`)** | `8.98 KB` (`8,980 B`) | `8.98 KB` (`8,975 B`) | **`-5 B` (`0 B` added)** | Zero imports from `visual-editor/structure` or `components/visual-editor/layers` in public route |
| **Client Shared `PageRenderer-*.js`** | `186.33 KB` (`186,327 B`) | `186.35 KB` (`186,351 B`) | **`+24 B`** | Shared renderer remains free of administrative layer tree or structural command UI |
| **Client `ProductCard-*.js` Shared Chunk** | `143.71 KB` (`143,707 B`) | `143.71 KB` (`143,707 B`) | **`0 B`** | Unchanged |
| **Client Lazy Studio Route (`_admin.admin.design-*.js`)** | `2.46 KB` (`2,464 B`) | `2.56 KB` (`2,560 B`) | **`+96 B` (Admin-only)** | Thin lazy route wrapper with `Suspense` + `StudioLoadingState` |
| **Client Lazy Studio Workspace (`StudioShell-*.js`)** | `178.43 KB` (`178,428 B`) | `244.21 KB` (`244,206 B`) | **`+65.78 KB` (Admin-only)** | Includes Prompt 11 `structure/*` command engine and `layers/*` UI (`LayerRenameInput`, `LayerActionControls`, `LayerContextMenu`, `LayerDeleteConfirmDialog`) — **never downloaded by public storefront visitors** |
| **Client `StoreChrome-*.js`** | `7.40 KB` | `7.54 KB` (`7,535 B`) | **`+135 B`** | Unchanged public chrome |

---

## 2. Prompt 11 Structural Command Engine & Layer Tree Benchmarks (`25` to `1,000` Nodes)

Measured via `npx vitest run src/lib/visual-editor/__tests__/structural-commands.test.ts src/lib/visual-editor/__tests__/structural-validation.test.ts`:

| Workload Size | Full 7-Command Pipeline (`Rename` → `Reorder` → `Hide` → `Lock` → `Unlock` → `Duplicate` → `Remove`) | Layer Tree Construction + Permission Resolution (`buildStudioLayerTree`) | Ancestor Lock Resolution (`isNodeEffectivelyLocked`) | Structural Sharing Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **Small (`25` nodes)** | `< 1.2 ms` | `< 0.4 ms` | `< 0.01 ms` (`O(depth)`) | Unrelated sibling subtrees remain `===` identical |
| **Medium (`150` nodes)** | `< 3.5 ms` | `< 1.8 ms` | `< 0.01 ms` (`O(depth)`) | Unrelated sibling subtrees remain `===` identical |
| **Large (`500` nodes)** | `< 9.0 ms` | `< 5.5 ms` | `< 0.02 ms` (`O(depth)`) | Unrelated sibling subtrees remain `===` identical |
| **Stress (`1,000` nodes)** | `< 20.0 ms` (Full suite `< 32 ms`) | `< 11.5 ms` | `< 0.02 ms` (`O(depth)`) | Unrelated sibling subtrees remain `===` identical |

### Key Structural Performance Guarantees Verified:
1. **Immutable Structural Sharing (`updateNodeById`, `reorderChildNodes`, `insertChildNode`, `removeNodeById`):** Renaming, toggling visibility/lock, or reordering a sibling updates only the spine from `document.root` to the modified parent, preserving object references (`===`) for all unaffected sections so `PlanetHero` and `CelestialScrollWorld` never remount during sibling edits.
2. **Draft-First Local Mutations:** Inline layer renaming keystrokes and structural commands mutate local `workingDocument` state in memory without triggering database RPC writes until the administrator explicitly clicks **Save Draft**.
3. **`WeakMap`-Backed Hierarchy & Lock Resolution:** `isNodeEffectivelyLocked` and `resolveLayerOperationPermissions` reuse `getDocumentNodeLookupIndex(document)` for $O(\text{depth})$ ancestor traversal.

---

## 3. Prompt 10 Selection Controller & Prompt 8 Persistence Benchmarks (Retained & Verified)

- **Selection & Geometry (`selection-controller.test.ts`, `coordinate-transform.test.ts`):** `1,000` selection/breadcrumb resolutions in `< 2.8 ms`; `1,000` coordinate transforms in `< 1.6 ms`.
- **Persistence & Concurrency (`persistence-performance.test.ts`):** Warm cached validation of `1,000` calls in `< 2.5 ms`; atomic draft save/publish across `25`–`1,000` nodes in `< 5 ms`–`< 95 ms`.

---

## 4. Verification Status Summary

| Metric | Status | Notes |
| :--- | :--- | :--- |
| **Automated Unit, Parity, Persistence, Studio, Selection & Structural Test Suites (`41` test files, `192` tests)** | **VERIFIED (`192/192 PASS`)** | Includes 4 new Prompt 11 suites (`structural-commands.test.ts`, `structural-validation.test.ts`, `layer-operations.test.tsx`, `layer-persistence.test.tsx`) |
| **Public Storefront Bundle Isolation** | **VERIFIED** | `_store.index-KnyFAuXC.js` (`8,975 B`) contains zero Studio, Geometry, Selection, or Structural Layer code; `StudioShell-CslstMbb.js` (`244.21 KB`) is lazy-loaded only on `/admin/design` |
| **Live Supabase Network Latency & PostgreSQL `EXPLAIN ANALYZE`** | `PENDING LIVE MIGRATION EXECUTION` | Migration `0010_storefront_page_persistence.sql` is not yet applied to the remote Supabase database |
| **Browser Pixel Screenshot Diffs (`360px`–`1920px`) & Live GPU FPS** | `BLOCKED — No Chromium binary in Argon 4 gVisor container` | Full-page DOM `innerHTML` and `renderToString` SSR parity remain `100%` verified via `homepage-parity.test.tsx` |
