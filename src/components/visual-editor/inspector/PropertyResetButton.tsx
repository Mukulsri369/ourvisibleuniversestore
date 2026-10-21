import React from "react";
import { RotateCcw } from "lucide-react";
import type { ResolvedInspectorPropertyState } from "@/lib/visual-editor/inspector";
import { cn } from "@/lib/utils";

export interface PropertyOriginBadgeProps {
  state: ResolvedInspectorPropertyState<unknown>;
  className?: string;
}

export function PropertyOriginBadge({ state, className }: PropertyOriginBadgeProps) {
  const { origin, sourceBreakpoint, isThemeToken } = state;

  let label = "Default";
  let badgeClass = "border-border/60 bg-secondary/40 text-muted-foreground";

  if (origin === "explicit_breakpoint_override") {
    label = `Override (${state.breakpoint})`;
    badgeClass = "border-primary/40 bg-primary/15 text-primary";
  } else if (origin === "inherited_breakpoint") {
    label = `Inherited (${sourceBreakpoint ?? "desktop"})`;
    badgeClass = "border-sky-500/35 bg-sky-500/10 text-sky-300";
  } else if (isThemeToken || origin === "theme_token") {
    label = "Theme Token";
    badgeClass = "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
  } else if (origin === "base_desktop") {
    label = "Customized";
    badgeClass = "border-primary/35 bg-primary/10 text-primary";
  }

  return (
    <span
      data-testid={`inspector-origin-${state.path}`}
      data-origin={origin}
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] leading-none",
        badgeClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

export interface PropertyResetButtonProps {
  propertyPath: string;
  canReset: boolean;
  disabled?: boolean;
  onReset: () => void;
  label?: string;
  testId?: string;
}

export function PropertyResetButton({
  propertyPath,
  canReset,
  disabled = false,
  onReset,
  label = "Reset",
  testId,
}: PropertyResetButtonProps) {
  if (!canReset || disabled) return null;

  return (
    <button
      type="button"
      onClick={onReset}
      title={`Reset ${propertyPath} at active breakpoint`}
      data-testid={testId ?? `inspector-reset-${propertyPath}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
    >
      <RotateCcw className="size-2.5" />
      <span>{label}</span>
    </button>
  );
}
