# Architecture Audit & Engineering Decisions — Visual Storefront Editor

- **Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)
- **Active Branch:** `feature/visual-storefront-editor`
- **Previous Remote Checkpoint (`origin/main`):** `f05569b41f74c3c89006f9fe7ef32ba6a48fde56`
- **Last Updated:** 2026-10-20 (Prompt 6 of 48)

---

## 1. Current Application Stack & Storefront Architecture

| Layer | Technology | Implementation Details |
| :--- | :--- | :--- |
| **Framework & SSR** | React `19.2.0` + TanStack Start `1.168.60` + Nitro | File-based routing in `src/routes/`, SSR streaming entry in `src/server.ts`, client hydration in `src/router.tsx` |
| **Data Fetching** | TanStack Query `5.101.1` + Supabase JS `2.117.2` | `homeQuery`, `categoriesQuery`, `settingsQuery`, and `productsQuery` in `src/lib/store.ts` |
| **Styling System** | Tailwind CSS `4.2.1` (`@tailwindcss/vite`) | Dark-mode cosmic design tokens (`oklch`), utility classes, and responsive `@media` rules in `src/styles.css` |
| **Animation & 3D** | Motion `14.1.0` (`motion/react`) + Three.js `0.186.1` | `PlanetHero.tsx` (video/poster switching & `AnimatePresence`), `CelestialScrollWorld.tsx` (`useScroll` + `useSpring` trajectories) |
| **Database & Storage** | Supabase PostgreSQL + Drizzle ORM `0.45.3` | Tables: `products`, `categories`, `site_settings`, `outbound_clicks`; private storage served via `/api/public/img/$` |
| **Admin Portal** | `/admin/*` routes (`src/routes/_admin.tsx`) | Email-allowlisted Supabase Auth session guard; manages Products, Categories, Duplicates, Festival, and Settings |

---

## 2. Core Visual Editor Rendering Pipeline (Implemented in Prompts 5–6)

```
VALIDATED PAGEDOCUMENT (src/lib/visual-editor/schema/)
  → VISUAL COMPONENT REGISTRY (src/lib/visual-editor/registry/)
    → SHARED PAGE RENDERER & CONTEXT (src/lib/visual-editor/rendering/)
      → REAL STOREFRONT ADAPTERS (src/lib/visual-editor/adapters/)
        → EXISTING REACT STOREFRONT COMPONENTS (src/components/store/)
```

### 2.1 Component Integration Matrix (Pre-Implementation Audit)

| Storefront Component | Source File | Data Dependencies | Routing & Query Context | Animation / Browser APIs | Adapter Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PlanetHero` | `src/components/store/PlanetHero.tsx` | `PLANETS` (`earth`, `venus`, `mars`) | TanStack `<Link to="/shop">` | `motion/react`, `<video>`, `IntersectionObserver`, `document.visibilitychange` | `PlanetHeroAdapter.tsx` |
| `CelestialScrollWorld` | `src/components/store/CelestialScrollWorld.tsx` | `CELESTIAL_CONFIGS` (`earth`, `venus`, `mars`) | None (`fixed inset-0 z-0`) | `useScroll`, `useSpring`, `useTransform`, `useReducedMotion` | `CelestialScrollWorldAdapter.tsx` |
| `ProductScrollRail` | `src/components/store/ProductScrollRail.tsx` | `items: ProductCardData[]` | TanStack `<Link>`, `QueryClient` (via quick preview modal) | `ResizeObserver`, horizontal scroll listener | `ProductScrollRailAdapter.tsx` |
| `ProductCard` | `src/components/store/ProductCard.tsx` | `p: ProductCardData` (`price`, `currency`, `affiliate_url`, `images`) | TanStack `<Link to="/product/$slug">`, `BuyButton` | `AnimatePresence` multi-image crossfade | `ProductCardAdapter.tsx` |
| `CategorySpotlightHero` | `src/components/store/CategorySpotlightHero.tsx` | `product: ProductCardData`, `categoryName`, `categorySlug`, `sectorLore` | TanStack `<Link>`, `ProductQuickPreviewModal` (`useQuery`) | Collapsible description state | `CategorySpotlightAdapter.tsx` |
| `CategoryCard` | `src/components/store/CategoryCard.tsx` | `c: Category`, `index` | TanStack `<Link to="/category/$slug">` | CSS group-hover scale & elevation | `CategoryCardAdapter.tsx` |
| `StoreHeader` / `StoreFooter` | `src/components/store/StoreChrome.tsx` | `settingsQuery`, `categoriesQuery` | `useSuspenseQuery`, `useNavigate`, `<Link>` | Mobile menu drawer state | `StoreChromeAdapter.tsx` |

### 2.2 Rendering Contexts & Safe Interaction Policies (`RenderContext.tsx`)

| Rendering Mode | Navigation (`<Link>`) | Affiliate Redirect (`BuyButton`) | Outbound Click Logging (`logOutboundClick`) | Quick Preview Modal | Node Click Selection (`onSelectNode`) | Editor DOM Attributes (`data-editor-*`) | Heavy Video / Global Scroll |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`"public"`** | Enabled | Enabled | Enabled | Enabled | Disabled | Disabled (`0` extra attributes) | Enabled |
| **`"editor"`** | Blocked (Capture Phase) | Blocked (Capture Phase) | Blocked (Capture Phase) | Disabled | Enabled (Deepest Node) | Enabled | Enabled |
| **`"preview"`** | Blocked (Capture Phase) | Blocked (Capture Phase) | Blocked (Capture Phase) | Enabled | Disabled | Disabled | Enabled |
| **`"mini_preview"`** | Blocked (Capture Phase) | Blocked (Capture Phase) | Blocked (Capture Phase) | Disabled | Disabled | Disabled | Disabled (Static Poster / Summary) |

### 2.3 Zero-Wrapper Public Parity (`AdapterBoundary.tsx`)
- In `"public"` mode, when a node has no explicit design override (`resolveNodeCssProperties(mergedStyleBundle) === undefined`), `AdapterBoundary` returns `<>{children}</>` directly without introducing any extra `<div>` wrapper.
- Verified in `src/lib/visual-editor/__tests__/adapters.test.tsx`: `renderedCompact.innerHTML === directCompact.innerHTML`, `renderedRail.innerHTML === directRail.innerHTML`, `renderedSpotlight.innerHTML === directSpotlight.innerHTML`, `renderedCategoryCard.innerHTML === directCategoryCard.innerHTML`, `renderedHero.innerHTML === directHero.innerHTML`, and `renderedCelestial.innerHTML === directCelestial.innerHTML`.

### 2.4 Global Chrome & Fixed Background Layer Separation (`PageRenderer.tsx`)
1. **Preventing Duplicate `StoreHeader` / `StoreFooter`:**
   - `src/routes/_store.tsx` renders `<StoreHeader />` and `<StoreFooter />` around `<Outlet />`.
   - `PageRenderer` defaults `renderGlobalChromeInDocument = false`, so even if a `PageDocument` contains `StoreHeader` and `StoreFooter` nodes for standalone editor preview, they return `null` when mounted inside a storefront route layout.
2. **Preventing `CelestialScrollWorld` Clipping:**
   - `PageRenderer` separates `CelestialScrollWorld` root nodes from flow sections and renders `CelestialScrollWorldAdapter` without any positioned or overflow-clipping wrapper, preserving `fixed inset-0 pointer-events-none z-0`.

### 2.5 Reusable Card Templates (`cardTemplates` in `PageRenderContext`)
- `ProductCardAdapter` and `CategoryCardAdapter` merge `cardTemplates["ProductCard"]`, `cardTemplates["ProductCardCompact"]`, and `cardTemplates["CategoryCard"]` beneath node-specific responsive styles before computing CSS properties.
- Updating a card template style updates every card using that template without mutating any product or category record.
