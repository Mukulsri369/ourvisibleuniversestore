/**
 * PLAYWRIGHT VISUAL REGRESSION & PARITY SPECIFICATION
 * Project: Our Visible Universe Store (Mukulsri369/ourvisibleuniversestore)
 * Phase: Phase 1, Prompt 4 of 48
 *
 * NOTE ON EXECUTION ENVIRONMENT:
 * In the Google AI Studio Argon 4 gVisor container, headless Chromium binaries are not pre-installed.
 * This specification is designed for execution in CI or local environments with `@playwright/test`
 * without altering production dependencies in `package.json`.
 */

export interface ViewportConfig {
  id: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export const MANDATORY_VIEWPORTS: ViewportConfig[] = [
  { id: "mobile-360x800", width: 360, height: 800, deviceScaleFactor: 2 },
  { id: "mobile-390x844", width: 390, height: 844, deviceScaleFactor: 3 },
  { id: "tablet-768x1024", width: 768, height: 1024, deviceScaleFactor: 2 },
  { id: "tablet-1024x768", width: 1024, height: 768, deviceScaleFactor: 2 },
  { id: "desktop-1440x900", width: 1440, height: 900, deviceScaleFactor: 2 },
  { id: "desktop-1920x1080", width: 1920, height: 1080, deviceScaleFactor: 1 },
];

/**
 * Deterministic PRNG script injected via `page.addInitScript()` prior to navigation
 * so `shuffleProducts()` in `src/lib/store.ts` produces identical ordering on every page load.
 */
export const DETERMINISTIC_MATH_RANDOM_INIT_SCRIPT = `
  (() => {
    let seed = 42;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  })();
`;

/**
 * Controlled step-scroll helper to trigger all `ProgressiveCategorySpotlight`
 * IntersectionObserver instances (`rootMargin: "600px 0px"`) and wait for layout stability.
 */
export const PROGRESSIVE_SCROLL_DISCOVERY_SCRIPT = `
  async () => {
    const step = Math.max(window.innerHeight * 0.75, 400);
    let currentY = 0;
    while (currentY < document.body.scrollHeight) {
      window.scrollTo({ top: currentY, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 120));
      currentY += step;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 300));
  }
`;
