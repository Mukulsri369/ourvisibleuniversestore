import React from "react";
import {
  validateClipPresetInput,
  validateShapeTypeInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import {
  CLIP_SHAPE_PRESETS,
  SHAPE_TYPES,
  type ClipShapePreset,
  type ShapeType,
} from "@/lib/visual-editor/schema/shapes";
import { cn } from "@/lib/utils";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface ShapeControlProps {
  supportsShapeType: boolean;
  supportsClipShape: boolean;
  shapeTypeState: ResolvedInspectorPropertyState<ShapeType>;
  clipPresetState: ResolvedInspectorPropertyState<ClipShapePreset>;
  disabled?: boolean;
  onChangeShapeType: (shapeType: ShapeType) => void;
  onResetShapeType: () => void;
  onChangeClipPreset: (clipPreset: ClipShapePreset) => void;
  onResetClipPreset: () => void;
}

const SHAPE_LABELS: Record<ShapeType, string> = {
  square: "Square",
  rectangle: "Rectangle",
  "rounded-rectangle": "Rounded",
  pill: "Pill",
  circle: "Circle",
  ellipse: "Ellipse",
  hexagon: "Hexagon",
  octagon: "Octagon",
  diamond: "Diamond",
  arch: "Arch",
};

export function ShapeControl({
  supportsShapeType,
  supportsClipShape,
  shapeTypeState,
  clipPresetState,
  disabled = false,
  onChangeShapeType,
  onResetShapeType,
  onChangeClipPreset,
  onResetClipPreset,
}: ShapeControlProps) {
  if (!supportsShapeType && !supportsClipShape) return null;

  const currentShape = shapeTypeState.value;
  const currentClip = clipPresetState.value ?? "none";

  const availableShapes = SHAPE_TYPES.filter((s) => {
    if (
      !supportsClipShape &&
      (s === "hexagon" || s === "octagon" || s === "diamond")
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-3" data-testid="inspector-shape-control">
      {supportsShapeType && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-foreground">Shape Silhouette Preset</span>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={shapeTypeState} />
              <PropertyResetButton
                propertyPath="shape.shapeType"
                canReset={shapeTypeState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={onResetShapeType}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Shape presets">
            {availableShapes.map((shape) => {
              const active = currentShape === shape;
              return (
                <button
                  key={shape}
                  type="button"
                  disabled={disabled}
                  data-testid={`inspector-shape-preset-${shape}`}
                  onClick={() => {
                    const validated = validateShapeTypeInput(shape);
                    if (validated.valid && validated.value) {
                      onChangeShapeType(validated.value);
                    }
                  }}
                  className={cn(
                    "rounded-md border px-2 py-1.5 font-mono text-[10px] font-medium transition-colors disabled:opacity-50",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  {SHAPE_LABELS[shape]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {supportsClipShape && (
        <div className="space-y-1 border-t border-border/60 pt-2.5">
          <div className="flex items-center justify-between gap-1">
            <label
              htmlFor="inspector-clip-preset-select"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Polygon / Clip-Path Mask
            </label>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={clipPresetState} />
              <PropertyResetButton
                propertyPath="shape.clipPreset"
                canReset={clipPresetState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={onResetClipPreset}
              />
            </div>
          </div>

          <select
            id="inspector-clip-preset-select"
            disabled={disabled}
            value={currentClip}
            data-testid="inspector-clip-preset-select"
            onChange={(e) => {
              const val = e.target.value;
              if (val === "none") {
                onResetClipPreset();
                return;
              }
              const validated = validateClipPresetInput(val);
              if (validated.valid && validated.value) {
                onChangeClipPreset(validated.value);
              }
            }}
            className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs text-foreground"
          >
            {CLIP_SHAPE_PRESETS.map((clip) => (
              <option key={clip} value={clip} className="bg-card text-foreground">
                {clip === "none" ? "None (Standard Box)" : clip}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
