import { Link } from "@tanstack/react-router";
import { ExternalLink, Sparkles, Telescope } from "lucide-react";
import { useState } from "react";
import { formatPrice, logOutboundClick, type ProductCardData } from "@/lib/store";
import { BuyButton } from "./BuyButton";
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
}: {
  p: ProductCardData;
  compact?: boolean;
  className?: string;
}) {
  const price = formatPrice(p.price, p.currency);

  if (compact) {
    return (
      <article
        className={cn(
          "group flex flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-border/80 bg-card/75 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_8px_25px_-5px_rgba(139,92,246,0.18)] snap-start shrink-0 select-none",
          // Density calibration: 4-5 visible on mobile, 5-6 visible on desktop
          "w-[78px] min-w-[78px] max-w-[88px] sm:w-[130px] sm:min-w-[130px] md:w-[155px] md:min-w-[155px] lg:w-[calc((100%-5*14px)/6)] lg:min-w-[160px] xl:w-[calc((100%-5*16px)/6)] xl:min-w-[172px]",
          className,
        )}
      >
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="relative block aspect-square w-full overflow-hidden bg-secondary/60"
        >
          <ProductImage
            src={p.image}
            alt={p.imageAlt || p.name}
            className="h-full w-full transition-transform duration-500 group-hover:scale-108"
          />
          {p.featured && (
            <span
              className="absolute left-1 top-1 sm:left-2 sm:top-2 rounded-full bg-background/90 px-1.5 py-0.5 font-mono text-[7px] sm:text-[9px] uppercase tracking-wider text-primary border border-primary/25 backdrop-blur shadow-sm"
              title="Featured"
            >
              <span className="sm:hidden">★</span>
              <span className="hidden sm:inline">Featured</span>
            </span>
          )}
        </Link>

        <div className="flex flex-1 flex-col justify-between p-1.5 sm:p-3 gap-1 sm:gap-1.5">
          <div>
            {p.category && (
              <p className="hidden sm:block text-[9px] uppercase tracking-widest font-mono text-muted-foreground truncate mb-0.5">
                {p.category.name}
              </p>
            )}
            <Link to="/product/$slug" params={{ slug: p.slug }}>
              <h3
                className="line-clamp-2 text-[10px] sm:text-xs font-medium sm:font-semibold leading-tight text-foreground transition-colors group-hover:text-primary"
                title={p.name}
              >
                {p.name}
              </h3>
            </Link>
          </div>

          <div className="pt-0.5">
            <p className="text-[10px] sm:text-xs font-bold text-primary sm:text-foreground truncate">
              {price ?? (
                <span className="font-normal text-[9px] text-muted-foreground">Latest price</span>
              )}
            </p>

            {/* Quick Actions */}
            <div className="mt-1 flex items-center gap-1">
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="hidden sm:inline-flex h-7 flex-1 items-center justify-center rounded-full border border-border/80 bg-background/50 text-[10px] font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
              >
                View
              </Link>
              {p.affiliate_url && (
                <a
                  href={p.affiliate_url}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  onClick={() => logOutboundClick(p.id)}
                  aria-label={`Buy ${p.name}`}
                  className="inline-flex h-6 w-full sm:h-7 sm:w-auto sm:flex-1 items-center justify-center gap-1 rounded-full bg-primary/15 sm:bg-primary text-[9px] sm:text-[10px] font-semibold text-primary sm:text-primary-foreground hover:bg-primary/25 sm:hover:bg-primary/90 transition-colors"
                >
                  <span className="truncate">Buy</span>
                  <ExternalLink className="size-2.5 sm:size-3 shrink-0" />
                </a>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  // Standard full-size card (used in search results and large product listings)
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-card",
        className,
      )}
    >
      <Link
        to="/product/$slug"
        params={{ slug: p.slug }}
        className="relative block aspect-square overflow-hidden bg-secondary"
      >
        <ProductImage
          src={p.image}
          alt={p.imageAlt || p.name}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
        />
        {p.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary backdrop-blur">
            Featured
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {p.category && <p className="eyebrow !text-[10px]">{p.category.name}</p>}
        <Link to="/product/$slug" params={{ slug: p.slug }}>
          <h3 className="line-clamp-2 font-sans text-base font-semibold leading-snug text-foreground hover:text-primary">
            {p.name}
          </h3>
        </Link>
        {p.short_description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{p.short_description}</p>
        )}
        <p className="mt-auto pt-1 text-sm font-semibold text-foreground">
          {price ?? <span className="font-normal text-muted-foreground">Check latest price</span>}
        </p>
        <div className="flex gap-2 pt-1">
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-input text-xs font-medium text-foreground hover:bg-secondary"
          >
            View
          </Link>
          <BuyButton
            productId={p.id}
            url={p.affiliate_url}
            size="sm"
            label="Buy now"
            className="h-10 flex-[1.3] rounded-full"
          />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}
