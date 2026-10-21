import React from "react";
import {
  validateBorderInput,
  validateFiltersInput,
  validateShadowInput,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import {
  BORDER_STYLES,
  SHADOW_PRESETS,
  type BorderConfig,
  type FilterConfig,
  type ShadowConfig,
} from "@/lib/visual-editor/schema/appearance";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface AppearanceEffectsControlProps {
  supportsBorder: boolean;
  supportsShadow: boolean;
  supportsOpacity: boolean;
  supportsFilters: boolean;
  borderState: ResolvedInspectorPropertyState<BorderConfig>;
  shadowState: ResolvedInspectorPropertyState<ShadowConfig>;
  opacityState: ResolvedInspectorPropertyState<number>;
  filtersState: ResolvedInspectorPropertyState<FilterConfig>;
  disabled?: boolean;
  onChangeBorder: (border: BorderConfig) => void;
  onResetBorder: () => void;
  onChangeShadow: (shadow: ShadowConfig) => void;
  onResetShadow: () => void;
  onChangeOpacity: (opacity: number | null) => void;
  onResetOpacity: () => void;
  onChangeFilters: (filters: FilterConfig) => void;
  onResetFilters: () => void;
}

const DEFAULT_BORDER: BorderConfig = {
  widthPx: 1,
  style: "solid",
  color: "token:border",
};

export function AppearanceEffectsControl({
  supportsBorder,
  supportsShadow,
  supportsOpacity,
  supportsFilters,
  borderState,
  shadowState,
  opacityState,
  filtersState,
  disabled = false,
  onChangeBorder,
  onResetBorder,
  onChangeShadow,
  onResetShadow,
  onChangeOpacity,
  onResetOpacity,
  onChangeFilters,
  onResetFilters,
}: AppearanceEffectsControlProps) {
  const currentBorder = borderState.value;
  const currentShadow = shadowState.value;
  const currentOpacityPercent = Math.round((opacityState.value ?? 1) * 100);
  const currentFilters = filtersState.value ?? {};

  const commitBorder = (next: BorderConfig) => {
    const validated = validateBorderInput(next);
    if (validated.valid && validated.value) {
      onChangeBorder(validated.value);
    }
  };

  const commitShadow = (next: ShadowConfig) => {
    const validated = validateShadowInput(next);
    if (validated.valid && validated.value) {
      onChangeShadow(validated.value);
    }
  };

  const commitFilters = (next: FilterConfig) => {
    const validated = validateFiltersInput(next);
    if (validated.valid && validated.value) {
      onChangeFilters(validated.value);
    }
  };

  return (
    <div className="space-y-4">
      {/* BORDER CONTROLS */}
      {supportsBorder && (
        <div className="space-y-2 border-t border-border/60 pt-3" data-testid="inspector-border-control">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-foreground">Border Stroke</span>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={borderState} />
              <PropertyResetButton
                propertyPath="appearance.border"
                canReset={borderState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={onResetBorder}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div className="space-y-1">
              <label
                htmlFor="inspector-border-width"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Width (px)
              </label>
              <input
                id="inspector-border-width"
                type="number"
                disabled={disabled}
                min={0}
                max={64}
                value={currentBorder?.widthPx ?? 1}
                data-testid="inspector-border-width"
                onChange={(e) => {
                  const widthPx = Math.max(0, Math.min(64, Number(e.target.value) || 0));
                  commitBorder({
                    ...(currentBorder ?? DEFAULT_BORDER),
                    widthPx,
                  });
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-border-style"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Style
              </label>
              <select
                id="inspector-border-style"
                disabled={disabled}
                value={currentBorder?.style ?? "solid"}
                data-testid="inspector-border-style"
                onChange={(e) =>
                  commitBorder({
                    ...(currentBorder ?? DEFAULT_BORDER),
                    style: e.target.value as BorderConfig["style"],
                  })
                }
                className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
              >
                {BORDER_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-border-color"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Color
              </label>
              <input
                id="inspector-border-color"
                type="text"
                disabled={disabled}
                placeholder="token:border"
                value={currentBorder?.color ?? "token:border"}
                data-testid="inspector-border-color"
                onChange={(e) =>
                  commitBorder({
                    ...(currentBorder ?? DEFAULT_BORDER),
                    color: e.target.value,
                  })
                }
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs text-foreground"
              />
            </div>
          </div>
        </div>
      )}

      {/* SHADOW & GLOW CONTROLS */}
      {supportsShadow && (
        <div className="space-y-2 border-t border-border/60 pt-3" data-testid="inspector-shadow-control">
          <div className="flex items-center justify-between gap-1">
            <label
              htmlFor="inspector-shadow-preset"
              className="text-[11px] font-medium text-foreground"
            >
              Shadow &amp; Elevation
            </label>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={shadowState} />
              <PropertyResetButton
                propertyPath="appearance.shadow"
                canReset={shadowState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={onResetShadow}
              />
            </div>
          </div>

          <select
            id="inspector-shadow-preset"
            disabled={disabled}
            value={currentShadow?.preset ?? ""}
            data-testid="inspector-shadow-preset"
            onChange={(e) => {
              const preset = e.target.value;
              if (!preset) {
                onResetShadow();
                return;
              }
              commitShadow({
                ...(currentShadow ?? {}),
                preset: preset as ShadowConfig["preset"],
              });
            }}
            className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs text-foreground"
          >
            <option value="">Default (Component Native)</option>
            {SHADOW_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === "glow"
                  ? "Cosmic Glow (var(--shadow-glow))"
                  : p === "card"
                    ? "Card Elevation (var(--shadow-card))"
                    : p === "planet"
                      ? "Planet Halo (var(--shadow-planet))"
                      : p.toUpperCase()}
              </option>
            ))}
          </select>

          {currentShadow?.preset === "custom" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label
                  htmlFor="inspector-shadow-y"
                  className="block font-mono text-[10px] text-muted-foreground"
                >
                  Offset Y (px)
                </label>
                <input
                  id="inspector-shadow-y"
                  type="number"
                  disabled={disabled}
                  min={-200}
                  max={200}
                  value={currentShadow.offsetY ?? 8}
                  data-testid="inspector-shadow-y"
                  onChange={(e) =>
                    commitShadow({
                      ...currentShadow,
                      offsetY: Math.max(-200, Math.min(200, Number(e.target.value) || 0)),
                    })
                  }
                  className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="inspector-shadow-blur"
                  className="block font-mono text-[10px] text-muted-foreground"
                >
                  Blur (px)
                </label>
                <input
                  id="inspector-shadow-blur"
                  type="number"
                  disabled={disabled}
                  min={0}
                  max={300}
                  value={currentShadow.blurPx ?? 24}
                  data-testid="inspector-shadow-blur"
                  onChange={(e) =>
                    commitShadow({
                      ...currentShadow,
                      blurPx: Math.max(0, Math.min(300, Number(e.target.value) || 0)),
                    })
                  }
                  className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPACITY CONTROL */}
      {supportsOpacity && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-1">
            <label
              htmlFor="inspector-opacity-input"
              className="font-sans text-xs font-semibold text-foreground"
            >
              Opacity
            </label>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {currentOpacityPercent}%
              </span>
              <PropertyOriginBadge state={opacityState} />
              <PropertyResetButton
                propertyPath="appearance.opacity"
                canReset={opacityState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={onResetOpacity}
              />
            </div>
          </div>

          <input
            id="inspector-opacity-input"
            type="range"
            disabled={disabled}
            min={0}
            max={100}
            step={5}
            value={currentOpacityPercent}
            data-testid="inspector-opacity-input"
            onChange={(e) => {
              const pct = Number(e.target.value);
              onChangeOpacity(pct === 100 ? null : Number((pct / 100).toFixed(2)));
            }}
            className="w-full accent-primary"
          />
        </div>
      )}

      {/* VISUAL FILTERS & BACKDROP BLUR */}
      {supportsFilters && (
        <div className="space-y-2 border-t border-border/60 pt-3" data-testid="inspector-filters-control">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-foreground">
              Backdrop &amp; Optical Filters
            </span>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={filtersState} />
              <PropertyResetButton
                propertyPath="appearance.filters"
                canReset={filtersState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={onResetFilters}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label
                htmlFor="inspector-filter-backdrop-blur"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Backdrop Blur (0–64px)
              </label>
              <input
                id="inspector-filter-backdrop-blur"
                type="number"
                disabled={disabled}
                min={0}
                max={64}
                placeholder="0"
                value={currentFilters.backdropBlurPx ?? ""}
                data-testid="inspector-filter-backdrop-blur"
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = { ...currentFilters };
                  if (raw === "") {
                    delete next.backdropBlurPx;
                  } else {
                    next.backdropBlurPx = Math.max(0, Math.min(64, Number(raw) || 0));
                  }
                  commitFilters(next);
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-filter-brightness"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Brightness (%)
              </label>
              <input
                id="inspector-filter-brightness"
                type="number"
                disabled={disabled}
                min={0}
                max={300}
                placeholder="100"
                value={currentFilters.brightnessPercent ?? ""}
                data-testid="inspector-filter-brightness"
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = { ...currentFilters };
                  if (raw === "") {
                    delete next.brightnessPercent;
                  } else {
                    next.brightnessPercent = Math.max(0, Math.min(300, Number(raw) || 100));
                  }
                  commitFilters(next);
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
