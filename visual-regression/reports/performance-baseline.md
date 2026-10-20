# Performance Baseline Report — Prompt 4 of 48

## 1. Executed Runtime & Test Timings (Measured in Argon 4 Container)
- **Vitest Full Suite Execution (10 files, 56 tests):** `24.40s` total (`transform 1.48s`, `setup 2.88s`, `import 4.15s`, `tests 5.56s`, `environment 8.68s`).
- **Full App Routing SSR/Hydration Index Render (`src/test/app-routing.test.tsx`):** `4,682ms` in JSDOM (includes router tree initialization, Supabase client init, and `PlanetHero` mount).
- **Isolated Editor Interaction Engine PoC (`src/test/editor-interaction-engine.test.tsx`):** `339ms` for 8 full interaction prototypes (~42ms per test).

## 2. Storefront Architectural Performance Profile (Verified via Source Inspection)
- **Hero Video Loading (`PlanetHero.tsx`):**
  - Only the active planet (`earth`) mounts a `<video>` element initially (`loaded` state starts as `["earth"]`).
  - Side planets (`venus`, `mars`) render static WebP `<img className="planet-poster">` elements and only mount `<video>` upon pointer hover/focus (`warm(side.id)`).
  - `IntersectionObserver` (`threshold: 0.2`) and `document.visibilitychange` automatically pause video playback when scrolled offscreen or tab-hidden.
- **Celestial Scroll World (`CelestialScrollWorld.tsx`):**
  - Uses Motion `useScroll()` + `useSpring(scrollYProgress, { stiffness: 55, damping: 24, mass: 0.6, restDelta: 0.001 })` driving hardware-accelerated CSS `transform` (`x`, `y`, `scale`, `rotate`) and `opacity` on 3 fixed-position planet containers without triggering React state re-renders during scroll.
  - Includes 2 continuous SVG `<ellipse>` CSS animations (`animate-[spin_240s_linear_infinite]` and `animate-[spin_180s_linear_infinite_reverse]`).
- **Progressive Category Spotlights (`_store.index.tsx`):**
  - Categories at `index < 3` render immediately on initial load.
  - Categories at `index >= 3` render a lightweight `460px` skeleton placeholder until an `IntersectionObserver` (`rootMargin: "600px 0px"`) disconnects and mounts the full `CategorySpotlightHero` + `ProductScrollRail`.
- **Product Card Hover Slideshow (`ProductCard.tsx`):**
  - Runs a `1400ms` `setInterval` only while `isHovered === true` on cards with `imageList.length > 1`, cleaning up immediately on `mouseleave`.
