import React from "react";
import { ChevronRight } from "lucide-react";
import type { SelectionBreadcrumbEntry } from "@/lib/visual-editor/interactions";
import { cn } from "@/lib/utils";

export interface SelectionBreadcrumbProps {
  readonly entries: readonly SelectionBreadcrumbEntry[];
  readonly activeId?: string | null;
  readonly onSelectNode: (nodeId: string) => void;
  readonly testId?: string;
  readonly className?: string;
}

/**
 * Interactive parent-child hierarchy breadcrumb bar (Prompt 10, Part 5, Section 12 & Part 15, Section 43).
 * Allows administrators to inspect the full ancestor chain (e.g. `Homepage › Featured Products › Product Card`)
 * and click any parent node to move selection up the hierarchy.
 */
export function SelectionBreadcrumb({
  entries,
  activeId,
  onSelectNode,
  testId = "studio-selection-breadcrumb",
  className,
}: SelectionBreadcrumbProps) {
  if (entries.length === 0) {
    return <span className="text-muted-foreground">No component selected</span>;
  }

  return (
    <nav
      aria-label="Selected component hierarchy"
      data-testid={testId}
      className={cn("flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-none", className)}
    >
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;
        const isCurrent = activeId ? entry.id === activeId : isLast;
        return (
          <React.Fragment key={entry.id}>
            {idx > 0 && (
              <ChevronRight
                className="size-3 shrink-0 text-muted-foreground/60"
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={() => onSelectNode(entry.id)}
              aria-current={isCurrent ? "true" : undefined}
              data-testid={`studio-breadcrumb-item-${entry.id}`}
              title={`Select ${entry.label} (${entry.componentType})`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isCurrent
                  ? "bg-primary/15 font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <span className="max-w-[180px] truncate">{entry.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
