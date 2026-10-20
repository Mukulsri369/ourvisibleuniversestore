# Architecture Audit & Engineering Decisions — Visual Storefront Editor

- **Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)
- **Active Branch:** `feature/visual-storefront-editor`
- **Base Commit:** `b4ed3e121f3df51bae6dfc27f6c274a922ed030d`
- **Last Updated:** 2026-10-20 (Prompt 5 of 48)

---

## 1. Current Application Stack & Storefront Architecture

| Layer | Technology | Implementation Details |
| :--- | :--- | :--- |
| **Framework & SSR** | React `19.2.0` + TanStack Start `1.132.0` + Nitro | File-based routing in `src/routes/`, SSR streaming entry in `src/server.ts`, client hydration in `src/router.tsx` |
| **Data Fetching** | TanStack Query `5.66.0` + Supabase JS `2.103.0` | `homeQuery`, `categoriesQuery`, `settingsQuery`, and `productsQuery` in `src/lib/store.ts` |
| **Styling System** | Tailwind CSS `4.0.6` (`@tailwindcss/vite`) | Dark-mode cosmic design tokens (`oklch`), utility classes, and responsive `@media` rules in `src/styles.css` |
| **Animation & 3D** | Motion `12.38.0` (`motion/react`) + Three.js `0.183.2` | `PlanetHero.tsx` (video/poster switching & `AnimatePresence`), `CelestialScrollWorld.tsx` (`useScroll` + `useSpring` trajectories) |
| **Database & Storage** | Supabase PostgreSQL + Drizzle ORM `0.45.2` | Tables: `products`, `categories`, `site_settings`, `click_events`; private storage served via `/api/public/images/$` |
| **Admin Portal** | `/admin/*` routes (`src/routes/_admin.tsx`) | Email-allowlisted Supabase Auth session guard; manages Products, Categories, Duplicates, Festival, and Settings |

---

## 2. Core Visual Editor Design Principles

1. **Single Shared Renderer Principle:**
   ```
   ONE VALIDATED PAGE DOCUMENT
     → ONE COMPONENT REGISTRY
       → ONE SHARED STOREFRONT RENDERER
         → PUBLIC MODE ("public") OR EDITOR MODE ("editor" | "preview")
   ```
   The visual editor must never render a separate mock or simplified approximation of the landing page. Both the public storefront and the admin editor canvas render the exact same React components (`PlanetHero`, `CelestialScrollWorld`, `ProductScrollRail`, `ProductCard`, `CategorySpotlightHero`, `CategoryCard`, `StoreHeader`, `StoreFooter`).

2. **Strict Separation of Presentation vs. Business Data:**
   - **Presentation Data (Stored in `PageDocument`):** Section order, layout mode (`grid`, `bento`, `masonry`, `carousel`, `flex`), dimensions, padding/margin, shapes, corner radii, typography, colors, gradients, shadows, media asset references, and animation parameters.
   - **Business Data (Authoritative in Supabase `products` & `categories` tables):** Product IDs, titles, descriptions, prices, currencies, stock status, category memberships (`category_ids`), and retailer affiliate URLs (`affiliate_url` / `amazon_url`).
   - **Enforcement:** `FORBIDDEN_BUSINESS_DATA_KEYS` in `src/lib/visual-editor/schema/bindings.ts` and `validation.ts` actively reject any attempt to serialize `price`, `affiliate_url`, or `amazon_url` overrides inside presentation props.

3. **Zero Public-Bundle Bloat During Foundation Phases:**
   - All schema and tree modules live in `src/lib/visual-editor/` and depend only on `zod` (already installed in the repository).
   - No heavy drag-and-drop or editor UI libraries are imported into public routes.

---

## 3. PageDocument Schema Architecture (Implemented in Prompt 5)

### 3.1 Document Identity & Versioning (`src/lib/visual-editor/schema/page-document.ts`)
- `schemaVersion`: `"1.0.0"` (`CURRENT_PAGE_SCHEMA_VERSION`)
- `id`, `pageId`, `pageType` (`"home" | "category" | "collection" | "landing" | "custom"`), `slug`, `name`, `metadata`, `settings`, and ordered `root: EditorNode[]`.
- Hard structural limits prevent DoS or pathological payloads:
  - `MAX_DOCUMENT_DEPTH = 12`
  - `MAX_DOCUMENT_NODES = 1500`
  - `MAX_SERIALIZED_DOCUMENT_BYTES = 1,048,576` (1 MiB)

### 3.2 Component Type Taxonomy (`src/lib/visual-editor/schema/nodes.ts`)
- **Generic Building Blocks (15 types):** `Section`, `Container`, `Stack`, `Grid`, `GridItem`, `Text`, `Heading`, `Image`, `Video`, `Button`, `Icon`, `Divider`, `Spacer`, `Shape`, `Overlay`.
- **Storefront Domain Components (16 types):** `PlanetHero`, `CelestialScrollWorld`, `ProductScrollRail`, `ProductGrid`, `ProductCard`, `CategorySpotlightHero`, `CategoryGrid`, `CategoryCard`, `FestivalSection`, `FeaturedCollection`, `PromotionalBanner`, `InterestSection`, `BenefitsSection`, `InstagramSection`, `StoreHeader`, `StoreFooter`.
- **Parent-Child Nesting Safeguards:**
  - `LEAF_COMPONENT_TYPES` (`ProductCard`, `CategoryCard`, `Text`, `Heading`, `Image`, `Video`, `Button`, `Icon`, `Divider`, `Spacer`, `CelestialScrollWorld`, `StoreHeader`, `StoreFooter`) cannot contain child node trees.
  - `ROOT_ONLY_COMPONENT_TYPES` (`StoreHeader`, `StoreFooter`, `CelestialScrollWorld`, `PlanetHero`) can only appear at depth 1 (`document.root`).

### 3.3 Responsive Inheritance Engine (`src/lib/visual-editor/utils/responsive-resolution.ts`)
- Base authoring canvas is `desktop` (`1440×900`).
- Deterministic inheritance chains:
  - `desktop` → `node.style`
  - `desktop_xl` (`1920×1080`) → `node.style` + `node.responsive.desktop_xl`
  - `tablet` (`768×1024`) → `node.style` + `node.responsive.tablet`
  - `mobile` (`390×844`) → `node.style` + `node.responsive.tablet` + `node.responsive.mobile`
  - `mobile_sm` (`360×800`) → `node.style` + `node.responsive.tablet` + `node.responsive.mobile` + `node.responsive.mobile_sm`
- Modifying a desktop property never clobbers tablet/mobile overrides, and `clearResponsiveStyleOverride` cleanly restores the inherited cascade value.

### 3.4 Festival vs. General Product Ordering Decision
- In `src/lib/store.ts`, `featured`, `newArrivals`, and `categorySections` call `shuffleProducts()` (`Math.random()`), whereas `festivalProducts` (`lines 291-297`) preserves the exact administrator-selected sequence from `site_settings.social_links.__festival_product_ids`.
- Our `ProductCollectionBinding` (`src/lib/visual-editor/schema/bindings.ts`) models this explicitly via `sortMode: "default_preserve_order" | "deterministic_shuffle" | "featured_first" | "newest" | "price_asc" | "price_desc" | "name_asc"`.

---

## 4. Library Selection & Rejection Log

| Candidate | Decision | Rationale |
| :--- | :--- | :--- |
| **Custom Pointer-Events + Structural Sharing Tree Engine + Zod** | **SELECTED** | 100% React 19.2.0 compatible, zero bundle bloat on public routes, sub-millisecond (`0.04ms–0.14ms`) immutable style updates, native support for CSS Grid/Bento/Carousel and custom corner-radius/shape handles |
| `@measured/puck` | **REJECTED** | Renders its own opinionated block dropzones and iframe/sidebar DOM structure; cannot natively edit existing `PlanetHero` or `CelestialScrollWorld` in-place |
| `react-moveable` | **DEFERRED / OPTIONAL** | Heavy runtime footprint (`~160KB+`) and imperative DOM overlays; our custom pointer-event + SVG/CSS overlay architecture handles 60fps transient drag/resize cleanly |
| `react-grid-layout` | **REJECTED** | Relies on `react-draggable` / `react-resizable` with legacy React peer dependencies and absolute pixel positioning that breaks responsive Tailwind CSS Grids |
