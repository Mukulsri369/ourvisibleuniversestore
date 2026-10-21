import React from "react";
import { Laptop, Maximize2, Smartphone, Tablet, ZoomIn, ZoomOut } from "lucide-react";
import type { EditorBreakpoint } from "@/lib/visual-editor/schema/responsive";
import {
  MAX_STUDIO_VIEWPORT_WIDTH_PX,
  MIN_STUDIO_VIEWPORT_WIDTH_PX,
  STUDIO_DEVICE_PRESETS,
  STUDIO_QUICK_DIMENSIONS,
  STUDIO_ZOOM_PRESETS,
  type StudioDevicePreset,
  type StudioZoomMode,
} from "@/lib/visual-editor/studio";
import { cn } from "@/lib/utils";

export interface StudioViewportControlsProps {
  devicePreset: StudioDevicePreset;
  viewportWidthPx: number;
  breakpoint: EditorBreakpoint;
  zoomMode: StudioZoomMode;
  zoomPercent: number;
  onSelectDevicePreset: (preset: Exclude<StudioDevicePreset, "custom">) => void;
  onChangeViewportWidth: (widthPx: number) => void;
  onChangeZoom: (zoomPercent: number, mode?: StudioZoomMode) => void;
}

export function StudioViewportControls({
  devicePreset,
  viewportWidthPx,
  breakpoint,
  zoomMode,
  zoomPercent,
  onSelectDevicePreset,
  onChangeViewportWidth,
  onChangeZoom,
}: StudioViewportControlsProps) {
  const presets: {
    id: Exclude<StudioDevicePreset, "custom">;
    label: string;
    width: number;
    icon: typeof Laptop;
  }[] = [
    {
      id: "desktop",
      label: "Desktop",
      width: STUDIO_DEVICE_PRESETS.desktop.widthPx,
      icon: Laptop,
    },
    {
      id: "tablet",
      label: "Tablet",
      width: STUDIO_DEVICE_PRESETS.tablet.widthPx,
      icon: Tablet,
    },
    {
      id: "mobile",
      label: "Mobile",
      width: STUDIO_DEVICE_PRESETS.mobile.widthPx,
      icon: Smartphone,
    },
  ];

  const handleStepZoom = (delta: number) => {
    const next = Math.max(25, Math.min(150, zoomPercent + delta));
    onChangeZoom(next, "manual");
  };

  return (
    <div
      data-testid="studio-viewport-controls"
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      {/* Device Preset Segmented Controls */}
      <div
        role="group"
        aria-label="Viewport device presets"
        className="flex items-center gap-0.5 rounded-lg border border-border/80 bg-secondary/50 p-0.5"
      >
        {presets.map((p) => {
          const Icon = p.icon;
          const active = devicePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              aria-label={`${p.label} (${p.width}px)`}
              data-testid={`studio-preset-${p.id}`}
              onClick={() => onSelectDevicePreset(p.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden xl:inline">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Viewport Width Selector & Input */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/35 px-2 py-1">
        <label htmlFor="studio-viewport-width-select" className="sr-only">
          Viewport dimension preset
        </label>
        <select
          id="studio-viewport-width-select"
          aria-label="Viewport width preset"
          data-testid="studio-viewport-width-select"
          value={
            STUDIO_QUICK_DIMENSIONS.some((d) => d.widthPx === viewportWidthPx)
              ? String(viewportWidthPx)
              : "custom"
          }
          onChange={(e) => {
            const val = Number(e.target.value);
            if (Number.isFinite(val) && val > 0) {
              onChangeViewportWidth(val);
            }
          }}
          className="bg-transparent font-mono text-xs tabular-nums text-foreground focus:outline-none"
        >
          {STUDIO_QUICK_DIMENSIONS.map((dim) => (
            <option key={dim.widthPx} value={dim.widthPx} className="bg-card text-foreground">
              {dim.widthPx}px
            </option>
          ))}
          {!STUDIO_QUICK_DIMENSIONS.some((d) => d.widthPx === viewportWidthPx) && (
            <option value="custom" className="bg-card text-foreground">
              {viewportWidthPx}px (Custom)
            </option>
          )}
        </select>

        <span aria-hidden="true" className="text-muted-foreground/50">
          ·
        </span>

        <label htmlFor="studio-custom-width-input" className="sr-only">
          Custom viewport width in pixels
        </label>
        <input
          id="studio-custom-width-input"
          type="number"
          min={MIN_STUDIO_VIEWPORT_WIDTH_PX}
          max={MAX_STUDIO_VIEWPORT_WIDTH_PX}
          value={viewportWidthPx}
          aria-label="Custom viewport width in pixels"
          data-testid="studio-custom-width-input"
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) {
              onChangeViewportWidth(parsed);
            }
          }}
          className="w-14 bg-transparent text-right font-mono text-xs tabular-nums text-muted-foreground focus:text-foreground focus:outline-none"
        />
        <span className="font-mono text-[11px] text-muted-foreground">· {breakpoint}</span>
      </div>

      {/* Canvas Zoom Controls */}
      <div
        role="group"
        aria-label="Canvas display zoom"
        className="flex items-center gap-0.5 rounded-lg border border-border/80 bg-secondary/50 p-0.5"
      >
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => handleStepZoom(-25)}
          disabled={zoomPercent <= 25 && zoomMode === "manual"}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <ZoomOut className="size-3.5" />
        </button>

        <label htmlFor="studio-zoom-select" className="sr-only">
          Canvas zoom level
        </label>
        <select
          id="studio-zoom-select"
          aria-label="Canvas zoom level"
          data-testid="studio-zoom-select"
          value={zoomMode === "fit" ? "fit" : String(zoomPercent)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "fit") {
              onChangeZoom(zoomPercent, "fit");
            } else {
              onChangeZoom(Number(val), "manual");
            }
          }}
          className="h-7 rounded px-1.5 font-mono text-xs tabular-nums text-foreground bg-transparent focus:outline-none"
        >
          {STUDIO_ZOOM_PRESETS.map((z) => (
            <option key={z} value={String(z)} className="bg-card text-foreground">
              {z}%
            </option>
          ))}
          <option value="fit" className="bg-card text-foreground">
            Fit ({zoomPercent}%)
          </option>
        </select>

        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => handleStepZoom(25)}
          disabled={zoomPercent >= 150 && zoomMode === "manual"}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <ZoomIn className="size-3.5" />
        </button>

        <button
          type="button"
          aria-pressed={zoomMode === "fit"}
          aria-label="Fit canvas to workspace"
          data-testid="studio-zoom-fit"
          onClick={() => onChangeZoom(zoomPercent, zoomMode === "fit" ? "manual" : "fit")}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
            zoomMode === "fit"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Maximize2 className="size-3" />
          <span className="hidden sm:inline">Fit</span>
        </button>
      </div>
    </div>
  );
}
