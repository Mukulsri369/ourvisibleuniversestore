import { Link } from "@tanstack/react-router";
import { ExternalLink, Eye, Sparkles, Telescope } from "lucide-react";
import { useState } from "react";
import { formatPrice, logOutboundClick, type ProductCardData } from "@/lib/store";
import { BuyButton } from "./BuyButton";
import { ProductQuickPreviewModal } from "./ProductQuickPreviewModal";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  alt,
  className,
  eager,
}: {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary/80 nebula text-muted-foreground",
          className,
        )}
      >
        <Telescope className="size-6 sm:size-8 opacity-40" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

export function ProductCard({
  p,
  compact = false,
  className = "",
  onQuickPreview,
}: {
  p: ProductCardData;
  compact?: boolean;
  className?: string;
  onQuickPreview?: (p: ProductCardData) => void;
}) {
  const price = formatPrice(p.price, p.currency);

  if (compact) {
    return (
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_8px_25px_-5px_rgba(139,92,246,0.18)] snap-start shrink-0 select-none",
          "w-[85px] min-w-[85px] max-w-[95px] sm:w-[130px] sm:min-w-[130px] md:w-[155px] md:min-w-[155px] lg:w-[calc((100%-5*14px)/6)] lg:min-w-[160px] xl:w-[calc((100%-5*16px)/6)] xl:min-w-[172px]",
          className,
        )}
      >
        {/* COMPACT IMAGE CONTAINER */}
        <div className="relative aspect-square w-full overflow-hidden bg-secondary/60">
          <Link to="/product/$slug" params={{ slug: p.slug }} className="block size-full">
            <ProductImage
              src={p.image}
              alt={p.imageAlt || p.name}
              className="h-full w-full transition-transform duration-500 group-hover:scale-105"
            />
          </Link>

          {/* QUICK PREVIEW BUTTON ON HOVER / TAP */}
          {onQuickPreview && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickPreview(p);
              }}
              title="Quick preview images"
              aria-label={`Quick preview ${p.name}`}
              className="absolute right-1 top-1 sm:right-1.5 sm:top-1.5 z-10 flex size-6 sm:size-7 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground shadow-sm"
            >
              <Eye className="size-3 sm:size-3.5" />
            </button>
          )}

          {p.featured && (
            <span className="absolute left-1 top-1 sm:left-1.5 sm:top-1.5 rounded-full bg-background/90 px-1.5 py-0.5 font-mono text-[7px] sm:text-[9px] uppercase tracking-wider text-primary border border-primary/25 backdrop-blur shadow-sm pointer-events-none">
              ★
            </span>
          )}
        </div>

        {/* COMPACT TEXT */}
        <div className="flex flex-1 flex-col justify-between p-1.5 sm:p-2.5 gap-1">
          <div>
            {p.category && (
              <p className="hidden sm:block text-[8px] uppercase tracking-widest font-mono text-muted-foreground truncate mb-0.5">
                {p.category.name}
              </p>
            )}
            <Link to="/product/$slug" params={{ slug: p.slug }}>
              <h3
                className="line-clamp-2 text-[9px] sm:text-[11px] font-medium leading-tight text-foreground transition-colors group-hover:text-primary"
                title={p.name}
              >
                {p.name}
              </h3>
            </Link>
          </div>

          <div className="pt-0.5">
            <p className="text-[9px] sm:text-[11px] font-bold text-primary truncate">
              {price ?? <span className="font-normal text-[8px] text-muted-foreground">Price</span>}
            </p>

            <div className="mt-1 flex items-center gap-1">
              {onQuickPreview && (
                <button
                  onClick={() => onQuickPreview(p)}
                  className="sm:hidden flex-1 h-5 rounded-full bg-secondary/80 text-[8px] font-medium text-foreground hover:text-primary"
                >
                  Peek
                </button>
              )}
              {p.affiliate_url && (
                <a
                  href={p.affiliate_url}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  onClick={() => logOutboundClick(p.id)}
                  aria-label={`Buy ${p.name}`}
                  className="inline-flex h-5 sm:h-6 w-full sm:w-auto sm:flex-1 items-center justify-center gap-0.5 rounded-full bg-primary/15 sm:bg-primary text-[8px] sm:text-[9px] font-semibold text-primary sm:text-primary-foreground hover:bg-primary/25 sm:hover:bg-primary/90 transition-colors"
                >
                  <span>Buy</span>
                  <ExternalLink className="size-2 sm:size-2.5 shrink-0" />
                </a>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  // STANDARD PRODUCT CARD (DENSE, MAX PHOTO, COMPACT TYPOGRAPHY)
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/65 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        className,
      )}
    >
      {/* MAX PHOTO CONTAINER (70%+ OF CARD HEIGHT) */}
      <div className="relative aspect-square w-full overflow-hidden bg-secondary/50">
        <Link to="/product/$slug" params={{ slug: p.slug }} className="block size-full">
          <ProductImage
            src={p.image}
            alt={p.imageAlt || p.name}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* QUICK PREVIEW BUTTON ON HOVER / TAP */}
        {onQuickPreview && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickPreview(p);
            }}
            title="Preview all images & specs"
            aria-label={`Preview ${p.name}`}
            className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur border border-border/60 opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground shadow-md hover:scale-105"
          >
            <Eye className="size-3.5" />
          </button>
        )}

        {/* BADGE */}
        {p.featured && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary backdrop-blur border border-primary/25 pointer-events-none">
            Featured
          </span>
        )}
      </div>

      {/* COMPACT PRODUCT DETAILS */}
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3 gap-1.5">
        <div>
          {p.category && (
            <p className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground truncate mb-0.5">
              {p.category.name}
            </p>
          )}
          <Link to="/product/$slug" params={{ slug: p.slug }}>
            <h3 className="line-clamp-2 text-xs sm:text-[13px] font-medium leading-snug text-foreground hover:text-primary transition-colors">
              {p.name}
            </h3>
          </Link>
        </div>

        <div className="pt-1">
          <p className="text-xs sm:text-[13px] font-bold text-primary truncate">
            {price ?? (
              <span className="font-normal text-[10px] text-muted-foreground">Check price</span>
            )}
          </p>

          <div className="mt-2 flex items-center gap-1.5">
            {onQuickPreview && (
              <button
                type="button"
                onClick={() => onQuickPreview(p)}
                className="inline-flex h-7 sm:h-8 flex-1 items-center justify-center rounded-full border border-border/80 bg-background/60 text-[10px] sm:text-[11px] font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
              >
                Peek
              </button>
            )}

            <BuyButton
              productId={p.id}
              url={p.affiliate_url}
              size="sm"
              label="Buy"
              className="h-7 sm:h-8 flex-[1.2] rounded-full text-[10px] sm:text-[11px]"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
  className = "",
}: {
  items: ProductCardData[];
  className?: string;
}) {
  const [previewProduct, setPreviewProduct] = useState<ProductCardData | null>(null);

  return (
    <>
      {/* EXPANDED 5-6 PRODUCT ROW GRID */}
      <div
        className={cn(
          "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6",
          className,
        )}
      >
        {items.map((p) => (
          <ProductCard key={p.id} p={p} onQuickPreview={(prod) => setPreviewProduct(prod)} />
        ))}
      </div>

      {/* QUICK PREVIEW MODAL WITH SLIDESHOW */}
      <ProductQuickPreviewModal product={previewProduct} onClose={() => setPreviewProduct(null)} />
    </>
  );
}
