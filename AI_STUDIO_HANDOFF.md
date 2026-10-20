# AI Studio Multi-Account Handoff Guide — Visual Storefront Editor

> **CRITICAL CONTINUITY DOCUMENT:** Any new Google AI Studio session or Google account resuming work on this project must read this file, `IMPLEMENTATION_PROGRESS.md`, `ARCHITECTURE_AUDIT.md`, and `PERFORMANCE_BASELINE.md` before writing code.

---

## 1. Repository & Branch Coordinates

- **GitHub Repository URL:** `https://github.com/Mukulsri369/ourvisibleuniversestore`
- **Designated Development Branch:** `feature/visual-storefront-editor`
- **Base `main` Branch Commit SHA:** `b4ed3e121f3df51bae6dfc27f6c274a922ed030d` (`refactor: enhance product form logic and test coverage`)
- **Last Completed Prompt:** **Prompt 5 of 48** (`Production-Grade Page Schema Engine, GitHub Continuity, Performance Audit & Zero-Regression Implementation`)
- **Next Prompt to Execute:** **Prompt 6 of 48** (`Component Registry, Existing Storefront Adapters & Shared Renderer Foundation`)

---

## 2. Summary of Completed Work (Prompts 1–5)

1. **Prompts 1–4 (Phase 1 Foundation & Baselines):**
   - Architecture audit, compatibility contract, interaction PoC (`src/test/editor-interaction-engine.test.tsx`), visual regression baseline artifacts (`/visual-regression/*`), and zero-regression test suite (`src/test/baseline-zero-regression.test.tsx`).
2. **Prompt 5 (Phase 2 PageDocument Schema Engine):**
   - Implemented the complete, versioned, Zod-validated `PageDocument` schema and structural-sharing tree utilities in `src/lib/visual-editor/`:
     - `src/lib/visual-editor/schema/geometry.ts`
     - `src/lib/visual-editor/schema/shapes.ts`
     - `src/lib/visual-editor/schema/layout.ts`
     - `src/lib/visual-editor/schema/appearance.ts`
     - `src/lib/visual-editor/schema/media.ts`
     - `src/lib/visual-editor/schema/bindings.ts`
     - `src/lib/visual-editor/schema/animation.ts`
     - `src/lib/visual-editor/schema/responsive.ts`
     - `src/lib/visual-editor/schema/nodes.ts`
     - `src/lib/visual-editor/schema/page-document.ts`
     - `src/lib/visual-editor/schema/migrations.ts`
     - `src/lib/visual-editor/schema/validation.ts`
     - `src/lib/visual-editor/utils/ids.ts`
     - `src/lib/visual-editor/utils/responsive-resolution.ts`
     - `src/lib/visual-editor/utils/node-tree.ts`
     - `src/lib/visual-editor/utils/fixtures.ts`
     - `src/lib/visual-editor/index.ts`
   - Added 4 dedicated test suites (`src/lib/visual-editor/__tests__/{schema,responsive,tree-utilities,security}.test.ts`).
   - Verified **15 test files / 80 total tests passing** across the repository, `0` ESLint errors, and `0 bytes` increase to the public storefront bundle (`_store.index-*.js` remains `44 KB`).

---

## 3. Environment Prerequisites & Required Secrets (By Variable Name Only)

Never commit secret values. The application uses the following environment variable names (configured in `.env.example` / platform environment):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (for private object storage proxy)

---

## 4. Essential Verification Commands

```bash
# 1. Run all unit, baseline, and visual-editor schema tests (15 suites, 80 tests)
npm test -- --run

# 2. Run only the visual-editor schema & tree utility tests
npx vitest run src/lib/visual-editor/__tests__/

# 3. Run ESLint check (0 errors, 8 pre-existing fast-refresh warnings)
npm run lint

# 4. Run production build
npm run build
```

---

## 5. GitHub Synchronization Status & Recovery Protocol

- **Local Git Repository Status:** Initialized and fetched from `https://github.com/Mukulsri369/ourvisibleuniversestore.git` (`origin/main` at `b4ed3e121f3df51bae6dfc27f6c274a922ed030d`), checked out on branch `feature/visual-storefront-editor`, with all Prompt 5 schema, test, baseline, and handoff files committed cleanly.
- **Note on AI Studio Sandbox Push Permissions:** If the AI Studio Argon 4 container does not have a GitHub Personal Access Token (PAT) or SSH key injected into the shell environment for `git push -u origin feature/visual-storefront-editor`, push via the AI Studio / Lovable GitHub UI sync or run:
  ```bash
  git push -u origin feature/visual-storefront-editor
  ```
  from a credentialed terminal.

---

## 6. Exact Instructions for Prompt 6 of 48

**Next Task:** **Prompt 6 — Component Registry, Existing Storefront Adapters & Shared Renderer Foundation**
1. Inspect `src/lib/visual-editor/index.ts`, `src/routes/_store.index.tsx`, `src/components/store/PlanetHero.tsx`, `src/components/store/CelestialScrollWorld.tsx`, `src/components/store/ProductScrollRail.tsx`, `src/components/store/ProductCard.tsx`, `src/components/store/CategorySpotlightHero.tsx`, `src/components/store/CategoryCard.tsx`, and `src/components/store/StoreChrome.tsx`.
2. Build the typed Component Registry and Storefront Adapters that map `EditorNode` configurations and resolved responsive styles to the real storefront components without breaking their existing props, animations, or affiliate link behavior.
3. Preserve all existing public storefront visuals and tests.
