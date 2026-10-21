import React from "react";
import {
  getAllowedInspectorLayoutModes,
  type ResolvedInspectorPropertyState,
} from "@/lib/visual-editor/inspector";
import { ALIGNMENT_MODES, type AlignmentMode } from "@/lib/visual-editor/schema/geometry";
import {
  FLEX_DIRECTIONS,
  FLEX_WRAPS,
  GRID_AUTO_FLOWS,
  JUSTIFY_CONTENT_MODES,
  type FlexItemConfig,
  type FlexLayoutConfig,
  type GridItemConfig,
  type GridLayoutConfig,
  type LayoutMode,
} from "@/lib/visual-editor/schema/layout";
import type { EditorComponentType } from "@/lib/visual-editor/schema/nodes";
import { PropertyOriginBadge, PropertyResetButton } from "./PropertyResetButton";

export interface LayoutControlsProps {
  componentType: EditorComponentType;
  supportsFlexAlignment: boolean;
  supportsGridColumns: boolean;
  supportsBentoSpan: boolean;
  layoutModeState: ResolvedInspectorPropertyState<LayoutMode>;
  flexState: ResolvedInspectorPropertyState<FlexLayoutConfig>;
  gridState: ResolvedInspectorPropertyState<GridLayoutConfig>;
  flexItemState: ResolvedInspectorPropertyState<FlexItemConfig>;
  gridItemState: ResolvedInspectorPropertyState<GridItemConfig>;
  disabled?: boolean;
  onUpdateStylePath: (path: string, value: unknown) => void;
  onResetStylePath: (path: string) => void;
}

export function LayoutControls({
  componentType,
  supportsFlexAlignment,
  supportsGridColumns,
  supportsBentoSpan,
  layoutModeState,
  flexState,
  gridState,
  flexItemState,
  gridItemState,
  disabled = false,
  onUpdateStylePath,
  onResetStylePath,
}: LayoutControlsProps) {
  const allowedModes = getAllowedInspectorLayoutModes(componentType);
  const effectiveMode: LayoutMode =
    layoutModeState.value ??
    (supportsGridColumns ? "grid" : supportsFlexAlignment ? "flex" : "block");

  const flexVal: FlexLayoutConfig = flexState.value ?? {
    direction: "row",
    wrap: "nowrap",
    justifyContent: "start",
    alignItems: "stretch",
    columnGapPx: 0,
    rowGapPx: 0,
  };

  const gridVal: GridLayoutConfig = gridState.value ?? {
    columns: 3,
    columnGapPx: 16,
    rowGapPx: 16,
    autoFit: false,
    autoFlow: "row",
  };

  const gridItemVal: GridItemConfig = gridItemState.value ?? {};
  const flexItemVal: FlexItemConfig = flexItemState.value ?? {};

  return (
    <div className="space-y-3" data-testid="inspector-layout-controls">
      {/* Container Layout Mode Switch (Only shown if multiple modes are genuinely supported by the adapter) */}
      {allowedModes.length > 1 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="inspector-layout-mode-select"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Container Display Mode
            </label>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={layoutModeState} />
              <PropertyResetButton
                propertyPath="layout.mode"
                canReset={layoutModeState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={() => onResetStylePath("layout.mode")}
              />
            </div>
          </div>
          <select
            id="inspector-layout-mode-select"
            disabled={disabled}
            value={effectiveMode}
            data-testid="inspector-layout-mode-select"
            onChange={(e) => onUpdateStylePath("layout.mode", e.target.value as LayoutMode)}
            className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs text-foreground"
          >
            {allowedModes.map((mode) => (
              <option key={mode} value={mode} className="bg-card text-foreground">
                {mode.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Flexbox Controls */}
      {supportsFlexAlignment && (effectiveMode === "flex" || effectiveMode === "stack" || !supportsGridColumns) && (
        <div className="space-y-2 border-t border-border/60 pt-2.5" data-testid="inspector-flex-controls">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground">Flexbox Alignment</span>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={flexState} />
              <PropertyResetButton
                propertyPath="layout.flex"
                canReset={flexState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={() => onResetStylePath("layout.flex")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label
                htmlFor="inspector-flex-direction"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Direction
              </label>
              <select
                id="inspector-flex-direction"
                disabled={disabled}
                value={flexVal.direction}
                data-testid="inspector-flex-direction"
                onChange={(e) => {
                  if (!layoutModeState.value) {
                    onUpdateStylePath("layout.mode", "flex");
                  }
                  onUpdateStylePath("layout.flex", {
                    ...flexVal,
                    direction: e.target.value as FlexLayoutConfig["direction"],
                  });
                }}
                className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
              >
                {FLEX_DIRECTIONS.map((dir) => (
                  <option key={dir} value={dir}>
                    {dir}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-flex-wrap"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Wrap
              </label>
              <select
                id="inspector-flex-wrap"
                disabled={disabled}
                value={flexVal.wrap}
                data-testid="inspector-flex-wrap"
                onChange={(e) => {
                  if (!layoutModeState.value) {
                    onUpdateStylePath("layout.mode", "flex");
                  }
                  onUpdateStylePath("layout.flex", {
                    ...flexVal,
                    wrap: e.target.value as FlexLayoutConfig["wrap"],
                  });
                }}
                className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
              >
                {FLEX_WRAPS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-flex-justify"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Justify
              </label>
              <select
                id="inspector-flex-justify"
                disabled={disabled}
                value={flexVal.justifyContent}
                data-testid="inspector-flex-justify"
                onChange={(e) => {
                  if (!layoutModeState.value) {
                    onUpdateStylePath("layout.mode", "flex");
                  }
                  onUpdateStylePath("layout.flex", {
                    ...flexVal,
                    justifyContent: e.target.value as FlexLayoutConfig["justifyContent"],
                  });
                }}
                className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
              >
                {JUSTIFY_CONTENT_MODES.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-flex-align"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Align Items
              </label>
              <select
                id="inspector-flex-align"
                disabled={disabled}
                value={flexVal.alignItems}
                data-testid="inspector-flex-align"
                onChange={(e) => {
                  if (!layoutModeState.value) {
                    onUpdateStylePath("layout.mode", "flex");
                  }
                  onUpdateStylePath("layout.flex", {
                    ...flexVal,
                    alignItems: e.target.value as AlignmentMode,
                  });
                }}
                className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
              >
                {ALIGNMENT_MODES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* CSS Grid Controls */}
      {supportsGridColumns && (effectiveMode === "grid" || !supportsFlexAlignment) && (
        <div className="space-y-2 border-t border-border/60 pt-2.5" data-testid="inspector-grid-controls">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground">CSS Grid Columns</span>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={gridState} />
              <PropertyResetButton
                propertyPath="layout.grid"
                canReset={gridState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={() => onResetStylePath("layout.grid")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label
                htmlFor="inspector-grid-columns"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Columns (1–24)
              </label>
              <input
                id="inspector-grid-columns"
                type="number"
                disabled={disabled}
                min={1}
                max={24}
                value={gridVal.columns}
                data-testid="inspector-grid-columns"
                onChange={(e) => {
                  const cols = Math.max(1, Math.min(24, Number(e.target.value) || 1));
                  if (!layoutModeState.value && allowedModes.includes("grid")) {
                    onUpdateStylePath("layout.mode", "grid");
                  }
                  onUpdateStylePath("layout.grid", {
                    ...gridVal,
                    columns: cols,
                  });
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-grid-autoflow"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Auto Flow
              </label>
              <select
                id="inspector-grid-autoflow"
                disabled={disabled}
                value={gridVal.autoFlow ?? "row"}
                data-testid="inspector-grid-autoflow"
                onChange={(e) =>
                  onUpdateStylePath("layout.grid", {
                    ...gridVal,
                    autoFlow: e.target.value as GridLayoutConfig["autoFlow"],
                  })
                }
                className="h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-xs text-foreground"
              >
                {GRID_AUTO_FLOWS.map((af) => (
                  <option key={af} value={af}>
                    {af}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Grid Cell Span Controls (for GridItem, ProductCard, CategoryCard, Container) */}
      {supportsBentoSpan && (
        <div className="space-y-2 border-t border-border/60 pt-2.5" data-testid="inspector-grid-item-controls">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground">Grid Item Span</span>
            <div className="flex items-center gap-1">
              <PropertyOriginBadge state={gridItemState} />
              <PropertyResetButton
                propertyPath="gridItem"
                canReset={gridItemState.canResetAtBreakpoint}
                disabled={disabled}
                onReset={() => onResetStylePath("gridItem")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label
                htmlFor="inspector-grid-col-span"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Column Span (1–24)
              </label>
              <input
                id="inspector-grid-col-span"
                type="number"
                disabled={disabled}
                min={1}
                max={24}
                placeholder="1"
                value={gridItemVal.colSpan ?? ""}
                data-testid="inspector-grid-col-span"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onResetStylePath("gridItem.colSpan");
                    return;
                  }
                  const span = Math.max(1, Math.min(24, Number(raw) || 1));
                  onUpdateStylePath("gridItem.colSpan", span);
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-grid-row-span"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Row Span (1–24)
              </label>
              <input
                id="inspector-grid-row-span"
                type="number"
                disabled={disabled}
                min={1}
                max={24}
                placeholder="1"
                value={gridItemVal.rowSpan ?? ""}
                data-testid="inspector-grid-row-span"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onResetStylePath("gridItem.rowSpan");
                    return;
                  }
                  const span = Math.max(1, Math.min(24, Number(raw) || 1));
                  onUpdateStylePath("gridItem.rowSpan", span);
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
              />
            </div>
          </div>

          {/* Flex Item Grow / Shrink */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <label
                htmlFor="inspector-flex-grow"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Flex Grow (0–12)
              </label>
              <input
                id="inspector-flex-grow"
                type="number"
                disabled={disabled}
                min={0}
                max={12}
                placeholder="0"
                value={flexItemVal.grow ?? ""}
                data-testid="inspector-flex-grow"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onResetStylePath("flexItem.grow");
                    return;
                  }
                  const grow = Math.max(0, Math.min(12, Number(raw) || 0));
                  onUpdateStylePath("flexItem.grow", grow);
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs tabular-nums text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="inspector-flex-shrink"
                className="block font-mono text-[10px] text-muted-foreground"
              >
                Flex Shrink (0–12)
              </label>
              <input
                id="inspector-flex-shrink"
                type="number"
                disabled={disabled}
                min={0}
                max={12}
                placeholder="1"
                value={flexItemVal.shrink ?? ""}
                data-testid="inspector-flex-shrink"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onResetStylePath("flexItem.shrink");
                    return;
                  }
                  const shrink = Math.max(0, Math.min(12, Number(raw) || 0));
                  onUpdateStylePath("flexItem.shrink", shrink);
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
