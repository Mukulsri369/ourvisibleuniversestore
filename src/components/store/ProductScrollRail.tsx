import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ProductCard } from "./ProductCard";
import { ProductQuickPreviewModal } from "./ProductQuickPreviewModal";
import type { ProductCardData } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ProductScrollRailProps {
  title?: string;
  eyebrow?: string;
  count?: number;
  link?: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, unknown>;
    label?: string;
  };
  icon?: ReactNode;
  items: ProductCardData[];
  className?: string;
  variant?: "default" | "festive";
  railGapPx?: number;
  editorParentNodeId?: string;
}

export function ProductScrollRail({
  title,
  eyebrow,
  count,
  link,
  icon,
  items,
  className = "",
  variant = "default",
  railGapPx,
  editorParentNodeId,
}: ProductScrollRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<ProductCardData | null>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Tolerance of 4px to accommodate subpixel rendering
    const hasOverflow = el.scrollWidth > el.clientWidth + 4;
    const atStart = el.scrollLeft <= 6;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 6;

    setCanScrollLeft(hasOverflow && !atStart);
    setCanScrollRight(hasOverflow && !atEnd);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    // Scroll listener
    const onScroll = () => {
      checkScroll();
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    // Resize observer to detect container and children dimension changes
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        checkScroll();
      });
      ro.observe(el);
    }

    // Window resize fallback
    window.addEventListener("resize", checkScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, items.length]);

  const scrollByDirection = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    // Step by ~75% of visible container width for intuitive multi-card stepping
    const step = Math.max(200, Math.floor(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  if (!items || items.length === 0) {
    return null;
  }

  const isFestive = variant === "festive";

  return (
    <section className={cn("relative my-8 sm:my-12", className)}>
      {/* Header */}
      {(title || eyebrow || link) && (
        <div className="mb-4 sm:mb-5 flex items-end justify-between gap-3 px-1">
          <div>
            {eyebrow && (
              <p
                className={cn(
                  "eyebrow flex items-center gap-1.5",
                  isFestive ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                {icon}
                {eyebrow}
                {typeof count === "number" && (
                  <span className="ml-1 rounded-full bg-secondary/80 px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                )}
              </p>
            )}
            {title && (
              <h2
                className={cn(
                  "mt-1 font-sans font-semibold tracking-tight text-foreground flex items-center gap-2",
                  isFestive ? "text-2xl sm:text-4xl" : "text-xl sm:text-3xl",
                )}
              >
                <span>{title}</span>
                {!eyebrow && typeof count === "number" && (
                  <span className="rounded-full bg-secondary/80 px-2 py-0.5 font-mono text-[10px] sm:text-xs font-normal text-muted-foreground">
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                )}
              </h2>
            )}
          </div>

          {link && (
            <Link
              to={link.to}
              params={link.params}
              search={link.search}
              className={cn(
                "group/link inline-flex shrink-0 items-center gap-1 text-xs sm:text-sm font-medium transition-colors pb-0.5",
                isFestive
                  ? "text-primary hover:text-primary/80"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{link.label || "View all"}</span>
              <ChevronRight className="size-3.5 sm:size-4 transition-transform group-hover/link:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}

      {/* Rail Container */}
      <div className="relative group/rail">
        {/* Floating Left Chevron Arrow (Auto-hiding) */}
        <button
          type="button"
          onClick={() => scrollByDirection("left")}
          aria-label="Scroll left"
          className={cn(
            "absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 z-30",
            "size-8 sm:size-10 rounded-full flex items-center justify-center",
            "bg-background/90 text-foreground border border-border/80 shadow-xl backdrop-blur-md",
            "hover:bg-background hover:scale-110 hover:border-primary/60 active:scale-95",
            "transition-all duration-300",
            canScrollLeft
              ? "opacity-100 scale-100 pointer-events-auto translate-x-0"
              : "opacity-0 scale-75 pointer-events-none -translate-x-2",
          )}
        >
          <ChevronLeft className="size-4 sm:size-5 stroke-[2.5]" />
        </button>

        {/* Floating Right Chevron Arrow (Auto-hiding) */}
        <button
          type="button"
          onClick={() => scrollByDirection("right")}
          aria-label="Scroll right"
          className={cn(
            "absolute -right-2 sm:-right-4 top-1/2 -translate-y-1/2 z-30",
            "size-8 sm:size-10 rounded-full flex items-center justify-center",
            "bg-background/90 text-foreground border border-border/80 shadow-xl backdrop-blur-md",
            "hover:bg-background hover:scale-110 hover:border-primary/60 active:scale-95",
            "transition-all duration-300",
            canScrollRight
              ? "opacity-100 scale-100 pointer-events-auto translate-x-0"
              : "opacity-0 scale-75 pointer-events-none translate-x-2",
          )}
        >
          <ChevronRight className="size-4 sm:size-5 stroke-[2.5]" />
        </button>

        {/* Subtle Edge Fade Gradients */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 bottom-3 w-8 sm:w-16 z-10 transition-opacity duration-300",
            isFestive
              ? "bg-gradient-to-r from-card/80 to-transparent"
              : "bg-gradient-to-r from-background to-transparent",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-0 top-0 bottom-3 w-8 sm:w-16 z-10 transition-opacity duration-300",
            isFestive
              ? "bg-gradient-to-l from-card/80 to-transparent"
              : "bg-gradient-to-l from-background to-transparent",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Single-Line Horizontal Scroll Container */}
        <div
          ref={scrollRef}
          style={railGapPx !== undefined ? { gap: `${railGapPx}px` } : undefined}
          className="flex gap-2 sm:gap-3.5 lg:gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-3 pt-1 px-4 sm:px-0 -mx-4 sm:mx-0 snap-x snap-mandatory"
          tabIndex={0}
          role="region"
          aria-label={title || "Product carousel"}
        >
          {items.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              compact
              editorInstanceId={
                editorParentNodeId ? `${editorParentNodeId}::product::${p.id}` : undefined
              }
              onQuickPreview={(prod) => setPreviewProduct(prod)}
            />
          ))}
        </div>
      </div>

      <ProductQuickPreviewModal product={previewProduct} onClose={() => setPreviewProduct(null)} />
    </section>
  );
}
