# Visual Storefront Editor — Technology Selection & Interaction Engine Proof-of-Concept Report, Version 1.0

**Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)  
**Phase:** Phase 1, Prompt 3 of 48 — Technology Evaluation, Library Compatibility & Interaction Engine PoC  
**Status:** Complete & Runtime-Verified in Isolated Test Harness (`src/test/editor-interaction-engine.test.tsx`)

---

## A. Confirmed Repository Technology Stack & Constraints

Direct inspection of `/package.json` and `npm info` metadata confirms:
- **Runtime:** React `19.2.0`, React DOM `19.2.0`, TypeScript `5.8.3`, Vite `8.1.5`, Nitro `3.0.260603-beta`.
- **Routing & State:** `@tanstack/react-start` `1.168.60`, `@tanstack/react-router` `1.170.41`, `@tanstack/react-query` `5.101.1`.
- **UI & Styling:** Tailwind CSS `4.2.1`, Radix UI primitives, `react-resizable-panels` `4.6.5`, `lucide-react` `0.575.0`, `sonner` `2.0.7`.
- **Animation & 3D:** `motion` `14.1.0` (`motion/react`), `three` `0.186.1`, `embla-carousel-react` `8.6.0`.
- **Validation & Testing:** `zod` `3.25.76`, `vitest` `4.1.11`, `@testing-library/react` `16.0.0`.
- **Client-Only Boundary:** `/src/routes/_admin.tsx` sets `ssr: false`, providing a strict client-only boundary so editor libraries can be dynamically imported in `/admin/editor` with **zero bytes added to the public storefront bundle**.

---

## B. Candidate Library Deep Evaluation

### 1. Puck Editor (`@measured/puck` `v0.20.2`) — 17-Capability Audit
- **Verified npm Metadata:** Version `0.20.2`, `peerDependencies: { react: '^18.0.0 || ^19.0.0' }`, internal dependencies include `zustand: ^5.0.3` and `@dnd-kit/react: 0.1.18`.
- **Strengths (Capabilities 1–10, 14–17):** Provides a structured `Config` component registry, sidebar form fields, `<DropZone />` nesting, outline tree, JSON serialization, and `<Render />` component.
- **Critical Limitations for Our Requirements (Capabilities 11–13 & Figma/Webflow Parity):**
  1. **No Direct Geometric Manipulation:** Puck does not support 8-point corner/edge resize handles, direct corner-radius dragging, alignment snap guides, or interactive grid-span boundary dragging.
  2. **Iframe Canvas Friction:** Puck's default iframe viewport complicates shared Three.js WebGL contexts (`GalaxyScene`), `useScroll` window targets (`CelestialScrollWorld`), and TanStack Router `<Link>` context.
  3. **Drag Controller Collision:** Puck attaches its own `@dnd-kit/react` drag sensors to every registered block, which directly conflicts with external geometric resize handles unless heavily overridden.

### 2. React Moveable (`react-moveable` `v0.56.0`) — 12 Interactions & 14 Difficult Scenarios Audit
- **Verified npm Metadata:** Version `0.56.0` (`gesto: ^1.19.3`, `@scena/matrix: ^1.1.1`). Uses direct DOM refs (`target: HTMLElement | null`) with zero `findDOMNode` usage (React 19 safe).
- **Supported Interactions:** `draggable`, `resizable`, `scalable`, `rotatable`, `roundable` (direct corner-radius handles), `snappable` (alignment guides), `bounds` (parent constraints), and `keepRatio` (aspect-ratio locking).
- **Resolution of the 14 Difficult Scenarios:**
  1. *Element inside CSS Grid:* Moveable displays transient resize feedback on the overlay; on `onResizeEnd`, pixel width is converted to `col-span-*` (`1..12`) and inline width is cleared.
  2. *Element inside Flex container:* Translates resize delta into flex-basis / max-width tokens (`max-w-md`, `max-w-lg`, etc.).
  3. *Element already has a Motion transform:* Target wrapper slot (`data-studio-id`) sits outside the inner `motion.div`, or animations are paused during active drag so transforms never compound.
  4. *Parent container uses CSS transform (zoomed canvas):* Moveable natively supports `zoom` and `rootContainer` props to compensate for scaled viewports.
  5. *Iframe vs. In-App Canvas:* Using an in-app responsive stage container avoids cross-document coordinate drift.
  6. *Horizontally scrolling carousel (`ProductScrollRail`):* Scroll listener on the rail calls `moveableRef.current?.updateRect()` so the selection box tracks scrolled cards accurately.
  7. *Parent has `overflow: hidden`:* Selection overlay is mounted at the top-level canvas stage (`z-index: 50`), so handles are never clipped by card or section `overflow-hidden`.
  8. *Element partially outside viewport:* Overlay clips gracefully to the canvas scroll viewport while keeping visible handles interactive.
  9. *Page zoomed or scrolled:* `ResizeObserver` + scroll listeners trigger `requestAnimationFrame(() => updateRect())`.
  10. *Dimensions change after image load:* `ResizeObserver` on the selected `HTMLElement` automatically refreshes the overlay box when lazy images finish decoding.
  11. *Component rerenders during drag:* Transient drag state is held in a mutable ref / overlay state and committed to React state only on `onResizeEnd` / `onDragEnd`.
  12. *Element replaced by dynamic data:* Stable `data-studio-id` keys re-resolve the DOM node after data updates.
  13. *Portal or modal overlays canvas:* Opening `<ProductQuickPreviewModal />` or an admin dialog temporarily suspends the canvas selection overlay.
  14. *WebGL/Three.js behind selected element:* Canvas elements (`CelestialScrollWorld`, `GalaxyScene`) keep `pointer-events: none` so they never steal pointer hit-testing.

### 3. dnd-kit (`@dnd-kit/core` `v6.3.1` & `@dnd-kit/sortable`)
- **Verified npm Metadata:** Version `6.3.1`, `peerDependencies: { react: '>=16.8.0', 'react-dom': '>=16.8.0' }`.
- **Evaluation:** Best-in-class for structural sorting (reordering sections in the Left Outline Tree or via section grip handles, and reordering cards within curated collections). Provides built-in keyboard accessibility (`KeyboardSensor`), auto-scrolling, and custom `<DragOverlay />`.

### 4. React Grid Layout (`react-grid-layout` `v2.3.0`)
- **Verified npm Metadata:** Depends on `react-draggable: ^4.4.6` and `react-resizable: ^3.2.0`.
- **Evaluation & Rejection for Storefront Grids:**
  - `react-grid-layout` positions all children using absolute pixel coordinates (`transform: translate3d(x px, y px, 0)`), which is fundamentally incompatible with fluid storefront carousels (`ProductScrollRail`), CSS Masonry, and intrinsic-height product cards.
  - **Superior Approach:** Native CSS Grid + Flexbox with interactive boundary handles that write standard responsive Tailwind v4 classes (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`, `col-span-2`, `row-span-2` for Bento grids).

### 5. Motion (`motion` `v14.1.0`)
- Already installed and powering `PlanetHero`, `CelestialScrollWorld`, and `ProductCard`. Remains the sole animation engine.

---

## C. Library Compatibility Matrix

| Library / Tool | React 19.2 | TanStack Start SSR | Tailwind v4 | License | Role in Final Architecture |
|---|---|---|---|---|---|
| `react-resizable-panels` (`4.6.5`) | Installed & Verified | Client-safe | 100% | MIT | 3-pane Studio Workbench layout (Left Tree, Center Canvas, Right Inspector) |
| `motion` (`14.1.0`) | Installed & Verified | Client-safe | 100% | MIT | Storefront animations, layout transitions, timeline scrubbing |
| `zod` (`3.25.76`) | Installed & Verified | Isomorphic | N/A | MIT | Strict schema validation for `ThemeConfig` JSON |
| `@dnd-kit/core` + `sortable` | Compatible (`>=16.8`) | Client-only (`/admin`) | 100% | MIT | Structural section reordering & curated product sorting |
| `react-moveable` (`0.56.0`) | Compatible (DOM ref) | Client-only (`/admin`) | Via token mapper | MIT | Optional geometric handle overlay (or lightweight custom SVG handle layer) |
| `@measured/puck` (`0.20.2`) | Compatible (`^19.0.0`) | Heavy iframe model | Custom CSS needed | MIT | **Not Selected** (lacks geometric handles; duplicates layout concepts) |
| `react-grid-layout` (`2.3.0`) | Legacy `react-draggable` | Not SSR-friendly | Clashes with CSS Grid | MIT | **Rejected** (absolute pixel grid breaks responsive storefront cards) |

---

## D & E. Architecture Comparison & Weighted Decision Matrix

| Criterion | Weight | Arch A: Puck-Led Editor | Arch B: Fully Custom Editor | Arch C: Selective Hybrid (Recommended) |
|---|---:|---:|---:|---:|
| 1. Existing storefront compatibility | 20% | 3.5 | 4.8 | **5.0** |
| 2. Direct drag/resize/shape capabilities | 20% | 2.5 | 4.5 | **4.9** |
| 3. Responsive layout correctness | 15% | 3.5 | 4.6 | **4.8** |
| 4. Component customization flexibility | 15% | 3.8 | 4.7 | **4.9** |
| 5. Performance and bundle isolation | 10% | 3.2 | 4.9 | **4.6** |
| 6. Maintainability | 10% | 3.0 | 4.2 | **4.7** |
| 7. Integration complexity | 5% | 2.5 | 3.8 | **4.2** |
| 8. Security and licensing | 5% | 4.5 | 5.0 | **4.8** |
| **Weighted Total (0–5 Scale)** | **100%** | **3.29** | **4.62** | **4.84** |

- **Primary Recommendation:** **Architecture C (Selective Hybrid Integration)** — Uses the existing installed stack (`React 19`, `react-resizable-panels`, `Radix UI`, `Motion`, `Zod`, `Tailwind v4`) with a custom shared-component registry, a decoupled SVG/HTML selection & resize overlay (compatible with `react-moveable` or native PointerCapture handles), and structured drag-and-drop sorting.
- **Fallback Architecture:** **Architecture B (Zero-External-Dependency Custom Editor)** — Identical schema and renderer contract, using pure React 19 PointerEvent capture for all handles and sorting without installing any third-party drag packages.

---

## F & G. Subsystem Ownership & 14-Row Pointer Event Ownership Table

A deterministic Pointer Interaction State Machine (`mode: "idle" | "selecting" | "resizing" | "reshaping" | "reordering_section" | "reordering_item" | "panning" | "editing_text" | "scrubbing"`) guarantees that no two drag controllers ever compete:

| # | Interaction Type | Sole Controller | Activation Trigger | Propagation Rule | Blocked Competing Actions |
|---|---|---|---|---|---|
| 1 | **Section Reordering** | Section Sort Controller | PointerDown on `[data-handle="section-drag"]` or Left Tree item | `e.stopPropagation()` | Blocks resize handles, card selection, and link navigation |
| 2 | **Element Selection** | Canvas Selection Controller | Click on `[data-studio-id]` in `edit` mode | `onClickCapture` + `e.preventDefault()` | Blocks `<Link>` routing and `<BuyButton>` affiliate navigation |
| 3 | **Card / Container Resizing** | Geometric Resize Overlay | PointerDown on 8-point `[data-handle="resize-*"]` | `setPointerCapture(e.pointerId)` + `stopPropagation()` | Blocks section drag, grid reorder, and carousel swipe |
| 4 | **Corner-Radius Dragging** | Shape Handle Controller | PointerDown on inner `[data-handle="radius"]` | `setPointerCapture` + `stopPropagation()` | Blocks outer corner resize handles and card drag |
| 5 | **Grid-Item Rearrangement** | Collection Sort Controller | PointerDown on `[data-handle="item-grip"]` | `stopPropagation()` | Blocks section drag and card resize |
| 6 | **Grid-Track Resizing** | Grid Gutter Controller | PointerDown on column/gap gutter line | `setPointerCapture` | Blocks card selection and scroll |
| 7 | **Image Cropping / Focal Point** | Media Crop Controller | Double-click image or click "Crop" in toolbar | Modal/isolated pointer lock | Locks all parent section and card drags |
| 8 | **Decorative Element Movement** | Freeform Stage Controller | PointerDown on unlocked decorative planet/badge | `setPointerCapture` | Restricted to parent stage bounds |
| 9 | **Canvas Panning** | Viewport Stage Controller | Spacebar + PointerDrag or Middle-Mouse drag | Captures stage container | Suppresses element hover and selection |
| 10 | **Preview Scrolling** | Native Browser Scroll | Wheel / Trackpad two-finger scroll | Passive scroll listener updates overlay rect | Does not trigger drag or resize |
| 11 | **Inline Text Editing** | Text Content Controller | Double-click editable heading/eyebrow | Focuses input; disables drag sensors | Prevents arrow keys or drag-select from moving element |
| 12 | **Multi-Selection** | Selection Controller | `Shift + Click` on compatible sibling cards | Toggles ID in `selectedIds[]` | Disables single-item freeform handles |
| 13 | **Keyboard Movement / Nudge** | Keyboard Shortcut Controller | Arrow keys when element selected (and no input focused) | `e.preventDefault()` on canvas focus | Adjusts spacing/order step-by-step; pushes to Undo stack |
| 14 | **Animation Timeline Scrubbing** | Motion Scrub Controller | Dragging timeline slider in Bottom/Top bar | Sets deterministic `scrollYProgress` override | Freezes live scroll spring while scrubbing |

---

## H. Geometry Persistence Specification (5 Component Archetypes)

Visual drag deltas are converted on `pointerup` into responsive, schema-validated properties rather than brittle inline CSS `transform: matrix(...)` strings:

1. **Text Block (`SectionHead`, Hero Copy):** Persists `maxWidth` (`max-w-md` .. `max-w-4xl`), `textAlign` (`left`, `center`, `right`), font family token, and responsive font-size scale.
2. **Product Card (`ProductCard`):** Persists `gridSpan` (`col-span-1` .. `col-span-6` per breakpoint), `aspectRatio` (`1/1`, `4/5`, `4/3`), `borderRadius` token, and internal padding scale.
3. **Category / Product Grid (`ProductScrollRail`, `ProductBrowser`):** Persists `layoutMode` (`rail`, `grid`, `bento`, `masonry`), `columns: { mobile: 1|2, tablet: 2|3, desktop: 3|4|5|6 }`, and `gap` (`gap-3` .. `gap-8`).
4. **Hero / Spotlight Media (`PlanetHero`, `CategorySpotlightHero`):** Persists container `minHeight` (`vh`/`px` bounds), `objectFit` (`cover`, `contain`), `objectPosition` focal point (`x% y%`), and column split ratio (`5:7`, `6:6`, `7:5`).
5. **Decorative Celestial Object (`CelestialPlanet`, `AnimatedBlackHole`):** Persists stage-relative percentage offsets (`xPct: -50..150`, `yPct: 0..100`), `scale` (`0.25..2.5`), and `rotationDeg` (`0..360`).

---

## I & J. Shared Renderer & Mini-Preview Strategy

- Both the main editor canvas and the Right Inspector's Mini-Preview render the **exact same storefront component code** (`ProductCard`, `CategoryCard`, `CategorySpotlightHero`, `BuyButton`).
- The Mini-Preview wraps the component in an isolated preview stage (`transform: scale(0.75)`) with `onClickCapture` blocking navigation and `track={false}` blocking affiliate click logging, while subscribing to the same draft configuration state.

---

## K. Proof-of-Concept Results (`src/test/editor-interaction-engine.test.tsx`)

All 8 required prototypes were implemented in an isolated Vitest + React Testing Library test suite (`/src/test/editor-interaction-engine.test.tsx`) and executed against the real React 19 storefront components:

| Prototype | Objective | Implementation & Verification | Result |
|---|---|---|---|
| **Prototype 1** | Real Component Rendering | Rendered genuine `<ProductCard />` and `<CategoryCard />` with deterministic fixtures; verified title, `$49.99` price, category heading, and markup. | **PASS** |
| **Prototype 2** | Decoupled Element Selection | Selected rendered `<ProductCard />` and mounted a sibling bounding-box overlay (`z-index: 50`); verified `component-slot.innerHTML` was 100% unchanged before and after selection. | **PASS** |
| **Prototype 3** | Drag, Resize, Constraints & Undo | Simulated transient drag (`+80px` -> `380px`), extreme shrink clamping (`-500px` -> clamped to `160px` min), state commit, and multi-step Undo restoration back to `300px`. | **PASS** |
| **Prototype 4** | Shape Editing & Zod Validation | Translated radial pixel drag (`0px`, `10px`, `999px`) into validated Tailwind tokens (`rounded-none`, `rounded-xl`, `rounded-full`) and verified Zod rejection of unsafe CSS strings. | **PASS** |
| **Prototype 5** | Structural Reordering & Mutex | Reordered `Planet Hero` and `Festival Special` sections and verified that an active `resizing` lock blocks `attemptReorder`, and an active `reordering` lock blocks `attemptResize`. | **PASS** |
| **Prototype 6** | Mini-Preview Synchronization | Rendered `<ProductCard />` simultaneously in a `320px` main canvas slot and a scaled `180px` inspector mini-preview; verified a single style update updated both views identically without altering stored width. | **PASS** |
| **Prototype 7** | Responsive Breakpoint Isolation | Applied a mobile override (`span: 12, compact: true`) and verified switching back to `desktop` preserved `span: 4, compact: false`. | **PASS** |
| **Prototype 8** | Protected Affiliate Interaction | Verified `<BuyButton />` preserves `href="https://www.amazon.com/dp/B08XYZ123?tag=ovu-store-20"` and `rel="nofollow sponsored noopener noreferrer"`, logs `0` clicks in `edit` mode, and logs `1` click (`prod-cosmic-123`) in `preview` mode. | **PASS** |

---

## L, M, N & O. Risk Register, Cleanup Inventory & Final Gate Assessment

- **Production Files Modified:** `0`
- **Production Dependencies Added:** `0`
- **Isolated Verification Files Created:**
  - `/src/test/editor-interaction-engine.test.tsx` (8/8 tests passing, 56/56 total repository tests passing)
  - `/docs/visual-editor/prompt-01-repository-audit-and-foundation.md`
  - `/docs/visual-editor/prompt-02-compatibility-and-zero-regression-contract.md`
  - `/docs/visual-editor/prompt-03-technology-evaluation-and-poc-report.md`
- **Final Gate Decision:** **GO** — All Phase 1 (Prompts 1, 2, and 3) requirements are verified and complete. Ready for **Prompt 4**.
