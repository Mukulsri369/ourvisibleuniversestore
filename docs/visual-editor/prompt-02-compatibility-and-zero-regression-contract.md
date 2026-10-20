# Visual Storefront Editor — Compatibility & Zero-Regression Contract, Version 1.0

**Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)  
**Phase:** Phase 1, Prompt 2 of 48 — Compatibility Contracts, Zero-Regression Architecture & Safety Rules  
**Status:** Complete & Verified (Analysis & Specification Only)

---

## Deliverable A — Audit Validation Summary

All architectural findings from Prompt 1 were cross-checked directly against the repository source files:

1. **Confirmed Facts:**
   - **Routing & SSR:** TanStack Start (`1.168.60`) + TanStack Router (`1.170.41`) with isomorphic public routes (`/_store.*`) and client-only admin routes (`/_admin.*`, `ssr: false` in `/src/routes/_admin.tsx:21`).
   - **Data Queries:** Public storefront reads use session-less `publicDb()` (`/src/lib/store.ts:17-44`) querying `products`, `categories`, and the `public_site_settings` view (`id = 1`).
   - **Multi-Category Architecture:** Products store atomic membership in `category_ids: string[]` while mirroring the primary category to `category_id` (`/src/lib/product-categories.ts`).
   - **Affiliate Passthrough:** `<BuyButton />` (`/src/components/store/BuyButton.tsx:10-50`) renders `href={url}` untouched (`affiliate_url ?? amazon_url`) with `rel="nofollow sponsored noopener noreferrer"` and non-blocking `logOutboundClick(productId)`.
   - **Site Settings JSONB:** `site_settings.social_links` stores `festival_special`, `category_spotlights`, and `approved_admins`.

2. **Discovered Compatibility Nuance (Festival Curation vs. Client Shuffling):**
   - `fetchFestivalProducts()` (`/src/lib/store.ts:291-297`) preserves the exact admin-curated order of `product_ids` configured in `/src/routes/_admin.admin.festival.tsx`.
   - However, `/src/routes/_store.index.tsx:86-91` runs `shuffleArray(home.festival)` inside a client `useEffect` on hydration, which overrides the curated order.
   - **Controlled Remediation Contract:** Remains untouched during Phase 1; in Phase 2+, each collection section will expose an explicit `sort_mode: "curated" | "shuffle" | "newest"` property (defaulting `festival_special` to `"curated"` when custom IDs exist).

---

## Deliverable B — Storefront Invariants & Fundamental Compatibility Contract

Before any administrator edits a page, or when no published visual configuration exists, the storefront must obey 12 strict invariants:

1. **Invariant 1 (Section Order & Visibility):** Default homepage order must remain: `CelestialScrollWorld` -> `PlanetHero` -> `Festival Special` (if `enabled !== false`) -> `Featured` rail -> `New arrivals` rail -> Progressive Category Spotlights & Rails -> `Explore by interest` -> `Why shop with us` -> `Follow our journey (Instagram)`.
2. **Invariant 2 (Container Geometry):** Standard content sections use `mx-auto max-w-7xl px-4 sm:px-6`.
3. **Invariant 3 (Typography):** Display headings use `--font-display` (`Instrument Serif`), body uses `--font-sans` (`Manrope`), and telemetry/kickers use `--font-mono` (`JetBrains Mono`).
4. **Invariant 4 (Cosmic Theme Tokens):** Root OKLCH tokens in `/src/styles.css:63-115` (`--background`, `--card`, `--primary`, `--accent`, `--border`) remain unchanged by default.
5. **Invariant 5 (Planet Hero Lifecycle):** `<PlanetHero />` preloads the Earth poster with `fetchPriority="high"`, lazy-loads video clips on planet activation, and pauses playback when offscreen, hidden, or under `prefers-reduced-motion`.
6. **Invariant 6 (Celestial Scroll Physics):** `<CelestialScrollWorld />` defers rendering until client mount (`mounted === true`) and drives Earth, Venus, and Mars transforms via `useScroll()` + `useSpring()`.
7. **Invariant 7 (Affiliate Link Integrity):** Visual edits to buttons or cards never alter `product.affiliate_url`, `product.amazon_url`, `rel` attributes, or `logOutboundClick` behavior on the public site.
8. **Invariant 8 (Database & Catalog Integrity):** Visual layout operations never write to `products`, `product_images`, `product_tags`, `product_features`, or `categories` rows unless the admin explicitly saves a collection curation order.
9. **Invariant 9 (Draft Isolation):** Unpublished draft changes never appear to anonymous visitors querying `public_site_settings`.
10. **Invariant 10 (Responsive Cascade):** Desktop edits never break mobile (`<640px`) or tablet (`768px`/`1024px`) layouts.
11. **Invariant 11 (Admin Security):** All editor routes and write operations remain gated by Supabase authentication and `is_admin()` RLS policies.
12. **Invariant 12 (Progressive Category Loading):** The `IntersectionObserver` sentinel in `/src/routes/_store.index.tsx:120-145` continues revealing category rails progressively so initial DOM weight stays bounded.

---

## Deliverable C — Component Compatibility Contract Matrix (All 20 Storefront Components)

| 1. Component | 2. Source File | 3. Current Purpose | 4. Business/Data Dependencies | 5. Protected Internal Behavior | 6. Proposed Editable Properties | 7. Allowed Drag/Resize Operations | 8. Responsive Constraints | 9. Animation Constraints | 10. Required Regression Tests | 11. Risk | 12. Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `PlanetHero` | `src/components/store/PlanetHero.tsx` | Full-viewport planetary video hero | `PLANETS` (`src/lib/planets.ts`), video/poster CDN assets | Video ref cleanup, `IntersectionObserver`, `visibilitychange` pause, reduced-motion guard | Eyebrow, brand title, planet descriptions, CTA labels/styles, default featured planet, min-height, overlay shade | Section reorder; vertical height/padding resize | Uses fluid `clamp()` typography & mobile stacked controls in `styles.css` | `AnimatePresence` title mask & video play/pause must not unmount on style edit | `planets.test.ts`, hero render & reduced-motion tests | Medium | P1 (Core) |
| `CelestialScrollWorld` | `src/components/store/CelestialScrollWorld.tsx` | Fixed scroll-linked orbital planet stage | `earthCutout`, `venusCutout`, `marsCutout`, `useScroll` | Client mount gate (`if (!mounted) return null`), spring physics (`stiffness: 70, damping: 24`) | Visibility toggle, active planets, aura/rim colors, telemetry copy, planet scale multiplier | Decorative scale & trajectory offset tuning only | Hides side telemetry on narrow viewports; scales down planet diameter | Must pause/scrub cleanly when editor is in static layout mode | Scroll transform mount test, SSR hydration check | Medium | P2 |
| `CelestialPlanet` | `src/components/store/CelestialPlanet.tsx` | Renders individual orbiting planet & HUD | `CelestialPlanetConfig`, search link (`to="/search"`) | Search navigation query binding (`q: config.telemetry.query`) | Aura glow intensity, rim lighting color, HUD badge border radius & glass opacity | Resize planet diameter within `[120px, 520px]` bounds | Scales proportionally across `sm`/`md`/`lg` | Preserves CSS rotation & pulse keyframes | Telemetry link & cutout fallback test | Low | P2 |
| `ProductScrollRail` | `src/components/store/ProductScrollRail.tsx` | Horizontal snap carousel of product cards | `ProductCardData[]`, `ProductQuickPreviewModal` | `ResizeObserver` overflow detection, scroll step math, quick-preview modal state | Title, eyebrow, layout mode (`rail`, `grid`, `bento`, `masonry`), gap, card size, `festive` variant, padding | Section reorder; container width & vertical padding resize | Mobile 3-up compact cards (`w-[calc((100vw-50px)/3)]`) vs desktop 6-up | Smooth scroll stepping & hover elevation preserved | Rail render, empty guard (`items.length === 0`), quick preview test | Low | P1 (Core) |
| `CategorySpotlightHero` | `src/components/store/CategorySpotlightHero.tsx` | Featured product spotlight banner per category | `ProductCardData`, `categoryName`, `categorySlug`, `sectorLore` | Expand/collapse description toggle, quick-view modal trigger, product/category links | Image aspect ratio, column split (5/7 vs 6/6), background gradient, border radius, shadow, typography | Resize container padding, image column ratio, corner radius | Stacks 1-col on mobile (`grid-cols-1`), 12-col split on `lg:grid-cols-12` | Image hover scale (`group-hover:scale-105`) preserved | Spotlight resolution & expand/collapse test | Low | P1 (Core) |
| `ProductCard` | `src/components/store/ProductCard.tsx` | Individual product card (standard & compact) | `ProductCardData`, `formatPrice`, `BuyButton` | Multi-image hover scrub index, `BuyButton` affiliate URL & click logging, slug routing | Card border radius, background opacity, border glow, aspect ratio (`1/1`, `4/5`, `4/3`), typography scale, badge visibility | Grid item reorder; card span resize (`col-span-*`); corner radius handle | Compact mode enforces 3-per-row mobile geometry unless overridden by grid mode | `AnimatePresence` image crossfade (`duration: 0.2`) preserved | `editor-interaction-engine.test.tsx`, `affiliate-links.test.ts` | High | P1 (Core) |
| `CategoryCard` | `src/components/store/CategoryCard.tsx` | Category navigation tile | `Category` row (`id`, `name`, `slug`, `description`, `image_url`) | Slug link (`to="/category/$slug"`), icon fallback lookup (`ICONS[c.slug]`) | Min-height (`min-h-48`), corner radius, image overlay opacity, icon color/size, title typography | Grid item reorder; card span & min-height resize; corner radius handle | Responsive grid track sizing (`sm:grid-cols-2 lg:grid-cols-3`) | Image zoom (`group-hover:scale-105`) & arrow translate preserved | Category card render & link destination test | Low | P1 (Core) |
| `BuyButton` | `src/components/store/BuyButton.tsx` | Affiliate outbound purchase CTA | `productId`, `url`, `logOutboundClick` | Exact `href={url}` passthrough, `target="_blank"`, `rel="nofollow sponsored noopener noreferrer"`, click tracker | Button label text (`Buy now` / `Buy`), size (`sm`, `lg`, `xl`), border radius, gradient fill, glow shadow | Padding & corner radius adjustments only (no freeform drag out of card) | Adjusts height (`h-7 sm:h-8` vs `h-11`) across breakpoints | Hover brightness transition | `affiliate-links.test.ts`, Prototype 8 click-capture test | Critical | P1 (Core) |
| `ProductQuickPreviewModal` | `src/components/store/ProductQuickPreviewModal.tsx` | Quick-view product lightbox dialog | `productQuery(slug)`, `BuyButton`, Escape/Arrow key listeners | Body scroll lock (`document.body.style.overflow = "hidden"`), keyboard listeners, full gallery fetch | Modal border radius, backdrop blur intensity, accent border color | Not draggable on canvas; editable via Inspector modal preview | Scrollable vertical sheet on mobile, 2-column dialog on `md` | Fade/zoom entrance animation | Modal open/close & Escape key cleanup test | Low | P3 |
| `ProductDetailView` | `src/components/store/ProductDetailView.tsx` | Full `/product/$slug` detail page | `ProductFull`, `relatedQuery`, `BuyButton` | Breadcrumb hierarchy, multi-category badges, affiliate disclosure callout, outbound click tracking | Gallery aspect ratio, feature list card style, CTA prominence, related products layout | Template-level section spacing & gallery width ratio | 1-col mobile, 2-col `lg:grid-cols-12` desktop | Gallery thumbnail active ring transition | Product detail route & SEO metadata test | Medium | P3 |
| `ProductBrowser` | `src/components/store/ProductBrowser.tsx` | Search/Shop/Category filterable product grid | `listProducts`, `categoriesQuery`, URL search params (`q`, `category`, `sort`, `page`) | URL search parameter validation (`validateBrowseSearch`), pagination math | Grid column count (`2`, `3`, `4`), card gap, filter bar glass styling | Grid column/gap handles | Collapses sidebar/pills on mobile, multi-col grid on desktop | Smooth filter transition | `product-categories.test.tsx`, search filter test | Medium | P2 |
| `StoreHeader` | `src/components/store/StoreChrome.tsx` | Sticky top navigation & search bar | `settingsQuery`, `categoriesQuery`, `SearchBox` | Search form submission to `/search`, category links, mobile menu drawer state | Sticky toggle, header height, backdrop blur, logo size, search input corner radius, nav link spacing | Header height & horizontal padding resize | Hides desktop `<nav>` below `lg`; toggles mobile drawer | Dropdown opacity/visibility transition | Header navigation & search submit test | Medium | P2 |
| `StoreFooter` | `src/components/store/StoreChrome.tsx` | Storefront footer & affiliate disclosure | `settingsQuery` (`footer_text`, `affiliate_disclosure`, `instagram_url`) | Legal page links (`/privacy`, `/terms`, `/affiliate-disclosure`) and FTC disclosure visibility | Background tint, border color, column gap, footer text typography, social button style | Vertical padding resize | 1-col mobile, 4-col `md:grid-cols-4` desktop | None | Footer legal disclosure presence test | Low | P2 |
| `GalaxyScene` | `src/components/store/GalaxyScene.tsx` | Three.js particle galaxy background | Dynamic `import("three")`, `IntersectionObserver` | Post-mount dynamic import, bounded particle count, WebGL disposal on unmount, offscreen pause | Particle tint colors (`--galaxy-core`, `--galaxy-dust`, `--galaxy-blue`), opacity | Container height resize | Scales canvas to parent clientWidth/clientHeight | Must pause when offscreen or in reduced-motion mode | SSR mount safety & disposal test | Medium | P3 |
| `AnimatedBlackHole` | `src/components/store/AnimatedBlackHole.tsx` | Decorative accretion disk visualizer | CSS/SVG radial gradients & motion keyframes | Reduced-motion compliance, pointer-events-none | Accretion disk colors, size, glow intensity, opacity | Freeform position & uniform scale within parent stage | Scales down on `<640px` viewports | Respects editor animation pause toggle | Render & reduced-motion test | Low | P3 |
| `SpaceLaserLine` | `src/components/store/SpaceLaserLine.tsx` | Futuristic section divider with telemetry label | `label`, `coordinates`, `color` props | Semantic decorative separator (`aria-hidden`) | Line color, glow intensity, label typography, vertical margin | Vertical margin resize; section reorder | Truncates long coordinate strings on mobile | Subtle scanline pulse | Divider render test | Low | P3 |
| `CategoryFullBackground` | `src/components/store/CategoryFullBackground.tsx` | Ambient category page celestial backdrop | `CelestialSystemConfig` (`src/lib/celestial-catalog.ts`) | Pointer-events-none fixed/absolute layering (`z-0`) | Corona glow opacity, starfield density, planet cutout scale | Planet offset & scale within background layer | Responsive viewport clipping (`overflow-hidden`) | Orbiting moon CSS animations pauseable in editor | `celestial-catalog.test.ts` | Low | P3 |
| `CategoryQualityBento` | `src/components/store/CategoryQualityBento.tsx` | Bento grid highlighting category quality pillars | Category metadata & curated highlights | Semantic heading structure | Bento card spans, border radii, glass tint, icon accent colors | Bento cell span drag handles (`col-span`, `row-span`) | 1-col mobile, 3-col bento on `md`+ | Card hover glow | Bento layout render test | Low | P2 |
| `CategoryCelestialWorld` | `src/components/store/CategoryCelestialWorld.tsx` | Interactive planetary system showcase for categories | `CelestialSystemConfig`, moon definitions | Moon orbital math & telemetry readout | Planet primary/corona colors, ring visibility, telemetry card opacity | Planet scale handle | Stacks telemetry below planet on mobile | Orbit duration & reduced-motion guard | `celestial-catalog.test.ts` | Low | P3 |
| `Pagination` / `EmptyState` / `StaticPage` | `src/components/store/Pagination.tsx`, `StaticPage.tsx` | Shared pagination controls, empty states, and legal page wrapper | Route search params, prose content | Page index bounds checking | Button pill radius, empty state border/glass style, prose max-width | Container width & padding resize | Wraps page buttons on narrow viewports | None | Pagination boundary & empty state render tests | Low | P3 |

---

## Deliverable D — Single-Source-of-Truth Rendering Contract

### Three-Layer Architecture
1. **Layer 1 — Storefront Component Renderer:** Executes the genuine storefront components (`PlanetHero`, `ProductScrollRail`, `ProductCard`, etc.). Layer 1 components accept optional, backward-compatible style/config props (defaulting to current production values when omitted).
2. **Layer 2 — Validated Page Configuration:** A Zod-validated `ThemeConfig` JSON document stored in `site_settings.social_links.theme_published` (for public visitors) and `theme_draft` (for the admin studio).
3. **Layer 3 — Editor Interaction Overlay:** Mounted **exclusively** inside `/_admin/admin/editor`. Computes target element coordinates via `data-studio-id` attributes and `ResizeObserver` / `getBoundingClientRect()`, rendering selection boxes, 8-point resize handles, and alignment guides in a sibling overlay layer (`position: absolute; inset: 0; pointer-events: none; z-index: 50`) without inserting wrapper divs that could break Flexbox or CSS Grid layouts.

---

## Deliverable E — Safe Drag-and-Drop, Resizing & Shape Editing Contracts

| Interaction Type | 1. Draggable Target | 2. Visual Handles | 3. Config Property Mutated | 4. Valid Drop Targets | 5. Responsive Preservation | 6. Conflict Resolution | 7. Undo/Redo Restoration | 8. Data Scope Impact |
|---|---|---|---|---|---|---|---|---|
| **1. Section Dragging** | Top-level homepage section (`ThemeSection`) | Dedicated grip handle on section header bar or Left Outline Tree | `sections[]` array order | Root page section stack (between unlocked sections) | Sections retain fluid width & internal responsive breakpoints | Locks out resize & card drag via pointer mutex | Restores previous `sections[]` array snapshot | Presentation order only |
| **2. Grid Item Dragging** | `ProductCard` or `CategoryCard` inside a collection | Card reorder grip handle | Curated `product_ids[]` or `categories.sort_order` | Sibling slots within the same collection container | Grid tracks auto-flow across mobile/tablet/desktop | Intercepts `<a>` click navigation during drag | Restores previous ID array sequence | Collection configuration order only |
| **3. Nested Container Dragging** | Configurable content blocks (badges, callouts, CTAs) | Block header drag handle | Parent container `blocks[]` array | Compatible dropzones declared in parent schema | Uses flex/grid order rather than pixel offsets | Rejects drop into incompatible containers with visual shake | Restores parent/child block tree | Presentation structure only |
| **4. Element Resizing** | Sections, cards, spotlight containers, images | 8-point edge & corner handles (`n, s, e, w, ne, nw, se, sw`) | Normalized width token (`max-w-*`), `grid_span`, `aspect_ratio`, or clamped `padding_y` | Self (in-place geometric constraint update) | Converts pixel delta to breakpoint-scoped responsive token | Disables `dnd-kit` sorting while resize handle is captured | Commits single history entry on `pointerup` | Presentation geometry only |
| **5. Shape Editing** | Cards, buttons, banners, spotlight images | Inner corner radial handle (`roundable`) or Inspector slider | `border_radius` token (`rounded-none` .. `rounded-full` or clamped px) | Self | Border radius scales safely across all viewports | Stops event propagation to parent resize handles | Restores prior `border_radius` token | Presentation styling only |
| **6. Freeform Positioning** | Explicitly designated decorative elements (planets, badges) | 2D move crosshair & rotation handle | Percentage coordinates (`x_pct`, `y_pct`, `scale`, `rotate_deg`) | Parent `freeform-stage` container bounds | Stored as `%` of stage width/height so mobile never overflows | Restricted strictly to opt-in freeform stages | Restores prior `%` coordinates | Presentation decoration only |
| **7. Layout-Aware Positioning** | Standard sections, grids, bento cells, flex rows | Alignment & grid-track gutter handles | `justify`, `align`, `gap`, `columns`, `col_span`, `row_span` | Parent CSS Grid / Flexbox layout | Generates responsive Tailwind/CSS Grid definitions per breakpoint | Prevents overlapping grid cells via auto-placement | Restores prior layout config object | Presentation layout only |
| **8. Animation Manipulation** | Orbiting planets (`CelestialScrollWorld`) & hero backdrops | Trajectory anchor handles & timeline scrubber | `orbit_scale`, `aura_color`, `scroll_keyframes` | Parent celestial stage | Clamps orbital excursion within `[0vw, 100vw]` | Pauses runtime scroll spring while dragging anchor | Restores default orbital parameters | Presentation motion config only |

---

## Deliverable F — Product & Category Data Protection Specification

1. **Strict Three-Tier Separation:**
   - **Presentation Tier (Editor-Owned):** Colors, fonts, radii, grid mode (`rail`, `grid`, `bento`, `masonry`), card spans, padding, shadows. Stored in `theme_draft` / `theme_published`.
   - **Collection Configuration Tier (Shared Admin Config):** Which category or curated `product_ids` a section displays, plus `sort_mode`.
   - **Core Business Entity Tier (Read-Only in Visual Canvas):** `products.id`, `products.name`, `products.price`, `products.currency`, `products.affiliate_url`, `products.amazon_url`, `products.category_ids`, `categories.id`, `categories.slug`.
2. **Formal Invariants:**
   - Resizing, restyling, or hiding a `ProductCard` in the editor **never** issues an `UPDATE` or `DELETE` to the `products` table.
   - Editing button styles on `<BuyButton />` **never** overwrites the product's stored affiliate URL.

---

## Deliverable G — Mini-Preview Requirements

1. **Shared Component Execution:** The Right Inspector's live mini-preview renders the **exact same React component** (`<ProductCard />`, `<CategoryCard />`, `<CategorySpotlightHero />`, `<BuyButton />`) bound to the currently selected item's draft configuration.
2. **Dimensional & Event Isolation:**
   - Wrapped in an isolated preview stage (`transform: scale(...)`, `transform-origin: top left`) so preview container dimensions never mutate stored design widths.
   - Wrapped in an `onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}` boundary and `track={false}` on `<BuyButton />` so interacting with the mini-preview never navigates away or logs false clicks in `outbound_clicks`.
3. **Performance Guard:** Uses `useDeferredValue` and static posters for video/WebGL backdrops inside the miniature frame.

---

## Deliverable H — Exact Landing-Page Parity & Responsive Requirements

1. **14-Point Visual Parity Contract:** When rendering the default published configuration at any viewport, the editor canvas (in Preview Mode) and the public `/` route must match across: (1) section vertical positions, (2) element widths/heights, (3) margins/padding, (4) grid columns/rows, (5) text wrapping, (6) font families/weights, (7) image cropping (`object-cover`), (8) background colors/gradients, (9) borders/corners/shadows, (10) conditional visibility, (11) responsive breakpoint transitions, (12) deterministic initial animation frame, (13) sticky header behavior, and (14) quick-preview modal behavior.
2. **Required Viewport Test Matrix:**
   - `360px × 740px` (Compact Mobile — base styles)
   - `390px × 844px` (Standard Mobile — base styles)
   - `768px × 1024px` (Tablet Portrait — Tailwind `md:` `>=768px`)
   - `1024px × 768px` (Tablet Landscape / Small Desktop — Tailwind `lg:` `>=1024px`)
   - `1440px × 900px` (Standard Desktop — Tailwind `xl:` `>=1280px`)
   - `1920px × 1080px` (Widescreen — Tailwind `2xl:` `>=1536px`)
3. **Deterministic Comparison Thresholds:**
   - Freeze animations (`prefers-reduced-motion: reduce` or explicit editor pause), lock product shuffle seed, and enforce `scrollbar-gutter: stable`.
   - Acceptance threshold: Structural Similarity Index **SSIM $\ge 0.995$** and pixel diff **$\le 0.1\%$** (accounting for GPU subpixel anti-aliasing).

---

## Deliverable I — Animation Preservation Specification

1. **Single Motion Engine:** Retain `motion/react` (`v14.1.0`) and existing Three.js dynamic imports (`GalaxyScene.tsx`). Do not add GSAP or anime.js.
2. **Four-Layer Transform Separation:**
   - **Base Layout Position:** CSS Grid/Flexbox flow.
   - **Committed Geometry Override:** Responsive CSS variables/classes applied to the outer slot.
   - **Transient Editor Drag Delta:** Applied strictly to the sibling overlay box during pointer drag, committed only on `pointerup`.
   - **Runtime Animation Transform:** Owned exclusively by `motion.div` / `PlanetHero` / `CelestialScrollWorld` inside the component.
3. **Editor Pause / Play / Scrub Control:** The editor toolbar provides a global `AnimationState: "playing" | "paused" | "scrubbing"` context so administrators can freeze moving planets or video backdrops while aligning elements.

---

## Deliverable J — Security & Configuration Validation Specification

All saved theme configurations are validated with **Zod** (`src/lib/theme-schema.ts` in Phase 2) enforcing all 15 safety checks:
1. Unique component/section IDs (duplicate ID rejection).
2. Whitelisted component `type` discriminated union.
3. Validated parent-child nesting rules.
4. Clamped numeric size bounds (e.g., padding `0..240px`, columns `1..12`).
5. Allowed CSS units (`px`, `rem`, `%`, `vh`, `vw`, `auto`).
6. Grid column/row span limits (`1 <= col_span <= columns`).
7. Validated shape/radius tokens (`rounded-none` .. `rounded-full`).
8. Verified asset references (`/api/public/img/*` or approved HTTPS media origins).
9. Safe URL protocol enforcement (`https:` or relative `/`; `javascript:`, `data:`, `vbscript:` strictly rejected).
10. Breakpoint override structure (`desktop`, `tablet`, `mobile`).
11. Bounded animation speed/scale multipliers (`0.1 <= speed <= 3.0`).
12. Acyclic tree check (maximum nesting depth $\le 6$, zero circular references).
13. Graceful fallback for missing/deleted products or categories.
14. Explicit schema `version: "1.0.0"` field for forward migration.
15. Automatic stripping of unknown/deprecated keys and prohibition of raw `<script>` or unfiltered `<style>` injection.

---

## Deliverable K — Draft, Preview, Publishing & Rollback Isolation Model

1. **Five Isolated States in `site_settings.social_links`:**
   - `theme_published`: Read by live customers via `public_site_settings`.
   - `theme_draft`: Written by admin auto-save and manual "Save Draft" inside `/admin/editor`.
   - `theme_preview_snapshot`: Ephemeral admin preview state.
   - `theme_candidate`: Validated payload undergoing atomic publish check.
   - `theme_revisions`: Bounded ring-buffer (last 20 published versions with `version_id`, `published_at`, `published_by`, `label`, and full `config` snapshot) for one-click rollback.
2. **Optimistic Concurrency Control:** Saving or publishing compares `base_updated_at` against the database row to prevent two administrators from silently overwriting each other's work.

---

## Deliverable L — Regression Testing Contract

All implementation turns (Prompts 4–48) must maintain:
- **Unit Tests (`vitest`):** Schema validation, responsive cascade resolution, geometry clamping, undo/redo stack, retailer price & currency parsers, affiliate URL normalization.
- **Integration Tests:** Component registry rendering real `ProductCard`, `CategoryCard`, `PlanetHero`, and `ProductScrollRail` with deterministic fixtures; draft vs. published state isolation.
- **Functional & Security Regression Tests:** Verify `<BuyButton />` preserves affiliate URLs and `logOutboundClick` in preview/live mode while blocking navigation in edit mode; verify `/_admin` auth gate.
- **Performance Gates:** 60fps (`<16.6ms` frame budget) during handle drag by isolating pointer move state to the overlay layer and committing layout updates on `pointerup`.

---

## Deliverable M — Risk Register & Fallback Strategies

| Failure Mode / Risk | Severity | Source Location | Automated Fallback & Recovery Strategy |
|---|---|---|---|
| Missing or `null` theme config in DB | Low | `_store.index.tsx`, `store.ts` | Render default hardcoded homepage layout with zero visual change. |
| Corrupted or invalid JSON in `theme_published` | High | `site_settings.social_links` | `themeConfigSchema.safeParse()` fails closed; storefront renders last valid snapshot or default layout. |
| Deleted product referenced in spotlight/rail | Medium | `_store.index.tsx:254-262` | Filter out missing IDs (`products.filter(Boolean)`); fallback to top featured product in category. |
| Broken custom image URL | Low | `ProductCard.tsx:21-38` | `onError` handler automatically renders cosmic `<Telescope />` nebula placeholder. |
| SSR Hydration mismatch on scroll/video | High | `CelestialScrollWorld.tsx:68`, `PlanetHero.tsx:85` | Preserve client `mounted` gate and `suppressHydrationWarning` on media elements. |
| Concurrent admin edit conflict | Medium | `_admin.admin.settings.tsx` | Compare `updated_at` timestamp before write; prompt admin to reload or overwrite. |

---

## Deliverable N — 16-Point Change Control Policy (Development Guardrails for Prompts 3–48)

Every implementation prompt in Phases 2–8 must obey all 16 rules:
1. Inspect all target files with `view_file` before editing.
2. Identify all downstream dependent components before changing any shared prop.
3. Explicitly list which protected behaviors (Section 3) touch the modified code.
4. Make minimal, surgical, backward-compatible edits.
5. Default all new optional props to existing visual appearances.
6. Route all visual editor rendering through the single shared component renderer.
7. Never duplicate product queries, price formatting, or affiliate link logic.
8. Maintain zero TypeScript errors (`tsc --noEmit` / `compile_applet`).
9. Execute the Vitest regression suite (`npx vitest run`) after code changes.
10. Verify both public (`/_store`) and admin (`/_admin`) route trees mount cleanly.
11. Verify responsive behavior across mobile, tablet, and desktop breakpoints.
12. Report any new console warnings or test failures transparently.
13. Provide an exact inventory of modified and created files at the end of each turn.
14. Document any data migration or fallback logic.
15. Never mark incomplete functionality as complete.
16. Never claim visual or runtime verification without executing the check.

---

## Deliverable O — Phase Completion Assessment & Verdict

- **Audit & Compatibility Specification Status:** 100% Complete.
- **Source Code / Database Modification Check:** Zero production files or database schemas modified.
- **Gate Decision:** **GO** — Ready for Prompt 3 (Technology Evaluation & Proof of Concept) and subsequent phases.
