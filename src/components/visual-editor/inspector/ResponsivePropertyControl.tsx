import React from "react";
import { RotateCcw } from "lucide-react";
import {
  BREAKPOINT_INHERITANCE_CHAIN,
  listNodeOverridesByBreakpoint,
  type InspectorStylePath,
} from "@/lib/visual-editor/index";
import type { EditorNode } from "@/lib/visual-editor/schema/nodes";
import type { EditorBreakpoint } from "@/lib/visual-editor/schema/responsive";

export interface ResponsivePropertyControlProps {
  node: EditorNode;
  breakpoint: EditorBreakpoint;
  disabled?: boolean;
  onResetPropertyAtBreakpoint: (path: InspectorStylePath) => void;
  onResetAllAtBreakpoint: () => void;
}

export function ResponsivePropertyControl({
  node,
  breakpoint,
  disabled = false,
  onResetPropertyAtBreakpoint,
  onResetAllAtBreakpoint,
}: ResponsivePropertyControlProps) {
  const overridesByBp = listNodeOverridesByBreakpoint(node);
  const currentBpOverrides = overridesByBp[breakpoint] ?? [];
  const inheritanceChain = BREAKPOINT_INHERITANCE_CHAIN[breakpoint];

  const activeOverrideBreakpoints = (
    ["desktop_xl", "tablet", "mobile", "mobile_sm"] as const
  ).filter((bp) => overridesByBp[bp].length > 0);

  return (
    <section className="space-y-3" data-testid="inspector-responsive-cascade-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-xs font-semibold text-foreground">
          Responsive Cascade State
        </h3>
        {currentBpOverrides.length > 0 && !disabled && (
          <button
            type="button"
            onClick={onResetAllAtBreakpoint}
            data-testid="inspector-reset-all-breakpoint-btn"
            className="inline-flex items-center gap-1 rounded border border-border bg-secondary/50 px-2 py-0.5 font-mono text-[10px] text-foreground hover:bg-secondary"
          >
            <RotateCcw className="size-2.5" />
            <span>Reset {breakpoint}</span>
          </button>
        )}
      </div>

      <div className="space-y-1.5 rounded-lg border border-border/80 bg-secondary/25 p-2.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Active Breakpoint</span>
          <code className="font-mono text-foreground">{breakpoint}</code>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Inheritance Chain</span>
          <code className="font-mono text-[10px] text-foreground">
            {["desktop", ...inheritanceChain].join(" → ")}
          </code>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Explicit Breakpoint Overrides</span>
          <code className="font-mono text-foreground">
            {activeOverrideBreakpoints.length > 0
              ? activeOverrideBreakpoints.join(", ")
              : "None (Inherits desktop base)"}
          </code>
        </div>
      </div>

      {/* Explicit Overrides at Active Breakpoint */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-foreground">
            Configured on <code className="font-mono">{breakpoint}</code>
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {currentBpOverrides.length} properties
          </span>
        </div>

        {currentBpOverrides.length > 0 ? (
          <ul
            data-testid="inspector-active-breakpoint-override-list"
            className="space-y-1 rounded-lg border border-border/70 bg-secondary/20 p-2"
          >
            {currentBpOverrides.map((path) => (
              <li
                key={path}
                className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1 font-mono text-[10px]"
              >
                <span className="truncate text-foreground">{path}</span>
                {!disabled && (
                  <button
                    type="button"
                    data-testid={`inspector-responsive-reset-${path}`}
                    onClick={() => onResetPropertyAtBreakpoint(path)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-border/60 bg-secondary/15 p-2 text-[11px] text-muted-foreground">
            {breakpoint === "desktop"
              ? "Using original storefront component defaults. Any edits on desktop become the base design."
              : `No explicit overrides on ${breakpoint}. Values inherit cleanly from ${["desktop", ...inheritanceChain.slice(0, -1)].join(" → ")}.`}
          </p>
        )}
      </div>
    </section>
  );
}
