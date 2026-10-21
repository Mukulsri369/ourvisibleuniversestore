import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PropertySectionProps {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string | number;
  defaultExpanded?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PropertySection({
  id,
  title,
  subtitle,
  badge,
  defaultExpanded = true,
  headerAction,
  children,
  className,
}: PropertySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section
      data-testid={`inspector-section-${id}`}
      className={cn("border-b border-border/70 pb-3.5 last:border-b-0", className)}
    >
      <div className="flex items-center justify-between gap-2 py-1">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          data-testid={`inspector-section-toggle-${id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-sans text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{title}</span>
          {badge !== undefined && badge !== 0 && badge !== "" && (
            <span className="ml-1 shrink-0 rounded-full bg-primary/15 px-1.5 py-0.2 font-mono text-[10px] font-medium text-primary">
              {badge}
            </span>
          )}
        </button>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {subtitle && expanded && (
        <p className="mb-2 pl-5 text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
      )}

      {expanded && <div className="mt-2 space-y-3">{children}</div>}
    </section>
  );
}
