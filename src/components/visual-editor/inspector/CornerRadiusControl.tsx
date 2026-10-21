import React from "react";
import {
  validateCornerRadiusInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import {
  CORNER_RADIUS_UNITS,
  type CornerRadiusConfig,
  type CornerRadiusMode,
  type CornerRadiusUnit,
} from "@/lib/visual-editor/schema/shapes";
import { cn } from "@/lib/utils";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface CornerRadiusControlProps {
  state: ResolvedInspectorPropertyState<CornerRadiusConfig>;
  disabled?: boolean;
  onChange: (radius: CornerRadiusConfig | null) => void;
  onReset: () => void;
}

const CORNER_SIDES = [
  { key: "topLeft", label: "Top Left", short: "TL" },
  { key: "topRight", label: "Top Right", short: "TR" },
  { key: "bottomLeft", label: "Bottom Left", short: "BL" },
  { key: "bottomRight", label: "Bottom Right", short: "BR" },
] as const;

export function CornerRadiusControl({
  state,
  disabled = false,
  onChange,
  onReset,
}: CornerRadiusControlProps) {
  const currentRadius = state.value;
  const mode: CornerRadiusMode = currentRadius?.mode ?? "uniform";
  const unit: CornerRadiusUnit = currentRadius?.unit ?? "px";
  const uniformVal = currentRadius?.uniform ?? "";

  const handleModeSwitch = (nextMode: CornerRadiusMode) => {
    if (nextMode === "uniform") {
      const baseNum =
        currentRadius?.uniform ??
        currentRadius?.topLeft ??
        currentRadius?.topRight ??
        16;
      const candidate: CornerRadiusConfig = {
        mode: "uniform",
        uniform: baseNum,
        unit,
      };
      const validated = validateCornerRadiusInput(candidate);
      if (validated.valid && validated.value) {
        onChange(validated.value);
      }
    } else {
      const baseNum = currentRadius?.uniform ?? 16;
      const candidate: CornerRadiusConfig = {
        mode: "independent",
        topLeft: currentRadius?.topLeft ?? baseNum,
        topRight: currentRadius?.topRight ?? baseNum,
        bottomRight: currentRadius?.bottomRight ?? baseNum,
        bottomLeft: currentRadius?.bottomLeft ?? baseNum,
        unit,
      };
      const validated = validateCornerRadiusInput(candidate);
      if (validated.valid && validated.value) {
        onChange(validated.value);
      }
    }
  };

  const handleUniformChange = (raw: string) => {
    if (raw === "") {
      onChange(null);
      return;
    }
    const num = Math.max(0, Math.min(9999, Number(raw) || 0));
    const candidate: CornerRadiusConfig = {
      mode: "uniform",
      uniform: num,
      unit,
    };
    const validated = validateCornerRadiusInput(candidate);
    if (validated.valid && validated.value) {
      onChange(validated.value);
    }
  };

  const handleCornerChange = (
    cornerKey: "topLeft" | "topRight" | "bottomRight" | "bottomLeft",
    raw: string,
  ) => {
    const num = Math.max(0, Math.min(9999, Number(raw) || 0));
    const baseNum = currentRadius?.uniform ?? 0;
    const candidate: CornerRadiusConfig = {
      mode: "independent",
      topLeft: currentRadius?.topLeft ?? baseNum,
      topRight: currentRadius?.topRight ?? baseNum,
      bottomRight: currentRadius?.bottomRight ?? baseNum,
      bottomLeft: currentRadius?.bottomLeft ?? baseNum,
      [cornerKey]: num,
      unit,
    };
    const validated = validateCornerRadiusInput(candidate);
    if (validated.valid && validated.value) {
      onChange(validated.value);
    }
  };

  const handleUnitChange = (nextUnit: CornerRadiusUnit) => {
    if (!currentRadius) {
      onChange({
        mode: "uniform",
        uniform: 16,
        unit: nextUnit,
      });
      return;
    }
    const candidate: CornerRadiusConfig = {
      ...currentRadius,
      unit: nextUnit,
    };
    const validated = validateCornerRadiusInput(candidate);
    if (validated.valid && validated.value) {
      onChange(validated.value);
    }
  };

  return (
    <div className="space-y-2" data-testid="inspector-corner-radius-control">
      <div className="flex items-center justify-between gap-1">
        <label
          htmlFor="inspector-radius-input"
          className="font-sans text-xs font-semibold text-foreground"
        >
          Corner Radius ({unit})
        </label>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={state} />
          <PropertyResetButton
            propertyPath="shape.cornerRadius"
            canReset={state.canResetAtBreakpoint}
            disabled={disabled}
            onReset={onReset}
            testId="inspector-reset-corner-radius"
          />
        </div>
      </div>

      {/* Mode Switch + Unit Selector */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="inline-flex rounded-md border border-border bg-secondary/30 p-0.5">
          <button
            type="button"
            disabled={disabled}
            data-testid="inspector-radius-mode-uniform"
            onClick={() => handleModeSwitch("uniform")}
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
              mode === "uniform"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Uniform
          </button>
          <button
            type="button"
            disabled={disabled}
            data-testid="inspector-radius-mode-independent"
            onClick={() => handleModeSwitch("independent")}
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
              mode === "independent"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            4 Corners
          </button>
        </div>

        <select
          aria-label="Corner radius unit"
          disabled={disabled}
          value={unit}
          data-testid="inspector-radius-unit"
          onChange={(e) => handleUnitChange(e.target.value as CornerRadiusUnit)}
          className="h-6 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-foreground"
        >
          {CORNER_RADIUS_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      {mode === "uniform" ? (
        <input
          id="inspector-radius-input"
          type="number"
          disabled={disabled}
          min={0}
          max={9999}
          placeholder="Default"
          value={uniformVal}
          data-testid="inspector-radius-input"
          onChange={(e) => handleUniformChange(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-background px-2.5 font-mono text-xs tabular-nums text-foreground"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2" data-testid="inspector-radius-independent-grid">
          {CORNER_SIDES.map(({ key, label, short }) => {
            const val = currentRadius?.[key] ?? 0;
            return (
              <div key={key} className="space-y-1">
                <label
                  htmlFor={`inspector-radius-${key}`}
                  className="flex items-center justify-between font-mono text-[10px] text-muted-foreground"
                >
                  <span>{label}</span>
                  <span>{short}</span>
                </label>
                <input
                  id={`inspector-radius-${key}`}
                  type="number"
                  disabled={disabled}
                  min={0}
                  max={9999}
                  value={val}
                  data-testid={`inspector-radius-${key}`}
                  onChange={(e) => handleCornerChange(key, e.target.value)}
                  className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
