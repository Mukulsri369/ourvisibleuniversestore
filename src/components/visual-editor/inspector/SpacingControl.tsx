import React, { useState } from "react";
import { Link2, Unlink2 } from "lucide-react";
import {
  validateSpacingBoxInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import type { SpacingBox } from "@/lib/visual-editor/schema/geometry";
import { cn } from "@/lib/utils";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface SpacingControlProps {
  field: "padding" | "margin";
  label: string;
  state: ResolvedInspectorPropertyState<SpacingBox>;
  disabled?: boolean;
  onChange: (box: SpacingBox | undefined) => void;
  onReset: () => void;
}

const DEFAULT_SPACING_BOX: SpacingBox = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  unit: "px",
};

export function SpacingControl({
  field,
  label,
  state,
  disabled = false,
  onChange,
  onReset,
}: SpacingControlProps) {
  const [linked, setLinked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentBox: SpacingBox = state.value ?? DEFAULT_SPACING_BOX;
  const currentUnit = currentBox.unit ?? "px";
  const minVal = field === "padding" ? 0 : -240;
  const maxVal = 400;

  const handleSideChange = (side: "top" | "right" | "bottom" | "left", rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setErrorMsg("Must be a finite number");
      return;
    }

    const clamped = Math.max(minVal, Math.min(maxVal, parsed));
    const nextBox: SpacingBox = linked
      ? {
          top: clamped,
          right: clamped,
          bottom: clamped,
          left: clamped,
          unit: currentUnit,
        }
      : {
          ...currentBox,
          [side]: clamped,
          unit: currentUnit,
        };

    const validated = validateSpacingBoxInput(nextBox, field);
    if (!validated.valid || !validated.value) {
      setErrorMsg(validated.error ?? `Invalid ${field}`);
      return;
    }

    setErrorMsg(null);
    onChange(validated.value);
  };

  const handleUnitChange = (unit: "px" | "rem") => {
    const nextBox: SpacingBox = {
      ...currentBox,
      unit,
    };
    const validated = validateSpacingBoxInput(nextBox, field);
    if (validated.valid && validated.value) {
      setErrorMsg(null);
      onChange(validated.value);
    }
  };

  return (
    <div className="space-y-2" data-testid={`inspector-spacing-${field}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={state} />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setLinked((prev) => !prev)}
            title={linked ? "Unlink sides (edit independently)" : "Link all 4 sides"}
            data-testid={`inspector-${field}-link-toggle`}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
              linked
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {linked ? <Link2 className="size-2.5" /> : <Unlink2 className="size-2.5" />}
            <span>{linked ? "Linked" : "Independent"}</span>
          </button>
          <select
            aria-label={`${label} unit`}
            disabled={disabled}
            value={currentUnit}
            data-testid={`inspector-${field}-unit`}
            onChange={(e) => handleUnitChange(e.target.value as "px" | "rem")}
            className="h-5 rounded border border-border bg-background px-1 font-mono text-[10px] text-foreground"
          >
            <option value="px">px</option>
            <option value="rem">rem</option>
          </select>
          <PropertyResetButton
            propertyPath={`geometry.${field}`}
            canReset={state.canResetAtBreakpoint}
            disabled={disabled}
            onReset={onReset}
            testId={`inspector-reset-${field}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <div key={side} className="space-y-1">
            <label
              htmlFor={`inspector-${field}-${side}`}
              className="block font-mono text-[10px] capitalize text-muted-foreground"
            >
              {field === "margin" ? `Margin ${side}` : side}
            </label>
            <input
              id={`inspector-${field}-${side}`}
              type="number"
              disabled={disabled}
              min={minVal}
              max={maxVal}
              value={currentBox[side]}
              data-testid={`inspector-${field}-${side}`}
              onChange={(e) => handleSideChange(side, e.target.value)}
              className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground focus:border-primary/60 focus:outline-none disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {errorMsg && <p className="text-[10px] text-destructive">{errorMsg}</p>}
    </div>
  );
}

export interface GapControlProps {
  columnGapState: ResolvedInspectorPropertyState<number>;
  rowGapState: ResolvedInspectorPropertyState<number>;
  disabled?: boolean;
  onChangeColumnGap: (gapPx: number) => void;
  onChangeRowGap: (gapPx: number) => void;
  onResetColumnGap: () => void;
  onResetRowGap: () => void;
}

export function GapControl({
  columnGapState,
  rowGapState,
  disabled = false,
  onChangeColumnGap,
  onChangeRowGap,
  onResetColumnGap,
  onResetRowGap,
}: GapControlProps) {
  const colGap = columnGapState.value ?? "";
  const rowGap = rowGapState.value ?? "";

  return (
    <div className="space-y-2 border-t border-border/60 pt-3" data-testid="inspector-gap-controls">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">Container Gaps (px)</span>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={columnGapState} />
          {(columnGapState.canResetAtBreakpoint || rowGapState.canResetAtBreakpoint) && (
            <button
              type="button"
              disabled={disabled}
              data-testid="inspector-reset-gap"
              onClick={() => {
                if (columnGapState.canResetAtBreakpoint) onResetColumnGap();
                if (rowGapState.canResetAtBreakpoint) onResetRowGap();
              }}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label
            htmlFor="inspector-column-gap-input"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Column / Rail Gap
          </label>
          <input
            id="inspector-column-gap-input"
            type="number"
            disabled={disabled}
            min={0}
            max={256}
            placeholder="Default"
            value={colGap}
            data-testid="inspector-column-gap-input"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onResetColumnGap();
                return;
              }
              const val = Math.max(0, Math.min(256, Number(raw) || 0));
              onChangeColumnGap(val);
            }}
            className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="inspector-row-gap-input"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Row Gap
          </label>
          <input
            id="inspector-row-gap-input"
            type="number"
            disabled={disabled}
            min={0}
            max={256}
            placeholder="Default"
            value={rowGap}
            data-testid="inspector-row-gap-input"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onResetRowGap();
                return;
              }
              const val = Math.max(0, Math.min(256, Number(raw) || 0));
              onChangeRowGap(val);
            }}
            className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
          />
        </div>
      </div>
    </div>
  );
}
