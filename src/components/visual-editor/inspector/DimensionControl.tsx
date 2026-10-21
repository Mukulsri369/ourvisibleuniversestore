import React, { useEffect, useState } from "react";
import {
  isKeywordDimensionUnit,
  validateAspectRatioInput,
  validateDimensionInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import {
  ASPECT_RATIO_PRESETS,
  DIMENSION_UNITS,
  type AspectRatioPreset,
  type DimensionUnit,
  type DimensionValue,
} from "@/lib/visual-editor/schema/geometry";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface DimensionControlProps {
  label: string;
  propertyPath:
    | "geometry.width"
    | "geometry.height"
    | "geometry.minWidth"
    | "geometry.maxWidth"
    | "geometry.minHeight"
    | "geometry.maxHeight";
  state: ResolvedInspectorPropertyState<DimensionValue>;
  renderedPx?: number;
  disabled?: boolean;
  onChange: (value: DimensionValue) => void;
  onReset: () => void;
}

export function DimensionControl({
  label,
  propertyPath,
  state,
  renderedPx,
  disabled = false,
  onChange,
  onReset,
}: DimensionControlProps) {
  const currentVal = state.value;
  const currentUnit: DimensionUnit = currentVal?.unit ?? "px";
  const isKeyword = isKeywordDimensionUnit(currentUnit);

  const [draftText, setDraftText] = useState<string>(
    currentVal?.value !== undefined ? String(currentVal.value) : "",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftText(currentVal?.value !== undefined ? String(currentVal.value) : "");
    setErrorMsg(null);
  }, [currentVal?.value, currentVal?.unit, state.breakpoint]);

  const commitNumericText = (raw: string, unit: DimensionUnit) => {
    if (isKeywordDimensionUnit(unit)) {
      setErrorMsg(null);
      onChange({ unit });
      return;
    }

    const trimmed = raw.trim();
    if (trimmed === "") {
      setErrorMsg(null);
      onReset();
      return;
    }

    if (trimmed === "-" || trimmed.endsWith(".")) {
      return;
    }

    const validated = validateDimensionInput(trimmed, unit);
    if (!validated.valid || !validated.value) {
      setErrorMsg(validated.error ?? "Invalid dimension");
      return;
    }

    setErrorMsg(null);
    onChange(validated.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || isKeyword) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      const base = Number(draftText) || renderedPx || 0;
      const nextNum = Math.max(0, base + delta);
      const nextStr = String(nextNum);
      setDraftText(nextStr);
      commitNumericText(nextStr, currentUnit);
    }
  };

  const shortKey = propertyPath.replace("geometry.", "");

  return (
    <div className="space-y-1" data-testid={`inspector-dimension-${shortKey}`}>
      <div className="flex items-center justify-between gap-1">
        <label
          htmlFor={`inspector-dim-input-${shortKey}`}
          className="text-[11px] font-medium text-muted-foreground"
        >
          {label}
        </label>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={state} />
          <PropertyResetButton
            propertyPath={propertyPath}
            canReset={state.canResetAtBreakpoint}
            disabled={disabled}
            onReset={onReset}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          id={`inspector-dim-input-${shortKey}`}
          type="text"
          inputMode="decimal"
          disabled={disabled || isKeyword}
          placeholder={
            isKeyword ? currentUnit : renderedPx !== undefined ? `Auto (${renderedPx}px)` : "Auto"
          }
          value={isKeyword ? "" : draftText}
          data-testid={`inspector-dimension-input-${shortKey}`}
          onChange={(e) => {
            const val = e.target.value;
            setDraftText(val);
            commitNumericText(val, currentUnit);
          }}
          onKeyDown={handleKeyDown}
          className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none disabled:opacity-50"
        />

        <select
          aria-label={`${label} unit`}
          disabled={disabled}
          value={currentUnit}
          data-testid={`inspector-dimension-unit-${shortKey}`}
          onChange={(e) => {
            const nextUnit = e.target.value as DimensionUnit;
            if (isKeywordDimensionUnit(nextUnit)) {
              setErrorMsg(null);
              onChange({ unit: nextUnit });
            } else {
              const fallbackVal =
                currentVal?.value ??
                (Number.isFinite(Number(draftText)) && draftText.trim() !== ""
                  ? Number(draftText)
                  : (renderedPx ?? 100));
              const nextStr = String(fallbackVal);
              setDraftText(nextStr);
              commitNumericText(nextStr, nextUnit);
            }
          }}
          className="h-7 shrink-0 rounded border border-border bg-background px-1.5 font-mono text-[11px] text-foreground focus:border-primary/60 focus:outline-none disabled:opacity-50"
        >
          {DIMENSION_UNITS.map((u) => (
            <option key={u} value={u} className="bg-card text-foreground">
              {u}
            </option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <p
          data-testid={`inspector-dimension-error-${shortKey}`}
          className="text-[10px] text-destructive"
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}

export interface AspectRatioControlProps {
  state: ResolvedInspectorPropertyState<AspectRatioPreset>;
  disabled?: boolean;
  onChange: (value: AspectRatioPreset) => void;
  onReset: () => void;
}

export function AspectRatioControl({
  state,
  disabled = false,
  onChange,
  onReset,
}: AspectRatioControlProps) {
  const currentRatio = state.value ?? "auto";

  return (
    <div className="space-y-1" data-testid="inspector-aspect-ratio-control">
      <div className="flex items-center justify-between gap-1">
        <label
          htmlFor="inspector-aspect-ratio-select"
          className="text-[11px] font-medium text-muted-foreground"
        >
          Aspect Ratio
        </label>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={state} />
          <PropertyResetButton
            propertyPath="geometry.aspectRatio"
            canReset={state.canResetAtBreakpoint}
            disabled={disabled}
            onReset={onReset}
          />
        </div>
      </div>

      <select
        id="inspector-aspect-ratio-select"
        disabled={disabled}
        value={currentRatio}
        data-testid="inspector-aspect-ratio-select"
        onChange={(e) => {
          const val = e.target.value;
          const validated = validateAspectRatioInput(val);
          if (validated.valid && validated.value) {
            onChange(validated.value);
          }
        }}
        className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs text-foreground focus:border-primary/60 focus:outline-none disabled:opacity-50"
      >
        {ASPECT_RATIO_PRESETS.map((preset) => (
          <option key={preset} value={preset} className="bg-card text-foreground">
            {preset === "auto" ? "Auto (Unconstrained)" : preset}
          </option>
        ))}
      </select>
    </div>
  );
}
