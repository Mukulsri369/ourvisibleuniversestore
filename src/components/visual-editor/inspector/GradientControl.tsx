import React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  validateGradientInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import type { GradientConfig, GradientStop } from "@/lib/visual-editor/schema/appearance";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface GradientControlProps {
  state: ResolvedInspectorPropertyState<GradientConfig>;
  disabled?: boolean;
  onChange: (gradient: GradientConfig) => void;
  onReset: () => void;
}

const DEFAULT_GRADIENT: GradientConfig = {
  type: "linear",
  angleDeg: 135,
  stops: [
    { color: "#0b1026", positionPercent: 0 },
    { color: "#1e1b4b", positionPercent: 100 },
  ],
};

export function GradientControl({
  state,
  disabled = false,
  onChange,
  onReset,
}: GradientControlProps) {
  const currentGradient = state.value;

  const commitGradient = (next: GradientConfig) => {
    const validated = validateGradientInput(next);
    if (validated.valid && validated.value) {
      onChange(validated.value);
    }
  };

  const handleStopChange = (index: number, patch: Partial<GradientStop>) => {
    const base = currentGradient ?? DEFAULT_GRADIENT;
    const nextStops = base.stops.map((stop, idx) =>
      idx === index ? { ...stop, ...patch } : stop,
    );
    commitGradient({
      ...base,
      stops: nextStops,
    });
  };

  const handleAddStop = () => {
    const base = currentGradient ?? DEFAULT_GRADIENT;
    if (base.stops.length >= 8) return;
    commitGradient({
      ...base,
      stops: [...base.stops, { color: "#38bdf8", positionPercent: 50 }],
    });
  };

  const handleRemoveStop = (index: number) => {
    const base = currentGradient ?? DEFAULT_GRADIENT;
    if (base.stops.length <= 2) return;
    commitGradient({
      ...base,
      stops: base.stops.filter((_, idx) => idx !== index),
    });
  };

  return (
    <div
      className="space-y-2 border-t border-border/60 pt-3"
      data-testid="inspector-gradient-control"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium text-foreground">Background Gradient</span>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={state} />
          {!currentGradient && !disabled && (
            <button
              type="button"
              data-testid="inspector-gradient-enable-btn"
              onClick={() => commitGradient(DEFAULT_GRADIENT)}
              className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-secondary"
            >
              + Add Gradient
            </button>
          )}
          <PropertyResetButton
            propertyPath="appearance.backgroundGradient"
            canReset={state.canResetAtBreakpoint}
            disabled={disabled}
            onReset={onReset}
          />
        </div>
      </div>

      {currentGradient && (
        <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/20 p-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label
                htmlFor="inspector-gradient-type"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Type
              </label>
              <select
                id="inspector-gradient-type"
                disabled={disabled}
                value={currentGradient.type}
                data-testid="inspector-gradient-type"
                onChange={(e) =>
                  commitGradient({
                    ...currentGradient,
                    type: e.target.value as GradientConfig["type"],
                  })
                }
                className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
              >
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
                <option value="conic">Conic</option>
              </select>
            </div>

            {currentGradient.type !== "radial" && (
              <div className="space-y-1">
                <label
                  htmlFor="inspector-gradient-angle"
                  className="block font-mono text-[10px] text-muted-foreground"
                >
                  Angle (°)
                </label>
                <input
                  id="inspector-gradient-angle"
                  type="number"
                  disabled={disabled}
                  min={0}
                  max={360}
                  value={currentGradient.angleDeg ?? 180}
                  data-testid="inspector-gradient-angle"
                  onChange={(e) => {
                    const deg = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                    commitGradient({
                      ...currentGradient,
                      angleDeg: deg,
                    });
                  }}
                  className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
                />
              </div>
            )}
          </div>

          {/* Gradient Stops */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">
                Color Stops ({currentGradient.stops.length})
              </span>
              {currentGradient.stops.length < 8 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleAddStop}
                  data-testid="inspector-gradient-add-stop"
                  className="inline-flex items-center gap-0.5 font-mono text-[10px] text-primary hover:underline"
                >
                  <Plus className="size-2.5" /> Stop
                </button>
              )}
            </div>

            {currentGradient.stops.map((stop, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  type="color"
                  disabled={disabled}
                  aria-label={`Gradient stop ${idx + 1} color`}
                  value={/^#[0-9a-fA-F]{6}$/.test(stop.color) ? stop.color : "#0b1026"}
                  data-testid={`inspector-gradient-stop-color-${idx}`}
                  onChange={(e) => handleStopChange(idx, { color: e.target.value })}
                  className="h-6 w-7 shrink-0 cursor-pointer rounded border border-border bg-background p-0.5"
                />
                <input
                  type="text"
                  disabled={disabled}
                  aria-label={`Gradient stop ${idx + 1} CSS color`}
                  value={stop.color}
                  onChange={(e) => handleStopChange(idx, { color: e.target.value })}
                  className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1.5 font-mono text-[11px] text-foreground"
                />
                <input
                  type="number"
                  disabled={disabled}
                  aria-label={`Gradient stop ${idx + 1} position percent`}
                  min={0}
                  max={100}
                  value={stop.positionPercent}
                  data-testid={`inspector-gradient-stop-pos-${idx}`}
                  onChange={(e) =>
                    handleStopChange(idx, {
                      positionPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    })
                  }
                  className="h-6 w-14 shrink-0 rounded border border-border bg-background px-1.5 font-mono text-[11px] tabular-nums text-foreground"
                />
                {currentGradient.stops.length > 2 && (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Remove stop ${idx + 1}`}
                    onClick={() => handleRemoveStop(idx)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
