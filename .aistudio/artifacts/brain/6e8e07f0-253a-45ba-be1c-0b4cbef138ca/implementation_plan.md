# Celestial Scroll World: Interactive Earth, Venus & Mars Background Experience

Transform the storefront landing page into an immersive cosmic journey where high-detail globes of Earth, Venus, and Mars pop into view as visitors scroll past the hero, traveling smoothly along celestial orbital pathways down to the footer while providing interactive collection highlights and atmospheric depth.

### User Review & Critical Decisions

> [!IMPORTANT]
> The planetary flight paths and styling have been aligned based on your selections. Please review the planned interaction model, performance guardrails, and category integration below.

- **Confirmed: Orbital Motion Pattern**: Earth, Venus, and Mars emerge sequentially as the visitor scrolls down and glide along subtle alternating curved orbital tracks across each storefront section down to the footer.
- **Confirmed: Visual Fidelity**: High-detail spherical globes with realistic day/night limb gradients, atmospheric rim illumination, cloud and surface texturing, and dynamic axial rotation linked to scroll velocity.
- **Confirmed: Interactive Affordance**: Hovering a planet highlights its celestial glow and reveals a mini telemetry card linking directly to curated themed product collections (e.g., Earth Eco-Tech, Venus Radiance & Luxury, Mars Extreme Durability & Outdoors).
- **SSR & Hydration Safety**: All scroll animations and viewport-dependent measurements are mounted client-side after initial hydration with `useScroll` and `useTransform` from Motion React, completely eliminating hydration attribute mismatches.

---

### 1. Overview & Core Concept

- **What It Does**: As the visitor scrolls past the opening planet hero, three iconic celestial bodies—**Earth**, **Venus**, and **Mars**—smoothly emerge from the deep cosmic background. Each planet follows an orchestrated orbital descent:
  - **Earth** glides along the right periphery near the Festival Specials rail with an azure ozone glow.
  - **Venus** sweeps toward the center-left across the Gadgets & Electronics rail with golden-amber cloud radiance.
  - **Mars** enters the lower catalog sections near the Footer with rust-crimson textures and atmospheric rim lighting.
- **Target Audience & Persona**: Shoppers exploring tech, festival gifts, and gadgets who appreciate a cinematic, futuristic cosmic brand identity that feels responsive and alive.
- **Key Value**: Replaces static page backgrounds with a living space-world narrative that increases page engagement and dwell time without interfering with product legibility or shopping ergonomics.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Hero Departure (Scroll 0% → 15%)**: As the initial hero title fades, a subtle particle dust trail signals Earth popping into perspective with a gentle elastic spring and axial spin.
2. **Mid-Page Descent (Scroll 15% → 60%)**: Venus joins the background field, moving opposite to Earth in an organic elliptical drift that creates true 2.5D parallax depth behind the product rail cards.
3. **Deep Storefront Transition (Scroll 60% → 100%)**: Mars ascends from the lower quadrant as the user reaches the featured category rows, completing the planetary triad before settling into orbital positions around the footer.
4. **Interactive Hover & Explore**: Hovering or tapping any drifting planet dims background distraction, enlarges its atmospheric corona, and reveals a floating prompt (e.g., _"Explore Mars Collection"_ or _"Earth-Friendly Tech"_), providing a natural path to thematic product filters.

#### Visual Identity & Theme

- **Color Palette & Mood**:
  - Deep space vacuum canvas: `#060814` to `#0B0F19` with subtle stellar nebulas.
  - **Earth**: Azure cyan `#38BDF8`, deep ocean cobalt `#1E40AF`, and swirling cloud whites.
  - **Venus**: Warm amber `#F59E0B`, sulfuric gold `#FBBF24`, and luminous corona.
  - **Mars**: Terracotta crimson `#EF4444`, iron rust `#DC2626`, and dusk violet rim.
- **Depth & Contrast**:
  - Planets are positioned with `z-index: 0` to `z-index: 5`, floating behind store content cards (`z-index: 10`) and navigation chrome (`z-index: 50`).
  - Subtle dark radial backdrops behind product cards ensure text and product images remain 100% legible without visual interference.
- **Motion & Accessibility Rules**:
  - Respects `prefers-reduced-motion`: When reduced motion is enabled, planets render in fixed, elegant ambient positions without parallax scroll translation.
  - Compositor-only properties (`transform: translate3d(...)` and `opacity`) ensure a locked 60/120 FPS on mobile and low-power devices.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Motion React (`motion/react`) vs Heavy WebGL Instances**
  - _Chosen Approach_: Leverage Motion React's hardware-accelerated SVG/CSS 3D spherical rendering with high-resolution texture maps, limb shading, and compositor-driven `useScroll` transforms.
  - _Why_: Ultra-fast initial page load, zero CPU/GPU lockup on mobile, seamless SSR hydration without WebGL context thrashing, and full synchronization with page scroll.
  - _Alternatives Considered_: Three.js full-screen canvas (already present in lightweight GalaxyScene, but multi-object 3D meshes increase memory consumption and battery drain on mobile devices).

- **Decision 2: Interactive Planets Without Shopping Friction**
  - _Chosen Approach_: Soft pointer hit-boxes with subtle magnetic hover and themed category chips that slide out unobtrusively without blocking product card clicks.
  - _Why_: Delivers high delight without frustrating visitors attempting to click "Buy Now" or "View Details" on products.

- **Decision 3: Compact Single-Line Category Rails with Dynamic Arrows**
  - _Chosen Approach_: Maintain single-line horizontal product rails showing 5–6 items on desktop and 4–5 items on mobile, with intelligent scroll indicators and arrow buttons that automatically hide when the edges are reached.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       StoreChrome                           │
│  - Navigation Top Bar Contract (Wordmark · Links · Cart)     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    ScrollWorldController                     │
│  - Tracks window scroll progress (0.0 → 1.0) via useScroll   │
│  - Computes orbital transforms for Earth, Venus & Mars      │
│  - Handles reduced-motion and touch gesture throttling       │
└─────────────────────────────────────────────────────────────┘
        │                             │
        ▼                             ▼
┌─────────────────────────┐   ┌───────────────────────────────┐
│ CelestialOrbitalLayer   │   │ Storefront Content Layer      │
│ (z-index: 0–5)          │   │ (z-index: 10)                 │
│ ├─ Earth Globe & Halo   │   │ ├─ PlanetHero Opening         │
│ ├─ Venus Globe & Corona │   │ ├─ Festival Specials Rail     │
│ └─ Mars Globe & Dust    │   │ ├─ Category Product Rails     │
│ └─ Interactive Tooltips │   │ └─ Store Footer               │
└─────────────────────────┘   └───────────────────────────────┘
```

#### Component & State Implementation Plan

1. **`src/components/store/CelestialScrollWorld.tsx`**:
   - Master controller component mounted inside the store layout.
   - Uses `useScroll` and smooth spring transforms for `x`, `y`, `scale`, and `rotate`.
   - Coordinates Earth, Venus, and Mars trajectories down the full page height.
2. **`src/components/store/CelestialPlanet.tsx`**:
   - Renders individual planets with multi-layer spherical shading (surface map, atmospheric halo, shadow terminator, and hover aura).
   - Contains interactive trigger linking to curated category collections.
3. **`src/routes/_store.index.tsx` Integration**:
   - Wraps the landing page content with the `CelestialScrollWorld` canvas.
   - Cleans up hydration attributes to prevent SSR discrepancies.
4. **Product Rails Refinement**:
   - Verifies all category rails maintain compact item sizing (5–6 desktop, 4–5 mobile) and intuitive touch/arrow scrolling.

---

### Verification & Testing Plan

- **Hydration & SSR**: Verify `npm run build` and check server-rendered HTML for zero attribute mismatch warnings.
- **Scroll Performance**: Verify smooth 60fps scrolling on both desktop viewports and mobile touch simulation.
- **Responsive Layout**: Check layout at 375px (mobile), 768px (tablet), 1024px (laptop), and 1440px (wide desktop).
- **Reduced Motion**: Verify that toggling `prefers-reduced-motion` settles planets into static decorative coordinates.
