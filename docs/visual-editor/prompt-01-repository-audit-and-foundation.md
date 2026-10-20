# Prompt 1 of 48 — Deep Repository Analysis & Visual Storefront Editor Foundation

**Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)  
**Phase:** Phase 1 — Architectural Audit & Foundation Blueprint  
**Status:** Complete & Verified (Analysis-Only, Zero Production Code Modified)

---

## 1. Executive Summary & Final Product Vision

The goal of the Visual Storefront Editor initiative is to transform the existing `/admin` portal of **Our Visible Universe Store** into a no-code visual design studio combining:
- **Shopify:** Section management, theme configuration, product/category collection curation, draft saving, and versioned publishing.
- **Figma:** Direct element selection, bounding-box overlays, 8-point corner/edge resize handles, corner-radius reshaping, alignment snapping guides, and precise spatial feedback.
- **Webflow:** Responsive breakpoint cascading (Desktop, Tablet, Mobile), CSS Grid/Flexbox layout switching, typography, colors, borders, shadows, and scroll/motion parameter tuning.
- **Canva:** Preset templates, visual asset selection, and an interactive real-time miniature component preview inside the inspector.

### Primary Architectural Invariant
The visual editor **must render the actual existing landing page and storefront components** (`PlanetHero`, `CelestialScrollWorld`, `CategorySpotlightHero`, `ProductScrollRail`, `ProductCard`, `CategoryCard`, `StoreHeader`, `StoreFooter`) using the exact same React 19 components, Tailwind v4 CSS tokens, fonts, assets, and Supabase data queries as the live customer website. No mock or simplified duplicate landing page is permitted.

---

## 2. Complete Repository & Technology Stack Audit

### 2.1 Core Framework & Build Pipeline
- **Framework:** TanStack Start (`1.168.60`) + TanStack Router (`1.170.41`) + React (`19.2.0`) + TypeScript (`5.8.3`).
- **Server Runtime:** Nitro (`3.0.260603-beta`) via `/src/server.ts` with custom SSR error normalization (`normalizeCatastrophicSsrResponse`).
- **Build & Bundler:** Vite (`8.1.5`) with `@tailwindcss/vite` (`4.2.1`) and `vite-tsconfig-paths`.
- **State & Data Fetching:** TanStack React Query (`5.101.1`) using `useSuspenseQuery` on public SSR routes and `useQuery` on client-only admin routes.
- **Database & Auth:** Supabase (`@supabase/supabase-js` `2.117.2`) with PostgreSQL Row-Level Security (RLS), `is_admin()` RPC verification, and `product_is_live()` public visibility filtering.

### 2.2 Complete Route Tree (`/src/routes/`)
| Route File | URL Path | SSR Mode | Purpose & Data Dependencies |
|---|---|---|---|
| `__root.tsx` | Root Shell | Isomorphic | Loads Google Fonts (`Instrument Serif`, `Manrope`, `JetBrains Mono`, `Hanken Grotesk`, `Prata`), `styles.css`, `QueryClientProvider`, `Toaster`, 404 & Error boundaries. |
| `_store.tsx` | Layout Wrapper | Isomorphic | Wraps public routes in `.cosmic-store`, preloads `settingsQuery` & `categoriesQuery`, mounts `<StoreHeader />` and `<StoreFooter />`. |
| `_store.index.tsx` | `/` | Isomorphic | Customer homepage. Preloads `homeQuery`, `categoriesQuery`, `settingsQuery`. Renders celestial background, hero, festival rail, featured/newest rails, progressive category spotlights & rails, interest pills, value props, and Instagram banner. |
| `_store.shop.tsx` | `/shop` | Isomorphic | Full catalog browser using `<ProductBrowser />`. |
| `_store.search.tsx` | `/search` | Isomorphic | Search & filter view (`q`, `category`, `featured`, `sort`, `page`). |
| `_store.category.$slug.tsx` | `/category/$slug` | Isomorphic | Category landing page with `<CategoryFullBackground />`, `<SpaceLaserLine />`, celestial quote metadata, and `<ProductBrowser />`. |
| `_store.product.$slug.tsx` | `/product/$slug` | Isomorphic | Product detail view (`<ProductDetailView />`), gallery, features, tags, related products, and `<BuyButton />`. |
| `_store.about.tsx`, `contact`, `faq`, `privacy`, `terms`, `affiliate-disclosure` | Static paths | Isomorphic | Informational & legal pages rendered via `<StaticPage />`. |
| `_admin.tsx` | `/admin/*` Layout | `ssr: false` | Client-only admin gate checking `supabase.auth.getUser()` and `supabase.rpc("is_admin")`. Renders fixed sidebar (`w-60`) and mobile drawer. |
| `_admin.admin.index.tsx` | `/admin` | `ssr: false` | Admin dashboard showing product counts, active/inactive stats, and top outbound affiliate clicks. |
| `_admin.admin.products.index.tsx` | `/admin/products` | `ssr: false` | Product list, search, status toggle, single & batch live price refresh (`/api/admin/check-price`). |
| `_admin.admin.products.new.tsx` & `edit.$id.tsx` | `/admin/products/*` | `ssr: false` | `<ProductForm />` with URL auto-scraper (`/api/admin/scrape-product`), multi-category picker (`<CategorySelect />`), image uploads, and duplicate link warning (`<DuplicateWarningDialog />`). |
| `_admin.admin.products.trash.tsx` | `/admin/products/trash` | `ssr: false` | Soft-deleted product recovery and permanent deletion. |
| `_admin.admin.duplicates.tsx` | `/admin/duplicates` | `ssr: false` | Audits products sharing normalized affiliate URLs or ASINs. |
| `_admin.admin.festival.tsx` | `/admin/festival` | `ssr: false` | Curates and orders products and copy for the homepage Festival Special section (`site_settings.social_links.festival_special`). |
| `_admin.admin.categories.tsx` | `/admin/categories` | `ssr: false` | Category CRUD, sort order management, image upload, and category spotlight product assignment (`site_settings.social_links.category_spotlights`). |
| `_admin.admin.settings.tsx` | `/admin/settings` | `ssr: false` | Store branding, logo upload, footer copy, affiliate disclosure, and admin email allowlist management. |
| `admin.login.tsx` & `admin.reset-password.tsx` | `/admin/login` | Isomorphic | Admin authentication flows. |
| `api/admin/scrape-product.ts` & `check-price.ts` | `/api/admin/*` | Server API | Server-side HTML scraping using `cheerio/slim` and shared retailer price parser (`/src/lib/retailer-price.ts`). |
| `api/public/img.$.ts` | `/api/public/img/*` | Server API | Validated public proxy for private storage media assets. |

### 2.3 Storefront Component Inventory (`/src/components/store/`)
1. `PlanetHero.tsx`: Interactive 3-planet hero (`earth`, `venus`, `mars`) with CDN MP4 video streams, poster fallbacks, `IntersectionObserver` & `visibilitychange` playback guards, and Motion React title masks.
2. `CelestialScrollWorld.tsx` & `CelestialPlanet.tsx`: Scroll-linked (`useScroll`, `useSpring`, `useTransform`) fixed background canvas animating Earth, Venus, and Mars cutouts along orbital trajectories with interactive telemetry HUDs.
3. `ProductScrollRail.tsx`: Horizontal snap-scrolling carousel with ResizeObserver overflow detection, left/right stepping buttons, `default` and `festive` visual variants, and integrated `<ProductQuickPreviewModal />`.
4. `ProductCard.tsx`: Supports standard and `compact` modes, multi-image hover scrubbing, category badge, formatted price (`/src/lib/retailer-currency.ts`), quick-preview eye trigger, and `<BuyButton />`.
5. `CategorySpotlightHero.tsx`: 12-column split spotlight card displaying a category's featured product, collapsible description, quick-view trigger, and celestial sector lore.
6. `CategoryCard.tsx`: Category tile with slug-mapped Lucide icon, image/nebula backdrop, description, and hover elevation.
7. `BuyButton.tsx`: Renders external affiliate link with `rel="nofollow sponsored noopener noreferrer"`, untouched `href`, and non-blocking `logOutboundClick(productId)`.
8. `ProductQuickPreviewModal.tsx`: Modal dialog fetching full gallery images via `productQuery(slug)` with keyboard navigation.
9. `ProductDetailView.tsx` & `ProductBrowser.tsx`: Full product page and filterable/sortable catalog grid.
10. `GalaxyScene.tsx`, `AnimatedBlackHole.tsx`, `SpaceLaserLine.tsx`, `CategoryFullBackground.tsx`, `CategoryQualityBento.tsx`, `CategoryCelestialWorld.tsx`: Specialized Three.js and CSS cosmic visualizers.
11. `StoreChrome.tsx`: `<StoreHeader />` (sticky glass bar, `<Logo />`, category hover menu, `<SearchBox />`, mobile drawer) and `<StoreFooter />` (brand summary, quick links, legal links, affiliate disclosure).

### 2.4 Styling & Design Token Architecture (`/src/styles.css`)
- Uses Tailwind CSS v4 `@theme inline` mapping semantic tokens (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--radius`) to OKLCH color values.
- Custom cosmic utility classes: `.cosmic-store`, `.starfield`, `.nebula`, `.glass`, `.shadow-glow`, `.shadow-card`, `.bg-gradient-gold`, `.eyebrow`, and `.planet-hero` layout rules.

---

## 3. Visual Editor Integration Foundation

1. **Mount Point:** The editor will live inside the authenticated client-only admin layout at `/_admin/admin/editor` (`/src/routes/_admin.admin.editor.tsx`).
2. **Persistence Channel:** Draft and published storefront configurations will be stored as structured, versioned JSON inside `site_settings.social_links` (`theme_draft`, `theme_published`, `theme_revisions`) so no destructive SQL schema migrations are required.
3. **Zero-Regression Default:** When `theme_published` is absent or unmodified, the storefront renders the exact default component tree and styling currently in production.
