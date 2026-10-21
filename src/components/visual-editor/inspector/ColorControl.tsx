import React, { useEffect, useState } from "react";
import {
  validateColorInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export const THEME_COLOR_PRESET_OPTIONS = [
  { value: "", label: "Default (Component Native)" },
  { value: "token:background", label: "Theme Background (token:background)" },
  { value: "token:card", label: "Theme Card Surface (token:card)" },
  { value: "token:secondary", label: "Theme Secondary Surface (token:secondary)" },
  { value: "token:primary", label: "Theme Primary Accent (token:primary)" },
  { value: "token:accent", label: "Theme Cosmic Accent (token:accent)" },
  { value: "token:foreground", label: "Theme Foreground Text (token:foreground)" },
  { value: "token:muted-foreground", label: "Theme Muted Text (token:muted-foreground)" },
  { value: "token:border", label: "Theme Border (token:border)" },
  { value: "token:nebula", label: "Cosmic Nebula Surface (token:nebula)" },
  { value: "#0b1026", label: "Deep Space Indigo (#0b1026)" },
  { value: "#111836", label: "Orbital Slate (#111836)" },
  { value: "#1e1b4b", label: "Starlight Violet (#1e1b4b)" },
] as const;

export interface ColorControlProps {
  label: string;
  propertyPath: string;
  state: ResolvedInspectorPropertyState<string>;
  disabled?: boolean;
  selectTestId?: string;
  inputTestId?: string;
  pickerTestId?: string;
  onChange: (color: string | null) => void;
  onReset: () => void;
}

function normalizePickerHex(color: string | undefined): string {
  if (!color) return "#0b1026";
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#0b1026";
}

export function ColorControl({
  label,
  propertyPath,
  state,
  disabled = false,
  selectTestId,
  inputTestId,
  pickerTestId,
  onChange,
  onReset,
}: ColorControlProps) {
  const currentColor = state.value ?? "";
  const [draftText, setDraftText] = useState(currentColor);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftText(currentColor);
    setErrorMsg(null);
  }, [currentColor, state.breakpoint]);

  const handleTextCommit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setErrorMsg(null);
      onReset();
      return;
    }

    const validated = validateColorInput(trimmed);
    if (!validated.valid || !validated.value) {
      setErrorMsg(validated.error ?? "Invalid color format");
      return;
    }

    setErrorMsg(null);
    onChange(validated.value);
  };

  const isPresetMatch = THEME_COLOR_PRESET_OPTIONS.some((o) => o.value === currentColor);

  return (
    <div className="space-y-2" data-testid={`inspector-color-control-${propertyPath}`}>
      <div className="flex items-center justify-between gap-1">
        <label
          htmlFor={selectTestId ?? `inspector-color-select-${propertyPath}`}
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
            onReset={() => {
              setErrorMsg(null);
              onReset();
            }}
          />
        </div>
      </div>

      {/* Preset / Theme Token Dropdown */}
      <select
        id={selectTestId ?? `inspector-color-select-${propertyPath}`}
        disabled={disabled}
        data-testid={selectTestId ?? `inspector-color-select-${propertyPath}`}
        value={isPresetMatch ? currentColor : "__custom__"}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "__custom__") return;
          setErrorMsg(null);
          if (!val) {
            onChange(null);
          } else {
            onChange(val);
          }
        }}
        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
      >
        {THEME_COLOR_PRESET_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-card text-foreground">
            {opt.label}
          </option>
        ))}
        {!isPresetMatch && currentColor && (
          <option value="__custom__" className="bg-card text-foreground">
            Custom ({currentColor})
          </option>
        )}
      </select>

      {/* Color Swatch Picker + Hex/RGB/HSL/OKLCH/Token Text Input */}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={`${label} color picker`}
          disabled={disabled}
          value={normalizePickerHex(currentColor)}
          data-testid={pickerTestId ?? `inspector-color-picker-${propertyPath}`}
          onChange={(e) => {
            const hex = e.target.value;
            setDraftText(hex);
            setErrorMsg(null);
            onChange(hex);
          }}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-background p-0.5 disabled:opacity-50"
        />

        <input
          type="text"
          aria-label={`${label} CSS value`}
          disabled={disabled}
          placeholder="#0b1026, rgb(), oklch(), token:card"
          value={draftText}
          data-testid={inputTestId ?? `inspector-color-input-${propertyPath}`}
          onChange={(e) => {
            const next = e.target.value;
            setDraftText(next);
            const trimmed = next.trim();
            if (trimmed === "") {
              setErrorMsg(null);
              onReset();
              return;
            }
            const validated = validateColorInput(trimmed);
            if (validated.valid && validated.value) {
              setErrorMsg(null);
              onChange(validated.value);
            }
          }}
          onBlur={() => handleTextCommit(draftText)}
          className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none disabled:opacity-50"
        />
      </div>

      {errorMsg && (
        <p
          data-testid={`inspector-color-error-${propertyPath}`}
          className="text-[10px] text-destructive"
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}
