import React from "react";
import {
  validateMediaCropInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import { ASPECT_RATIO_PRESETS } from "@/lib/visual-editor/schema/geometry";
import type { ImageCropConfig } from "@/lib/visual-editor/schema/shapes";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface MediaPresentationControlsProps {
  imageCropState: ResolvedInspectorPropertyState<ImageCropConfig>;
  mediaSourceUrl?: string | null;
  disabled?: boolean;
  onChange: (crop: ImageCropConfig) => void;
  onReset: () => void;
}

const OBJECT_FIT_OPTIONS = [
  { value: "cover", label: "Cover (Fill & Crop)" },
  { value: "contain", label: "Contain (Full Image)" },
  { value: "fill", label: "Stretch to Fill" },
  { value: "scale-down", label: "Scale Down" },
  { value: "none", label: "Original Size" },
] as const;

export function MediaPresentationControls({
  imageCropState,
  mediaSourceUrl,
  disabled = false,
  onChange,
  onReset,
}: MediaPresentationControlsProps) {
  const currentCrop = imageCropState.value;
  const objectFit = currentCrop?.objectFit ?? "cover";
  const aspectRatio = currentCrop?.aspectRatio ?? "auto";
  const focalX = currentCrop?.focalPoint?.xPercent ?? 50;
  const focalY = currentCrop?.focalPoint?.yPercent ?? 50;
  const zoom = currentCrop?.zoom ?? 1;

  const commitCrop = (patch: Partial<ImageCropConfig>) => {
    const candidate: ImageCropConfig = {
      objectFit,
      aspectRatio,
      ...currentCrop,
      ...patch,
    };
    const validated = validateMediaCropInput(candidate);
    if (validated.valid && validated.value) {
      onChange(validated.value);
    }
  };

  return (
    <div className="space-y-3" data-testid="inspector-media-controls">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium text-foreground">Image Fit &amp; Framing</span>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={imageCropState} />
          <PropertyResetButton
            propertyPath="shape.imageCrop"
            canReset={imageCropState.canResetAtBreakpoint}
            disabled={disabled}
            onReset={onReset}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label
            htmlFor="inspector-media-object-fit"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Object Fit
          </label>
          <select
            id="inspector-media-object-fit"
            disabled={disabled}
            value={objectFit}
            data-testid="inspector-media-object-fit"
            onChange={(e) =>
              commitCrop({ objectFit: e.target.value as ImageCropConfig["objectFit"] })
            }
            className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
          >
            {OBJECT_FIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="inspector-media-aspect-ratio"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Frame Aspect Ratio
          </label>
          <select
            id="inspector-media-aspect-ratio"
            disabled={disabled}
            value={aspectRatio}
            data-testid="inspector-media-aspect-ratio"
            onChange={(e) =>
              commitCrop({ aspectRatio: e.target.value as ImageCropConfig["aspectRatio"] })
            }
            className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
          >
            {ASPECT_RATIO_PRESETS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Focal Point X / Y & Zoom */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="space-y-1">
          <label
            htmlFor="inspector-media-focal-x"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Focal X (%)
          </label>
          <input
            id="inspector-media-focal-x"
            type="number"
            disabled={disabled}
            min={0}
            max={100}
            value={focalX}
            data-testid="inspector-media-focal-x"
            onChange={(e) => {
              const x = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              commitCrop({
                focalPoint: { xPercent: x, yPercent: focalY },
              });
            }}
            className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs tabular-nums text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="inspector-media-focal-y"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Focal Y (%)
          </label>
          <input
            id="inspector-media-focal-y"
            type="number"
            disabled={disabled}
            min={0}
            max={100}
            value={focalY}
            data-testid="inspector-media-focal-y"
            onChange={(e) => {
              const y = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              commitCrop({
                focalPoint: { xPercent: focalX, yPercent: y },
              });
            }}
            className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs tabular-nums text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="inspector-media-zoom"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Zoom (1–3×)
          </label>
          <input
            id="inspector-media-zoom"
            type="number"
            disabled={disabled}
            step={0.1}
            min={1}
            max={3}
            value={zoom}
            data-testid="inspector-media-zoom"
            onChange={(e) => {
              const z = Math.max(1, Math.min(3, Number(e.target.value) || 1));
              commitCrop({ zoom: Number(z.toFixed(2)) });
            }}
            className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs tabular-nums text-foreground"
          />
        </div>
      </div>

      {mediaSourceUrl && (
        <div className="rounded border border-border/60 bg-secondary/25 px-2 py-1.5 text-[10px] text-muted-foreground">
          <span className="block font-medium text-foreground">Protected Asset Reference</span>
          <code className="mt-0.5 block truncate font-mono text-[10px]">{mediaSourceUrl}</code>
        </div>
      )}
    </div>
  );
}
