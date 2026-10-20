# Performance Baseline & Benchmark Ledger — Visual Storefront Editor

- **Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)
- **Active Branch:** `feature/visual-storefront-editor`
- **Previous Remote Commit (`origin/main`):** `f05569b41f74c3c89006f9fe7ef32ba6a48fde56`
- **Measurement Date:** 2026-10-20 (Prompt 6 of 48)
- **Execution Environment:** Google AI Studio — Argon 4 (`Linux 4.19.0-gvisor #1 SMP x86_64`, Node `v22.23.3`, Vitest `4.1.12`)

---

## 1. Storefront Production Bundle Size Comparison (Before vs. After Prompt 6)

Measured via `compile_applet` / `npm run build` inspecting `.output/public/assets/`:

| Bundle Artifact | Prompt 5 Baseline | Post-Prompt 6 Size | Delta | Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Client Homepage Route (`_store.index-*.js`)** | `33 KB` (`33,421 B`) | `33 KB` (`33,421 B`) | **`0 B` (`0.0%`)** | Public homepage (`src/routes/_store.index.tsx`) is untouched in Prompt 6; zero public bundle impact |
| **Client `ProductCard-*.js`** | `151 KB` | `151 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client `StoreChrome-*.js`** | `7.4 KB` | `7.4 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client `store-*.js`** | `14 KB` | `14 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client `celestial-catalog-*.js`** | `19 KB` | `19 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client Global CSS (`styles-*.css`)** | `148 KB` | `148 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client Core Vendor Entry (`index-*.js`)** | `380 KB` | `380 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Total `.output/public/assets/`** | `1.5 MB` | `1.5 MB` | **`0 B` (`0.0%`)** | Zero new npm dependencies added |

---

## 2. Prompt 6 Component Registry & Shared Renderer Performance Measurements

Executed via `npx vitest run src/lib/visual-editor/__tests__/` in Node `v22.23.3` + JSDOM:

| Operation / Benchmark | Workload Scale | Measured Duration | Threshold | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Registry Component Lookup (`getComponent`)** | `10,000` consecutive lookups | **`< 2.0 ms`** (`O(1)` `Map` lookup) | `< 25 ms` | **PASS** |
| **Responsive Style & CSS Property Resolution (`resolveResponsiveNodePresentation`)** | `1,000` nodes resolved to `mobile` cascade + `CSSProperties` | **`< 15.0 ms`** (`~0.015 ms / node`) | `< 50 ms` | **PASS** |
| **Full Synthetic Page Render + Localized Single-Card Style Rerender (`PageRenderer`)** | `25`-node page render + localized `updateNodeStyle` rerender | **`221 ms` total test suite time**; sibling DOM node identity preserved (`secondCardNodeAfter === secondCardNodeBefore`) | `< 2000 ms` | **PASS** |
| **Real Storefront Adapter Parity Suite (`adapters.test.tsx`)** | `8` integration tests (`ProductCard`, `ProductScrollRail`, `CategorySpotlightHero`, `CategoryCard`, `PlanetHero`, `CelestialScrollWorld`, `StoreChrome`, `MiniComponentPreviewRenderer`) | **`390 ms`** | `< 2000 ms` | **PASS** |
| **Data-Binding & Interaction Policy Suite (`data-bindings.test.tsx`)** | `3` integration tests across `public`, `editor`, and `preview` modes | **`205 ms`** | `< 1000 ms` | **PASS** |

---

## 3. PageDocument Schema Engine Statistical Benchmarks (Prompt 5 Baseline Preserved)

Executed over **25 repeated iterations per document size** (`25`, `150`, `500`, and `1,000` nodes):

| Document Scale | Serialized Size | Operation | Mean (`ms`) | Median / p50 (`ms`) | p95 (`ms`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Small (`25` nodes)** | `9.7 KB` | `immutableStyleUpdate` | `0.068` | `0.039` | `0.172` |
| **Medium (`150` nodes)** | `57.1 KB` | `immutableStyleUpdate` | `0.080` | `0.060` | `0.193` |
| **Large (`500` nodes)** | `190.3 KB` | `immutableStyleUpdate` | `0.139` | `0.071` | `0.426` |
| **Stress (`1,000` nodes)** | `381.0 KB` | `immutableStyleUpdate` | `0.212` | `0.143` | `0.361` |

---

## 4. Browser Runtime Metrics & Unverified Metrics Status

| Metric | Status | Notes |
| :--- | :--- | :--- |
| **Full Vitest Repository Suite (`20` files, `108` tests)** | **VERIFIED (`108/108 PASS`)** | Includes all storefront, admin, schema, registry, adapter parity, data-binding, and performance tests |
| **Direct Component vs. Adapter HTML Parity** | **VERIFIED (`100% Exact Match`)** | Verified in `src/lib/visual-editor/__tests__/adapters.test.tsx` |
| **Browser Pixel Screenshot Diffs / Field LCP / CLS / GPU FPS** | `BLOCKED — No Chromium/Playwright browser binary installed in Argon 4 gVisor container` | Explicitly reported as unverified in browser; DOM/HTML parity and style calculations verified in JSDOM |
