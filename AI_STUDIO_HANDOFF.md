# AI Studio Multi-Account Handoff Guide — Visual Storefront Editor

> **CRITICAL CONTINUITY DOCUMENT:** Any new Google AI Studio session or Google account resuming work on this project must read this file, `STUDIO_WORKSPACE_HANDOFF.md`, `IMPLEMENTATION_PROGRESS.md`, `ARCHITECTURE_AUDIT.md`, and `PERFORMANCE_BASELINE.md` before writing code.

---

## 1. Repository & Branch Coordinates

- **GitHub Repository URL:** `https://github.com/Mukulsri369/ourvisibleuniversestore`
- **Designated Development Branch:** `feature/visual-storefront-editor`
- **Previous Verified Remote Commit SHA (`origin/main`):** `28d80db39d13150eb69ae34405ba3c06e0792acc` (`chore: complete prompt 6 for visual storefront editor`)
- **Local Commit History on `feature/visual-storefront-editor`:**
  - Prompt 7: `6f02252bcee883be367ef72c26d74a8def2b6f33` (`feat(storefront): migrate homepage to shared page renderer`)
  - Prompt 8: `1db1e3cd4815505e` (`feat(visual-editor): add page persistence, draft versioning, and atomic publishing`)
  - Prompt 9: `677102e` (`feat(visual-editor): build store design studio shell, live canvas, layers, viewport, and inspector`)
  - Prompt 10: `a956d6e` (`feat(editor): add precision selection and canvas geometry engine`)
  - Prompt 11: *(Committed in current session — see `git log -n 1`)* (`feat(editor): add structural layer editing and hierarchy controls`)
- **Last Completed Prompt:** **Prompt 11 of 48** (`Advanced Layer Management, Component Hierarchy, Structural Editing, Safe Reordering, Duplication, Visibility, Locking, Performance Audit & GitHub Checkpoint`)
- **Next Prompt to Execute:** **Prompt 12 of 48** (`Direct Canvas Drag-and-Drop Reordering, Free-Positioning Mode, Resize Handles, Alignment Guides & Snapping Engine`)

---

## 2. Summary of Completed Work (Prompts 1–11)

1. **Prompts 1–4 (Phase 1 Foundation & Baselines):**
   - Architecture audit, compatibility contract, interaction PoC (`src/test/editor-interaction-engine.test.tsx`), visual regression baseline artifacts (`/visual-regression/*`), and zero-regression test suite (`src/test/baseline-zero-regression.test.tsx`).
2. **Prompt 5 (Phase 2 PageDocument Schema Engine):**
   - Versioned, Zod-validated `PageDocument` schema (`schemaVersion: "1.0.0"`) and structural-sharing tree utilities in `src/lib/visual-editor/schema/*` and `src/lib/visual-editor/utils/*`.
3. **Prompt 6 (Phase 2 Component Registry, Real Storefront Adapters & Shared Page Renderer):**
   - Implemented `VisualComponentRegistry` (`31` registered component types), `PageRenderer`, `MiniComponentPreviewRenderer`, `data-resolver.ts`, `style-resolver.ts`, and real storefront adapters (`src/lib/visual-editor/adapters/*`).
4. **Prompt 7 (Phase 2 Real Homepage Migration to Shared Page Renderer):**
   - Created `DEFAULT_HOMEPAGE_PAGE_DOCUMENT`, `LegacyHomepageView`, and `HomepageRenderer` (`src/lib/visual-editor/homepage/*`), and migrated `src/routes/_store.index.tsx` with **100% character-for-character DOM `innerHTML` and `renderToString` SSR parity**.
5. **Prompt 8 (Phase 2 Secure Supabase Page Persistence, Draft Management, Version History & Atomic Publishing Foundation):**
   - Created `drizzle/migrations/0010_storefront_page_persistence.sql`, `src/lib/visual-editor/persistence/*`, and `src/lib/visual-editor/publishing/*`.
6. **Prompt 9 (Phase 3 Store Design Studio Shell, Live Storefront Canvas, Layer Tree, Viewport Simulator & Contextual Inspector Foundation):**
   - Created protected route `src/routes/_admin.admin.design.tsx`, `src/lib/visual-editor/studio/*`, and `src/components/visual-editor/*`.
7. **Prompt 10 (Phase 3 Advanced Canvas Selection Engine, Precise DOM Hit-Testing, Element Geometry Overlays, Nested Selection & Interaction Infrastructure):**
   - Implemented `src/lib/visual-editor/geometry/*`, `src/lib/visual-editor/interactions/*`, and `src/components/visual-editor/selection/*`.
8. **Prompt 11 (Phase 3 Advanced Layer Management, Component Hierarchy, Structural Editing, Safe Reordering, Duplication, Visibility & Locking):**
   - Implemented `src/lib/visual-editor/structure/*` (`structural-validation.ts`, `move-node.ts`, `duplicate-node.ts`, `visibility.ts`, `locking.ts`, `grouping.ts`, `structural-commands.ts`, `index.ts`).
   - Implemented `src/components/visual-editor/layers/*` (`LayerRenameInput.tsx`, `LayerActionControls.tsx`, `LayerContextMenu.tsx`, `LayerDeleteConfirmDialog.tsx`, `index.ts`) and upgraded `StudioLayersPanel.tsx`, `StudioInspector.tsx`, and `StudioShell.tsx`.
   - Added 4 new test suites (`structural-commands.test.ts`, `structural-validation.test.ts`, `layer-operations.test.tsx`, `layer-persistence.test.tsx`) — **41 test files / 192 total tests passing**.

---

## 3. Database & Environment Prerequisites

- **Required Environment Variable Names (do not store secret values in docs):**
  - `VITE_SUPABASE_URL` / `SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SITE_URL` (optional, defaults to `https://store.ourvisibleuniverse.com`)
- **Migration Application Status:**
  - `drizzle/migrations/0010_storefront_page_persistence.sql` is authored and verified via static SQL checks and transactional simulation, and awaits execution on staging/development Supabase before testing live database RPC persistence. Until applied, `getPublishedPage("/")`, `HomepageRenderer`, and `StudioShell` safely fall back to `DEFAULT_HOMEPAGE_PAGE_DOCUMENT`.

---

## 4. Essential Verification Commands

```bash
# 1. Run all unit, baseline, and visual-editor tests (41 suites, 192 tests)
npm test -- --run

# 2. Run only the visual-editor test suites (30 suites, 129 tests)
npx vitest run src/lib/visual-editor/__tests__/

# 3. Run ESLint check (0 errors)
npm run lint

# 4. Run production build
npm run build
```

---

## 5. Exact Instructions for Prompt 12 of 48

**Next Task:** **Prompt 12 — Direct Canvas Drag-and-Drop Reordering, Free-Positioning Mode, Resize Handles, Alignment Guides & Snapping Engine**
1. Read `IMPLEMENTATION_PROGRESS.md`, `ARCHITECTURE_AUDIT.md`, and `PERFORMANCE_BASELINE.md` for full details on the Prompt 10 `geometry/*`, `interactions/*`, and Prompt 11 `structure/*` architecture.
2. Build on `SelectionOverlay`, `executeStructuralCommand`, `isNodeEffectivelyLocked`, and `viewportRectToCanvasLocalRect` to implement direct canvas manipulation handles, drag reordering, alignment guides, and snapping while preserving `zoomScale` coordinate accuracy, lock restrictions, and 100% public storefront bundle isolation.
