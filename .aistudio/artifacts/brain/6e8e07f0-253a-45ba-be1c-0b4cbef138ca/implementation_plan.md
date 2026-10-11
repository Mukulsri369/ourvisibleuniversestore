# UI/UX Pro Max: Single-Line Horizontal Product Rails & Category Streams

A refined architectural, visual, and interaction plan to upgrade the storefront with high-density, single-line horizontal product rails across the **Festival Special** and **every individual product category**. Built with UI/UX Pro Max design intelligence, ultra-sleek floating chevron arrows that auto-hide when not needed (no text "Prev/Next" buttons), fluid touch swipe, and precision density calibrated for **5–6 products visible on desktop** and **4–5 visible on mobile**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following specifications are locked into this plan based on user requirements:

- **Decision 1 (No Prev/Next Text Buttons; Auto-Hiding Arrows)**:
  - No text buttons ("Prev" or "Next").
  - Subtle, floating glassmorphic chevron arrows (`‹` and `›`) positioned on the rail edges.
  - **Dynamic auto-hide**: The left arrow is completely invisible/disabled when at the leftmost position (`scrollLeft <= 5`). The right arrow is completely invisible/disabled when reached the end. If the product row fits without overflow, both arrows hide automatically.
  - Full touch swipe and trackpad horizontal scrolling enabled simultaneously.

- **Decision 2 (Dedicated Rail for Each Category)**:
  - Separate single-line horizontal grids for **each product category** (e.g. *Lights*, *Projectors*, *Lamps*, *Space Décor*, *Astronomy Gifts*, *Showpieces*), in addition to the Festival Special rail.
  - Each category rail includes a curated header with category name, count badge, and "Explore collection →" link.

- **Decision 3 (Visual Density: 5–6 Desktop, 4–5 Mobile)**:
  - **Desktop**: 5–6 compact cards comfortably visible in a single horizontal row without wrapping.
  - **Mobile**: 4–5 compact cards visible across the screen viewport with edge-to-edge momentum scrolling and smooth snap alignment.

- **Decision 4 (UI/UX Pro Max Visual Polish)**:
  - Deep space glassmorphism (`backdrop-blur-md bg-white/[0.03]` with cosmic obsidian borders `border-white/10`).
  - Subtle ambient nebula glows on hover (`hover:border-violet-500/30 hover:shadow-[0_8px_30px_-4px_rgba(139,92,246,0.2)]`).
  - Micro-typography hierarchy: crisp monospace or sans badges, currency formatting with tabular numerals, discount accent chips, and smooth image scale transitions (`group-hover:scale-105 duration-500`).

---

## 1. Overview & Experience Concept

- **What It Does**: Replaces static, bulky multi-row grids on the storefront with high-throughput, single-line horizontal product carousels across the homepage:
  1. **Festival Special (Diwali & Lights)**: High-priority holiday showcase rail.
  2. **Individual Category Rails**: Dedicated single-row rails for every active category that has products.
- **Why It Matters**: Eliminates vertical page bloat, encourages natural horizontal discovery, provides visual continuity across collections, and presents products at a high density without overwhelming mobile or desktop viewports.
- **Visual Design Identity**: Inspired by modern cosmic luxury & UI/UX Pro Max design standards: obsidian depth, luminous micro-accents, crisp typography, and border glassmorphism.

---

## 2. Component Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Storefront Home                               │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PlanetHero (Interactive 3D / Motion Intro)                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Festival Special Rail (Single Line)                              │  │
│  │ [‹] (Auto-hiding)                                [›] (Auto-hiding)│  │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │  │
│  │ │Card1│ │Card2│ │Card3│ │Card4│ │Card5│ │Card6│ ───► Scroll      │  │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Category Rail 1: Projectors (N items) · Explore →                │  │
│  │ [‹]                                                           [›]│  │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │  │
│  │ │Card1│ │Card2│ │Card3│ │Card4│ │Card5│ │Card6│                  │  │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Category Rail 2: Lamps & Ambient Glow · Explore →                │  │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │  │
│  │ │Card1│ │Card2│ │Card3│ │Card4│ │Card5│ │Card6│                  │  │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [Additional Category Rails: Space Décor, Astronomy Gifts, etc.]   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **`ProductScrollRail.tsx` (New Dedicated Component)**:
   - Houses the horizontal scroll container with `scrollbar-none flex overflow-x-auto snap-x snap-mandatory scroll-smooth`.
   - **Auto-hiding Navigation Arrows**:
     - Uses a ResizeObserver and scroll listener to compute `canScrollLeft` and `canScrollRight`.
     - Floating left arrow (`<ChevronLeft />`) and right arrow (`<ChevronRight />`):
       - Semi-transparent glass pill/circle (`w-8 h-8 sm:w-10 sm:h-10 rounded-full backdrop-blur-md bg-black/60 border border-white/20 text-white shadow-xl hover:bg-black/90 hover:scale-105 active:scale-95 transition-all`).
       - Positioned vertically centered over the rail edges with an ambient gradient backdrop fade (`pointer-events-none from-black/80 to-transparent`).
       - When `!canScrollLeft`: Left arrow is styled with `opacity-0 pointer-events-none scale-75 transition-all duration-300` (completely hidden).
       - When `!canScrollRight`: Right arrow is styled with `opacity-0 pointer-events-none scale-75 transition-all duration-300` (completely hidden).
       - If total width <= container width: both arrows are hidden.
     - Clicking scrolls smoothly by `container.clientWidth * 0.75` for intuitive page-by-page stepping.
     - Preserves effortless native horizontal swipe and momentum scrolling on mobile and touchpads.

2. **`ProductCard.tsx` (Compact Density Mode)**:
   - Introduce a `density?: 'standard' | 'compact'` prop (defaulting to `'compact'` in rails).
   - **Responsive Dimensional Tuning**:
     - Mobile: `w-[calc(23vw-8px)] min-w-[76px] max-w-[92px]` allowing **4 to 5 cards** to appear simultaneously side-by-side on typical 360px–430px screens.
     - Tablet: `sm:w-[130px] sm:min-w-[130px]` (4–5 cards visible).
     - Desktop: `lg:w-[calc((100%-5*12px)/6)] lg:min-w-[155px] xl:w-[calc((100%-5*16px)/6)] xl:min-w-[175px]` (**5 to 6 cards** visible without overflowing the initial screen width).
   - **Visual Elements in Compact Mode**:
     - Aspect ratio: Crisp 1:1 square image with subtle inner border and rounded-xl edges.
     - Title: 2-line clamp with compact typography (`text-[10px] leading-tight sm:text-xs font-medium text-slate-200 group-hover:text-white`).
     - Pricing: Tabular bold price (`text-[10px] sm:text-xs font-semibold text-amber-300`) with optional original price strike-through.
     - Micro-tag: Tiny subtle category chip or Diwali badge (`text-[8px] uppercase tracking-wider text-violet-400 font-mono`).
     - Affiliate Buy / View affordance: Whole card is an intuitive tap target leading to product details, with a sleek compact button or hover micro-trigger.

3. **`_store.index.tsx` (Homepage Layout)**:
   - **Festival Special Section**:
     - Radiant festive header with glowing Diya/sparkle accent icon and celebratory copy.
     - Uses `ProductScrollRail` rendering festive-tagged and curated lights/projectors products.
   - **Dynamic Category Streams**:
     - Groups active products by their `category_id` / `category_ids`.
     - Iterates through active categories that contain products.
     - Each category renders:
       - Header with category title, product count badge (`e.g. 12 items`), and a link to `/category/:slug`.
       - `ProductScrollRail` rendering the category's products in compact density.
   - Preserves existing TanStack query hydration, performance, and SEO metadata.

---

## 3. Implementation Steps

1. **Create `src/components/store/ProductScrollRail.tsx`**:
   - Encapsulate the scroll ref, scroll position tracker (`canScrollLeft`, `canScrollRight`), and smooth stepping functions.
   - Render floating left and right chevron arrows with CSS transition opacity/scale auto-hide.
   - Add gradient fade masks on the left and right edges when scrolling is possible for a cinema-grade visual taper.

2. **Enhance `src/components/store/ProductCard.tsx` for High Density**:
   - Add `density="compact"` support with calibrated padding, badge sizes, font sizes, and image container dimensions.
   - Ensure touch targets remain ergonomic on mobile even with dense layout.
   - Polish hover glows and border transitions matching UI/UX Pro Max standards.

3. **Update Homepage (`src/routes/_store.index.tsx`)**:
   - Replace the Festival Special static grid with `<ProductScrollRail>`.
   - Organize products by category and render individual `<ProductScrollRail>` components for each active category.
   - Clean up any unused legacy pagination or redundant button elements.

4. **Verification & Responsiveness Testing**:
   - Validate build with `compile_applet`.
   - Test layout scaling at 375px (mobile - 4 to 5 cards visible), 768px (tablet - 4 to 5 cards visible), and 1280px+ (desktop - 5 to 6 cards visible).
   - Verify arrow auto-hiding at start, middle, and end of scroll rails.
