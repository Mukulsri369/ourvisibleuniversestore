import { resolveBreakpointFromWidth } from "../rendering/responsive-styles";
import type { EditorBreakpoint } from "../schema/responsive";

export type StudioDevicePreset = "desktop" | "tablet" | "mobile" | "custom";

export type StudioZoomMode = "manual" | "fit";

export interface StudioDevicePresetDefinition {
  readonly id: Exclude<StudioDevicePreset, "custom">;
  readonly label: string;
  readonly widthPx: number;
  readonly minWidthPx: number;
  readonly maxWidthPx: number;
  readonly defaultBreakpoint: EditorBreakpoint;
  readonly description: string;
}

export const MIN_STUDIO_VIEWPORT_WIDTH_PX = 320;
export const MAX_STUDIO_VIEWPORT_WIDTH_PX = 1920;

export const STUDIO_DEVICE_PRESETS: Readonly<
  Record<Exclude<StudioDevicePreset, "custom">, StudioDevicePresetDefinition>
> = Object.freeze({
  desktop: Object.freeze({
    id: "desktop",
    label: "Desktop",
    widthPx: 1440,
    minWidthPx: 1024,
    maxWidthPx: 1920,
    defaultBreakpoint: "desktop",
    description: "Standard desktop widescreen viewport (1440px)",
  }),
  tablet: Object.freeze({
    id: "tablet",
    label: "Tablet",
    widthPx: 768,
    minWidthPx: 640,
    maxWidthPx: 1023,
    defaultBreakpoint: "tablet",
    description: "Portrait tablet viewport (768px)",
  }),
  mobile: Object.freeze({
    id: "mobile",
    label: "Mobile",
    widthPx: 390,
    minWidthPx: 320,
    maxWidthPx: 639,
    defaultBreakpoint: "mobile",
    description: "Handheld mobile viewport (390px)",
  }),
});

export const STUDIO_QUICK_DIMENSIONS: readonly {
  readonly widthPx: number;
  readonly label: string;
  readonly preset: StudioDevicePreset;
}[] = Object.freeze([
  { widthPx: 1600, label: "1600px — Wide Desktop (XL)", preset: "custom" },
  { widthPx: 1440, label: "1440px — Standard Desktop", preset: "desktop" },
  { widthPx: 1280, label: "1280px — Compact Desktop", preset: "custom" },
  { widthPx: 1024, label: "1024px — Small Laptop", preset: "custom" },
  { widthPx: 768, label: "768px — Tablet Portrait", preset: "tablet" },
  { widthPx: 430, label: "430px — Large Mobile", preset: "custom" },
  { widthPx: 390, label: "390px — Standard Mobile", preset: "mobile" },
  { widthPx: 360, label: "360px — Compact Mobile (SM)", preset: "custom" },
]);

export const STUDIO_ZOOM_PRESETS = [25, 50, 75, 100, 125] as const;
export type StudioZoomPreset = (typeof STUDIO_ZOOM_PRESETS)[number];

export const MIN_STUDIO_ZOOM_PERCENT = 25;
export const MAX_STUDIO_ZOOM_PERCENT = 150;

export interface ResolvedStudioViewport {
  readonly devicePreset: StudioDevicePreset;
  readonly viewportWidthPx: number;
  /**
   * Breakpoint resolved strictly from `viewportWidthPx` (never distorted by `zoomPercent`).
   * A 390px mobile viewport at 75% zoom still resolves to `"mobile"`.
   */
  readonly breakpoint: EditorBreakpoint;
  readonly zoomMode: StudioZoomMode;
  readonly zoomPercent: number;
  readonly zoomScale: number;
}

export function clampStudioViewportWidth(widthPx: number): number {
  if (!Number.isFinite(widthPx)) {
    return STUDIO_DEVICE_PRESETS.desktop.widthPx;
  }
  return Math.max(
    MIN_STUDIO_VIEWPORT_WIDTH_PX,
    Math.min(MAX_STUDIO_VIEWPORT_WIDTH_PX, Math.round(widthPx)),
  );
}

export function clampStudioZoomPercent(zoomPercent: number): number {
  if (!Number.isFinite(zoomPercent)) return 100;
  return Math.max(
    MIN_STUDIO_ZOOM_PERCENT,
    Math.min(MAX_STUDIO_ZOOM_PERCENT, Math.round(zoomPercent)),
  );
}

export function inferDevicePresetFromWidth(widthPx: number): StudioDevicePreset {
  const clamped = clampStudioViewportWidth(widthPx);
  if (clamped === STUDIO_DEVICE_PRESETS.desktop.widthPx) return "desktop";
  if (clamped === STUDIO_DEVICE_PRESETS.tablet.widthPx) return "tablet";
  if (clamped === STUDIO_DEVICE_PRESETS.mobile.widthPx) return "mobile";
  return "custom";
}

/**
 * Computes a clean fit-to-workspace zoom percentage so a wide canvas (e.g. 1440px)
 * fits comfortably inside the center workspace panel without altering the underlying
 * simulated `viewportWidthPx` or `EditorBreakpoint`.
 */
export function calculateFitZoomPercent(
  viewportWidthPx: number,
  availableContainerWidthPx: number,
  horizontalPaddingPx: number = 48,
): number {
  const safeViewport = clampStudioViewportWidth(viewportWidthPx);
  if (!Number.isFinite(availableContainerWidthPx) || availableContainerWidthPx <= 0) {
    return 100;
  }
  const usableWidth = Math.max(200, availableContainerWidthPx - horizontalPaddingPx);
  if (usableWidth >= safeViewport) {
    return 100;
  }
  const rawPercent = Math.floor((usableWidth / safeViewport) * 100);
  return clampStudioZoomPercent(rawPercent);
}

/**
 * Resolves the complete studio viewport and zoom state.
 * Guarantees that `breakpoint` is evaluated strictly from `viewportWidthPx`
 * and is never corrupted by `zoomPercent` or `zoomMode`.
 */
export function resolveStudioViewportState(input: {
  devicePreset: StudioDevicePreset;
  viewportWidthPx?: number;
  zoomMode?: StudioZoomMode;
  zoomPercent?: number;
  availableContainerWidthPx?: number;
}): ResolvedStudioViewport {
  const presetWidth =
    input.devicePreset !== "custom"
      ? STUDIO_DEVICE_PRESETS[input.devicePreset].widthPx
      : (input.viewportWidthPx ?? STUDIO_DEVICE_PRESETS.desktop.widthPx);

  const viewportWidthPx = clampStudioViewportWidth(input.viewportWidthPx ?? presetWidth);
  const breakpoint = resolveBreakpointFromWidth(viewportWidthPx);
  const zoomMode = input.zoomMode ?? "manual";

  const effectiveZoomPercent =
    zoomMode === "fit" && input.availableContainerWidthPx
      ? calculateFitZoomPercent(viewportWidthPx, input.availableContainerWidthPx)
      : clampStudioZoomPercent(input.zoomPercent ?? 100);

  return {
    devicePreset: input.devicePreset,
    viewportWidthPx,
    breakpoint,
    zoomMode,
    zoomPercent: effectiveZoomPercent,
    zoomScale: Number((effectiveZoomPercent / 100).toFixed(4)),
  };
}
