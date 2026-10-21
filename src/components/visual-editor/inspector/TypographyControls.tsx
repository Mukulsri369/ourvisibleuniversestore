import React from "react";
import { type ResolvedInspectorPropertyState } from "@/lib/visual-editor/inspector";
import {
  FONT_WEIGHT_VALUES,
  TEXT_ALIGN_MODES,
  type TypographyConfig,
} from "@/lib/visual-editor/schema/appearance";
import { cn } from "@/lib/utils";
import { ColorControl } from "./ColorControl";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface TypographyControlsProps {
  typographyState: ResolvedInspectorPropertyState<TypographyConfig>;
  textColorState: ResolvedInspectorPropertyState<string>;
  disabled?: boolean;
  onUpdateStylePath: (path: string, value: unknown) => void;
  onResetStylePath: (path: string) => void;
}

const FONT_FAMILY_OPTIONS = [
  { value: "", label: "Default (Storefront Theme Font)" },
  { value: "Inter, sans-serif", label: "Inter (Clean Sans)" },
  { value: "Plus Jakarta Sans, sans-serif", label: "Plus Jakarta Sans (Display)" },
  { value: "Space Grotesk, sans-serif", label: "Space Grotesk (Technical)" },
  { value: "JetBrains Mono, monospace", label: "JetBrains Mono (Monospace)" },
  { value: "Georgia, serif", label: "Georgia (Editorial Serif)" },
] as const;

export function TypographyControls({
  typographyState,
  textColorState,
  disabled = false,
  onUpdateStylePath,
  onResetStylePath,
}: TypographyControlsProps) {
  const typo: TypographyConfig = typographyState.value ?? {};
  const fontSizeVal = typo.fontSize?.value ?? "";
  const fontSizeUnit = typo.fontSize?.unit === "rem" ? "rem" : "px";

  return (
    <div className="space-y-3" data-testid="inspector-typography-controls">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium text-foreground">Typography &amp; Text Style</span>
        <div className="flex items-center gap-1">
          <PropertyOriginBadge state={typographyState} />
          <PropertyResetButton
            propertyPath="appearance.typography"
            canReset={typographyState.canResetAtBreakpoint}
            disabled={disabled}
            onReset={() => onResetStylePath("appearance.typography")}
          />
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-1">
        <label
          htmlFor="inspector-font-family"
          className="block font-mono text-[10px] text-muted-foreground"
        >
          Font Family
        </label>
        <select
          id="inspector-font-family"
          disabled={disabled}
          value={typo.fontFamily ?? ""}
          data-testid="inspector-font-family"
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              onResetStylePath("appearance.typography.fontFamily");
            } else {
              onUpdateStylePath("appearance.typography.fontFamily", val);
            }
          }}
          className="h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground"
        >
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size & Font Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label
            htmlFor="inspector-font-size"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Font Size ({fontSizeUnit})
          </label>
          <div className="flex items-center gap-1">
            <input
              id="inspector-font-size"
              type="number"
              disabled={disabled}
              min={8}
              max={240}
              placeholder="Default"
              value={fontSizeVal}
              data-testid="inspector-font-size"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onResetStylePath("appearance.typography.fontSize");
                  return;
                }
                const num = Math.max(8, Math.min(240, Number(raw) || 16));
                onUpdateStylePath("appearance.typography.fontSize", {
                  value: num,
                  unit: fontSizeUnit,
                });
              }}
              className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
            />
            <select
              aria-label="Font size unit"
              disabled={disabled}
              value={fontSizeUnit}
              data-testid="inspector-font-size-unit"
              onChange={(e) => {
                const nextUnit = e.target.value as "px" | "rem";
                const num = typo.fontSize?.value ?? (nextUnit === "rem" ? 1 : 16);
                onUpdateStylePath("appearance.typography.fontSize", {
                  value: num,
                  unit: nextUnit,
                });
              }}
              className="h-7 rounded border border-border bg-background px-1 font-mono text-[10px] text-foreground"
            >
              <option value="px">px</option>
              <option value="rem">rem</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="inspector-font-weight"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Font Weight
          </label>
          <select
            id="inspector-font-weight"
            disabled={disabled}
            value={typo.fontWeight ?? ""}
            data-testid="inspector-font-weight"
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) {
                onResetStylePath("appearance.typography.fontWeight");
              } else {
                onUpdateStylePath("appearance.typography.fontWeight", Number(raw));
              }
            }}
            className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
          >
            <option value="">Default</option>
            {FONT_WEIGHT_VALUES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Height & Letter Spacing */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label
            htmlFor="inspector-line-height"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Line Height (0.5–4)
          </label>
          <input
            id="inspector-line-height"
            type="number"
            disabled={disabled}
            step={0.1}
            min={0.5}
            max={4}
            placeholder="Default"
            value={typo.lineHeight ?? ""}
            data-testid="inspector-line-height"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onResetStylePath("appearance.typography.lineHeight");
                return;
              }
              const val = Math.max(0.5, Math.min(4, Number(raw) || 1.4));
              onUpdateStylePath("appearance.typography.lineHeight", Number(val.toFixed(2)));
            }}
            className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="inspector-letter-spacing"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Letter Spacing (em)
          </label>
          <input
            id="inspector-letter-spacing"
            type="number"
            disabled={disabled}
            step={0.01}
            min={-0.2}
            max={1}
            placeholder="0"
            value={typo.letterSpacingEm ?? ""}
            data-testid="inspector-letter-spacing"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onResetStylePath("appearance.typography.letterSpacingEm");
                return;
              }
              const val = Math.max(-0.2, Math.min(1, Number(raw) || 0));
              onUpdateStylePath("appearance.typography.letterSpacingEm", Number(val.toFixed(3)));
            }}
            className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
          />
        </div>
      </div>

      {/* Text Alignment & Transform */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="block font-mono text-[10px] text-muted-foreground">Text Align</span>
          <div className="grid grid-cols-4 gap-1">
            {TEXT_ALIGN_MODES.map((align) => {
              const active = typo.textAlign === align;
              return (
                <button
                  key={align}
                  type="button"
                  disabled={disabled}
                  data-testid={`inspector-text-align-${align}`}
                  onClick={() => onUpdateStylePath("appearance.typography.textAlign", align)}
                  className={cn(
                    "rounded border py-1 font-mono text-[10px] capitalize transition-colors",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {align[0]?.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="inspector-text-transform"
            className="block font-mono text-[10px] text-muted-foreground"
          >
            Transform
          </label>
          <select
            id="inspector-text-transform"
            disabled={disabled}
            value={typo.textTransform ?? ""}
            data-testid="inspector-text-transform"
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                onResetStylePath("appearance.typography.textTransform");
              } else {
                onUpdateStylePath("appearance.typography.textTransform", val);
              }
            }}
            className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
          >
            <option value="">Default</option>
            <option value="none">None</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="capitalize">Capitalize</option>
            <option value="lowercase">lowercase</option>
          </select>
        </div>
      </div>

      {/* Text Color */}
      <ColorControl
        label="Text Color"
        propertyPath="appearance.typography.color"
        state={textColorState}
        disabled={disabled}
        selectTestId="inspector-text-color-select"
        inputTestId="inspector-text-color-input"
        pickerTestId="inspector-text-color-picker"
        onChange={(color) => {
          if (!color) {
            onResetStylePath("appearance.typography.color");
          } else {
            onUpdateStylePath("appearance.typography.color", color);
          }
        }}
        onReset={() => onResetStylePath("appearance.typography.color")}
      />
    </div>
  );
}
