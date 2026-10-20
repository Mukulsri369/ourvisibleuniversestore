# Performance Baseline & Benchmark Ledger — Visual Storefront Editor

- **Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)
- **Active Branch:** `feature/visual-storefront-editor`
- **Base Commit Under Test:** `b4ed3e121f3df51bae6dfc27f6c274a922ed030d`
- **Measurement Date:** 2026-10-20 (Prompt 5 of 48)
- **Execution Environment:** Google AI Studio — Argon 4 (`Linux 4.19.0-gvisor #1 SMP x86_64`, Node `v22.23.3`, npm `10.9.9`)

---

## 1. Storefront Production Bundle Size Comparison (Before vs. After Prompt 5)

Measured via `npm run build` (`vite build` + TanStack Start SSR bundler) inspecting `.output/public/assets/` and `.output/server/`:

| Bundle Artifact | Pre-Prompt 5 Size | Post-Prompt 5 Size | Delta | Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Client Homepage Route (`_store.index-*.js`)** | `44 KB` (`44,064 B`) | `44 KB` (`44,064 B`) | **`0 B` (`0.0%`)** | Public homepage does not import editor-only schema utilities yet; zero bundle impact |
| **Client `ProductCard-*.js`** | `149 KB` | `149 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client `StoreChrome-*.js`** | `12 KB` | `12 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client `store-*.js`** | `14 KB` | `14 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client `celestial-catalog-*.js`** | `19 KB` | `19 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client Global CSS (`styles-*.css`)** | `147 KB` | `147 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Client Core Vendor Entry (`index-*.js`)** | `583 KB` | `583 KB` | **`0 B` (`0.0%`)** | Unchanged |
| **Total `.output/public/assets/`** | `1.7 MB` | `1.7 MB` | **`0 B` (`0.0%`)** | Zero new dependencies added to `package.json` |
| **Server `_store.index-*.mjs`** | `71 KB` | `71 KB` | **`0 B` (`0.0%`)** | Unchanged |

---

## 2. PageDocument Schema Engine Statistical Benchmarks (Executed in Prompt 5)

Executed via `npx tsx` over **25 repeated iterations per document size** (`25`, `150`, `500`, and `1,000` nodes) in Node `v22.23.3`:

| Document Scale | Serialized Size | Operation | Mean (`ms`) | Median / p50 (`ms`) | p95 (`ms`) | Min (`ms`) | Max (`ms`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Small (`25` nodes)** | `9,940 B` (`9.7 KB`) | `parseAndValidateJson` | `6.056` | `5.849` | `11.724` | `2.882` | `21.769` |
| | | `zodValidateObject` | `5.298` | `5.289` | `10.507` | `2.527` | `12.106` |
| | | `nodeLookupDeepest` | `0.044` | `0.025` | `0.141` | `0.011` | `0.353` |
| | | `immutableStyleUpdate` | **`0.068`** | **`0.039`** | **`0.172`** | `0.027` | `0.480` |
| | | `responsiveResolveMobile` | `0.025` | `0.011` | `0.091` | `0.008` | `0.201` |
| | | `serializeJson` | `0.558` | `0.092` | `0.286` | `0.076` | `11.282` |
| **Medium (`150` nodes)** | `58,491 B` (`57.1 KB`) | `parseAndValidateJson` | `24.407` | `22.758` | `34.789` | `16.591` | `35.625` |
| | | `zodValidateObject` | `22.672` | `20.852` | `30.023` | `16.832` | `53.753` |
| | | `nodeLookupDeepest` | `0.201` | `0.050` | `0.232` | `0.035` | `3.339` |
| | | `immutableStyleUpdate` | **`0.080`** | **`0.060`** | **`0.193`** | `0.045` | `0.255` |
| | | `responsiveResolveMobile` | `0.012` | `0.012` | `0.017` | `0.009` | `0.017` |
| | | `serializeJson` | `0.531` | `0.416` | `0.770` | `0.349` | `1.936` |
| **Large (`500` nodes)** | `194,864 B` (`190.3 KB`) | `parseAndValidateJson` | `76.037` | `74.261` | `96.557` | `57.169` | `98.690` |
| | | `zodValidateObject` | `74.066` | `73.227` | `92.563` | `56.186` | `117.995` |
| | | `nodeLookupDeepest` | `0.128` | `0.085` | `0.340` | `0.067` | `0.451` |
| | | `immutableStyleUpdate` | **`0.139`** | **`0.071`** | **`0.426`** | `0.060` | `0.600` |
| | | `responsiveResolveMobile` | `0.013` | `0.012` | `0.015` | `0.010` | `0.033` |
| | | `serializeJson` | `1.990` | `1.579` | `4.434` | `1.313` | `5.399` |
| **Stress (`1,000` nodes)** | `390,141 B` (`381.0 KB`) | `parseAndValidateJson` | `143.978` | `138.672` | `176.206` | `118.369` | `195.020` |
| | | `zodValidateObject` | `134.875` | `130.390` | `179.473` | `108.778` | `187.516` |
| | | `nodeLookupDeepest` | `0.243` | `0.226` | `0.435` | `0.114` | `0.529` |
| | | `immutableStyleUpdate` | **`0.212`** | **`0.143`** | **`0.361`** | `0.085` | `1.067` |
| | | `responsiveResolveMobile` | `0.022` | `0.012` | `0.018` | `0.010` | `0.254` |
| | | `serializeJson` | `3.313` | `3.126` | `4.650` | `2.675` | `4.935` |

### Key Engineering Takeaway from Benchmarks
- **Interactive Drag/Resize Updates (`immutableStyleUpdate` + `responsiveResolveMobile`):** Even on a 1,000-node stress document, a localized immutable node style update takes **`0.143ms` median (`0.361ms` p95)** and responsive resolution takes **`0.012ms` median** — consuming `< 2.5%` of a `16.67ms` (60 FPS) frame budget.
- **Full Document Zod Validation (`safeParsePageDocument`):** Takes `5.29ms` (25 nodes) to `20.85ms` (150 nodes) and `130.39ms` (1,000 nodes). Therefore, full-tree Zod validation must execute on **document load, import, checkpoint commit, draft save, and publish** — never inside high-frequency `pointermove` frames.

---

## 3. Browser Runtime Metrics Status (Honest Reporting)

| Metric | Status | Notes |
| :--- | :--- | :--- |
| **SSR Dev Server HTTP Response (`http://localhost:3000`)** | **VERIFIED (`HTTP 200 OK`)** | Measured via local HTTP probe |
| **Vitest JSDOM Full Index Route Render (`app-routing.test.tsx`)** | **VERIFIED (`4,682ms`)** | Includes router tree, Supabase client init, and `PlanetHero` mount |
| **Vitest Schema & Tree Engine Suite (`4` files, `17` tests)** | **VERIFIED (`683ms` test time)** | Executed in Node + JSDOM |
| **Browser LCP / CLS / Field INP / GPU FPS** | `BLOCKED — No Chromium/Firefox binary installed in Argon 4 gVisor container` | Source-level animation and layout shift analysis documented below |

---

## 4. Source-Level Storefront Performance Audit Findings

1. **`PlanetHero.tsx` Video & Poster Lifecycle:**
   - Pre-renders lightweight WebP posters (`earth.webp`, `venus.webp`, `mars.webp`) and mounts `<video>` lazily only for the active planet (`loaded` starts as `["earth"]`), warming adjacent planets on pointer hover/focus (`warm(side.id)`).
   - Uses `IntersectionObserver` (`threshold: 0.2`) and `document.visibilitychange` to pause video playback when scrolled out of view.
2. **`CelestialScrollWorld.tsx` Scroll-Linked Transforms:**
   - Uses Motion `useScroll()` + `useSpring()` driving CSS `transform` (`x`, `y`, `scale`, `rotate`) and `opacity` directly on 3 fixed-position DOM nodes (`earth`, `venus`, `mars`), avoiding React component re-renders during scroll.
   - Contains 2 continuous SVG `<ellipse>` CSS animations (`animate-[spin_240s_linear_infinite]` and `animate-[spin_180s_linear_infinite_reverse]`).
3. **`ProgressiveCategorySpotlight` (`_store.index.tsx`):**
   - Eagerly renders the first 3 category sections (`index < 3`) and defers remaining categories (`index >= 3`) behind an `IntersectionObserver` (`rootMargin: "600px 0px"`) with a `h-[460px]` placeholder to prevent initial DOM bloat and layout shift.
4. **`ProductCard.tsx` Hover Image Slideshow:**
   - Activates a `1400ms` timer only while a single card is hovered (`isHovered && imageList.length > 1`) and cleans up immediately on `mouseleave`.
