# Store Design Studio Workspace Handoff — Visual Storefront Editor (Prompt 9 of 48)

> **CRITICAL CONTINUITY DOCUMENT:** Any new Google AI Studio session or Google account resuming work on this project must read this file alongside `AI_STUDIO_HANDOFF.md`, `IMPLEMENTATION_PROGRESS.md`, `ARCHITECTURE_AUDIT.md`, and `PERFORMANCE_BASELINE.md` before writing code.

---

## 1. Executive Summary of Prompt 9 Deliverables

Prompt 9 establishes **Phase 3: Store Design Studio Shell, Live Storefront Canvas, Layer Tree, Viewport Simulator & Contextual Inspector Foundation** at `/admin/design`:

1. **Protected Admin Route & Lazy Bundle Isolation (`src/routes/_admin.admin.design.tsx`, `src/routes/_admin.tsx`):**
   - Protected by the `/_admin` layout route guard (`supabase.auth.getUser()` + `supabase.rpc("is_admin")`) and `X-Robots-Tag: noindex, nofollow`.
   - Added **Design Studio** entry (`to: "/admin/design"`) in the Admin navigation bar.
   - Bypasses the standard `max-w-6xl` form container when `location.pathname` is `/admin/design`, rendering a full-viewport (`h-screen w-screen overflow-hidden`) studio workspace.
   - Dynamically lazy-loads `StudioShell` via `React.lazy(() => import("@/components/visual-editor/StudioShell"))` so **zero bytes** of studio UI or `react-resizable-panels` enter the public storefront bundle.

2. **Isolated Scroll Container & 100% Public Storefront Parity (`src/lib/visual-editor/rendering/CanvasScrollContext.tsx`, `src/components/store/CelestialScrollWorld.tsx`):**
   - `CanvasScrollContext` provides the studio canvas scroll container ref (`scrollContainerRef`) and `isIsolatedStudioCanvas: true` ONLY inside the Design Studio canvas.
   - When `isIsolatedStudioCanvas` is `false` (default on public storefront `/` and SSR), `CelestialScrollWorld` renders the exact original `fixed inset-0` DOM structure and window scroll tracking with **100% character-for-character DOM & SSR parity**.
   - Inside the studio canvas (`isIsolatedStudioCanvas: true`), `CelestialScrollWorld` tracks `useScroll({ container: scrollContainerRef })` and renders inside a `sticky` zero-height stage layer (`data-celestial-scroll-mode="studio-canvas"`).

3. **Studio State, Viewport Simulator, Layer Tree & Localized Document Updates (`src/lib/visual-editor/studio/*`):**
   - `studio-viewport.ts`: Device presets (`desktop` `1440×900`, `tablet` `768×1024`, `mobile` `390×844`, `custom` `320px–1920px`), `resolveBreakpointFromWidth(viewportWidthPx)`, and visual zoom scaling (`50%`, `75%`, `100%`, `125%`, `Fit`) strictly decoupled from `viewportWidthPx` so zoom never corrupts breakpoint inheritance.
   - `studio-selection.ts`: Hierarchical layer tree builder (`buildStudioLayerTree`), search filter (`filterStudioLayerTree`), global chrome nodes (`global-chrome::store-header`, `global-chrome::store-footer`), and deterministic virtual category identities (`<sectionNodeId>::category::<categoryId>`) derived at runtime from live categories without mutating or duplicating `PageDocument` nodes.
   - `studio-document.ts`: Localized structural-sharing immutable node updates (`updateStudioNodeName`, `updateStudioNodeVisibility`, `updateStudioNodeProp`, `updateStudioNodeSpacing`, `updateStudioNodeAppearance`) validated against `FORBIDDEN_BUSINESS_DATA_KEYS`, `TrustedComponentCapabilities`, `SafeComponentPropsSchema`, and `NodeStyleBundleSchema`.
   - `studio-persistence.ts`: Loads working drafts via Prompt 8 `getStorePageByKey` / `getAdminDraft` / `getPublishedPage`, saves drafts via `savePageDraft` with `expectedDraftRevision` optimistic concurrency, caches local `sessionStorage` unsaved recovery snapshots, and surfaces structured conflict recovery (`DRAFT_REVISION_CONFLICT`).
   - `studio-state.ts`: Clean separation of Document State, Editor UI State, and Persistence Lifecycle State.

4. **Studio UI Component Hierarchy (`src/components/visual-editor/*`):**
   - `StudioShell.tsx`: Full-screen workspace orchestrator with desktop 3-pane `ResizablePanelGroup`, collapsible sidebars, tablet/mobile slide-over drawers, keyboard shortcuts (`Cmd/Ctrl+S`, `Escape`), and `beforeunload` / navigation unsaved-changes guards.
   - `StudioToolbar.tsx`: Breadcrumb navigation, page selector (`Homepage (/)`), device/zoom controls, `Edit Mode` vs `Preview Mode` switcher, `Open Live Store` link, `Reset`, and `Save Draft` button with live revision status badge.
   - `StudioViewportControls.tsx`: Desktop/Tablet/Mobile preset buttons, custom width/height inputs, resolved breakpoint badge, and zoom selector.
   - `StudioLayersPanel.tsx`: Expandable/collapsible `PageDocument` hierarchy tree, search filter, component type badges, lock indicators, breakpoint visibility toggles, and dynamic category instances.
   - `StudioCanvas.tsx`: Isolated scrollable viewport mounting one shared `StoreHeader`, `PageRenderer`, one shared `StoreFooter`, and `StudioSelectionOverlay` with safe click interception (`preventExternalNavigation: true`, `preventProductNavigation: true`).
   - `StudioSelectionOverlay.tsx`: `pointer-events: none` geometry overlay computing `[data-editor-node-id]` bounding boxes via `ResizeObserver` and passive scroll/resize listeners without shifting storefront layout.
   - `StudioInspector.tsx`: Capability-gated contextual inspector for `Identity & Visibility`, `Content Properties`, `Spacing (Padding & Margin)`, `Visual Appearance`, `Data Binding & Media Summary`, and `Protected Business Data Notice`.
   - `StudioStatusBar.tsx` & `StudioLoadingState.tsx`: Bottom status bar (`selection breadcrumb`, `viewport/breakpoint`, `draft revision`, `publish boundary disclosure`) and error/conflict recovery banners.

---

## 2. Exact Instructions for Next Prompt (Prompt 10 of 48)

**Next Task:** **Prompt 10 — Canvas Drag-and-Drop Reordering, Free-Positioning Mode, Resize Handles, Alignment Guides & Snapping Engine**

1. **Inspect Existing Studio Architecture First:**
   - `src/components/visual-editor/StudioCanvas.tsx`
   - `src/components/visual-editor/StudioSelectionOverlay.tsx`
   - `src/components/visual-editor/StudioLayersPanel.tsx`
   - `src/lib/visual-editor/studio/studio-document.ts`
   - `src/lib/visual-editor/schema/geometry.ts`
2. **Scope for Prompt 10:**
   - Extend `StudioSelectionOverlay` and `StudioCanvas` with interactive drag handles, resize handles (`canResize: true` capabilities), alignment/snapping guides, and section/layer reordering (`moveNode` in `node-tree.ts`) while keeping `pointer-events` and `transform` isolation clean at any zoom level (`zoomScale`).
   - Maintain 100% public storefront bundle isolation and zero regression on `homepage-parity.test.tsx`.
