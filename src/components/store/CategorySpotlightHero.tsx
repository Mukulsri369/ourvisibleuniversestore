import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, ChevronUp, Eye, Sparkles } from "lucide-react";
import { formatPrice, type ProductCardData } from "@/lib/store";
import { ProductQuickPreviewModal } from "./ProductQuickPreviewModal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategorySpotlightHeroProps {
  product: ProductCardData;
  categoryName: string;
  categorySlug: string;
  sectorLore?: string;
  className?: string;
}

export function CategorySpotlightHero({
  product,
  categoryName,
  categorySlug,
  sectorLore,
  className,
}: CategorySpotlightHeroProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const priceFormatted = formatPrice(product.price, product.currency);
  const hasDescription = Boolean(product.description && product.description.trim().length > 0);
  const hasShortDescription = Boolean(
    product.short_description && product.short_description.trim().length > 0,
  );
  const isDifferentFromShort = Boolean(
    hasDescription &&
    (!hasShortDescription ||
      product.description?.trim().toLowerCase() !==
        product.short_description?.trim().toLowerCase()),
  );
  const isLongDescription = Boolean(
    hasDescription && (product.description!.length > 140 || product.description!.includes("\n")),
  );

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl sm:rounded-2xl border border-border/70 bg-gradient-to-br from-card/90 via-card/60 to-secondary/30 p-3.5 sm:p-5 lg:p-6 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-primary/40 mb-4 sm:mb-8",
          className,
        )}
      >
        {/* Subtle ambient starfield backdrop */}
        <div className="starfield pointer-events-none absolute inset-0 opacity-25" />

        <div className="relative z-10 grid grid-cols-1 items-center gap-3.5 sm:gap-6 lg:grid-cols-12 lg:gap-7">
          {/* LEFT: COMPACT PRODUCT PHOTO (SPACE-SAVING ON MOBILE) */}
          <div className="lg:col-span-5">
            <Link
              to="/product/$slug"
              params={{ slug: product.slug }}
              className="group relative block aspect-[16/10] sm:aspect-[4/3] lg:aspect-square w-full max-h-52 sm:max-h-none overflow-hidden rounded-lg sm:rounded-xl border border-border/50 bg-secondary/40 shadow-inner"
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.imageAlt || product.name}
                  loading="lazy"
                  className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="nebula starfield flex h-full w-full items-center justify-center">
                  <Sparkles className="size-8 text-primary/40 animate-pulse" />
                </div>
              )}

              {/* OVERLAY QUICK VIEW BUTTON */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPreviewModal(true);
                }}
                className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium text-foreground backdrop-blur-md shadow-sm opacity-90 transition-all hover:bg-background hover:scale-105"
                aria-label={`Quick view ${product.name}`}
              >
                <Eye className="size-3 sm:size-3.5 text-primary" />
                <span>Quick view</span>
              </button>
            </Link>
          </div>

          {/* RIGHT: METADATA & COMPACT DETAILS */}
          <div className="flex flex-col lg:col-span-7">
            {/* CATEGORY KICKER */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-primary/80">
              <span className="font-semibold">{categoryName}</span>
              {sectorLore && (
                <>
                  <span aria-hidden="true" className="text-muted-foreground/40 font-normal">
                    /
                  </span>
                  <span className="text-muted-foreground">{sectorLore}</span>
                </>
              )}
            </div>

            {/* PRODUCT TITLE */}
            <h3 className="mt-1 sm:mt-1.5 text-base sm:text-xl lg:text-2xl font-semibold tracking-tight text-foreground leading-snug">
              <Link
                to="/product/$slug"
                params={{ slug: product.slug }}
                className="hover:text-primary transition-colors line-clamp-2"
              >
                {product.name}
              </Link>
            </h3>

            {/* PRICING & STOCK */}
            <div className="mt-1 sm:mt-2 flex items-baseline gap-2 text-xs sm:text-sm text-foreground">
              {priceFormatted ? (
                <span className="font-mono text-primary text-base sm:text-lg font-semibold">
                  {priceFormatted}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Price on retailer</span>
              )}
              <span aria-hidden="true" className="text-muted-foreground/40 font-normal">
                ·
              </span>
              <span className="text-xs text-muted-foreground">In stock</span>
            </div>

            {/* SHORT DESCRIPTION */}
            {hasShortDescription && (
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-3">
                {product.short_description}
              </p>
            )}

            {/* COLLAPSIBLE DETAILS */}
            {hasDescription && isDifferentFromShort && (
              <div className="mt-1.5 pt-1.5 border-t border-border/30">
                <div
                  className={cn(
                    "text-xs text-muted-foreground/90 leading-relaxed whitespace-pre-line transition-all duration-300",
                    isExpanded ? "block" : "line-clamp-2",
                  )}
                >
                  {product.description}
                </div>

                {isLongDescription && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    aria-expanded={isExpanded}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                  >
                    <span>{isExpanded ? "Show less" : "Read more"}</span>
                    {isExpanded ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </button>
                )}
              </div>
            )}

            {/* CLEAN ACTION: VIEW PRODUCT */}
            <div className="mt-3 sm:mt-4 flex items-center gap-2">
              <Link
                to="/product/$slug"
                params={{ slug: product.slug }}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 sm:h-9 px-3.5 sm:px-4 text-xs sm:text-sm font-medium border-border/80 bg-background/60 hover:bg-secondary gap-1.5 rounded-lg",
                )}
              >
                <span>View product</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK PREVIEW MODAL */}
      {showPreviewModal && (
        <ProductQuickPreviewModal product={product} onClose={() => setShowPreviewModal(false)} />
      )}
    </>
  );
}
