# AI Studio Multi-Account Handoff Guide — Visual Storefront Editor

> **CRITICAL CONTINUITY DOCUMENT:** Any new Google AI Studio session or Google account resuming work on this project must read this file, `IMPLEMENTATION_PROGRESS.md`, `ARCHITECTURE_AUDIT.md`, and `PERFORMANCE_BASELINE.md` before writing code.

---

## 1. Repository & Branch Coordinates

- **GitHub Repository URL:** `https://github.com/Mukulsri369/ourvisibleuniversestore`
- **Designated Development Branch:** `feature/visual-storefront-editor`
- **Previous Verified Remote Commit SHA (`origin/main`):** `f05569b41f74c3c89006f9fe7ef32ba6a48fde56` (`chore: add visual editor architectural documentation`, following `b4ed3e121f3df51bae6dfc27f6c274a922ed030d`)
- **Last Completed Prompt:** **Prompt 6 of 48** (`Component Registry, Real Storefront Adapters, Shared Page Renderer, GitHub Continuity & Performance Validation`)
- **Next Prompt to Execute:** **Prompt 7 of 48** (`Default Homepage PageDocument Conversion, Dual-Path Fallback & Zero-Regression Storefront Integration`)

---

## 2. Summary of Completed Work (Prompts 1–6)

1. **Prompts 1–4 (Phase 1 Foundation & Baselines):**
   - Architecture audit, compatibility contract, interaction PoC (`src/test/editor-interaction-engine.test.tsx`), visual regression baseline artifacts (`/visual-regression/*`), and zero-regression test suite (`src/test/baseline-zero-regression.test.tsx`).
2. **Prompt 5 (Phase 2 PageDocument Schema Engine):**
   - Versioned, Zod-validated `PageDocument` schema (`schemaVersion: "1.0.0"`) and structural-sharing tree utilities in `src/lib/visual-editor/schema/*` and `src/lib/visual-editor/utils/*`.
3. **Prompt 6 (Phase 2 Component Registry, Real Storefront Adapters & Shared Page Renderer):**
   - Implemented the Component Registry (`src/lib/visual-editor/registry/`):
     - `src/lib/visual-editor/registry/component-capabilities.ts`
     - `src/lib/visual-editor/registry/component-defaults.ts`
     - `src/lib/visual-editor/registry/component-registry.ts`
     - `src/lib/visual-editor/registry/component-definitions.ts`
     - `src/lib/visual-editor/registry/index.ts`
   - Implemented the Shared Page Renderer & Resolution Layer (`src/lib/visual-editor/rendering/`):
     - `src/lib/visual-editor/rendering/RenderContext.tsx`
     - `src/lib/visual-editor/rendering/style-resolver.ts`
     - `src/lib/visual-editor/rendering/responsive-styles.ts`
     - `src/lib/visual-editor/rendering/data-resolver.ts`
     - `src/lib/visual-editor/rendering/RenderNode.tsx`
     - `src/lib/visual-editor/rendering/PageRenderer.tsx`
   - Implemented Real Storefront Component Adapters (`src/lib/visual-editor/adapters/`):
     - `src/lib/visual-editor/adapters/AdapterBoundary.tsx`
     - `src/lib/visual-editor/adapters/PlanetHeroAdapter.tsx`
     - `src/lib/visual-editor/adapters/CelestialScrollWorldAdapter.tsx`
     - `src/lib/visual-editor/adapters/ProductScrollRailAdapter.tsx`
     - `src/lib/visual-editor/adapters/ProductCardAdapter.tsx`
     - `src/lib/visual-editor/adapters/CategorySpotlightAdapter.tsx`
     - `src/lib/visual-editor/adapters/CategoryCardAdapter.tsx`
     - `src/lib/visual-editor/adapters/StoreChromeAdapter.tsx`
     - `src/lib/visual-editor/adapters/GenericElementsAdapter.tsx`
   - Added 5 new automated test suites (`src/lib/visual-editor/__tests__/{registry,renderer,adapters,data-bindings,rendering-performance}.test.ts(x)`).
   - Verified **20 test files / 108 total tests passing**, `0` ESLint errors, and `0 bytes` increase to the public storefront homepage bundle (`_store.index-*.js` remains `33 KB`).

---

## 3. Essential Verification Commands

```bash
# 1. Run all unit, baseline, and visual-editor tests (20 suites, 108 tests)
npm test -- --run

# 2. Run only the visual-editor schema, registry, adapter, and renderer tests (9 suites, 45 tests)
npx vitest run src/lib/visual-editor/__tests__/

# 3. Run ESLint check (0 errors)
npm run lint

# 4. Run production build
npm run build
```

---

## 4. Exact Instructions for Prompt 7 of 48

**Next Task:** **Prompt 7 — Default Homepage PageDocument Conversion, Dual-Path Fallback & Zero-Regression Storefront Integration**
1. Inspect `src/routes/_store.index.tsx`, `src/lib/visual-editor/rendering/PageRenderer.tsx`, `src/lib/visual-editor/rendering/data-resolver.ts`, and `src/lib/visual-editor/utils/fixtures.ts`.
2. Build the canonical default Homepage `PageDocument` generator that models the exact current homepage layout (`CelestialScrollWorld`, `PlanetHero`, `FestivalSection`, `Featured` rail, `New arrivals` rail, progressive dynamic `CategorySpotlightHero` + `ProductScrollRail` sections, `InterestSection`, `BenefitsSection`, and `InstagramSection`).
3. Maintain a safe fallback path so if a document is absent or invalid, the storefront renders with zero disruption.
4. Keep `renderGlobalChromeInDocument={false}` when rendering inside `src/routes/_store.tsx` so `StoreHeader` and `StoreFooter` are never duplicated.
