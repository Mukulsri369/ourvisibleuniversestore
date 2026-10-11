import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ExternalLink, Star } from "lucide-react";
import { formatPrice, logOutboundClick, type ProductCardData } from "@/lib/store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategoryQualityBentoProps {
  products: ProductCardData[];
  categoryName: string;
  className?: string;
}

export function CategoryQualityBento({
  products,
  categoryName,
  className,
}: CategoryQualityBentoProps) {
  if (!products || products.length === 0) return null;

  const leadProduct = products[0];
  const companionProducts = products.slice(1, 4);

  return (
    <section className={cn("relative my-8 sm:my-12", className)}>
      {/* SECTION HEADER */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/30 pb-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Featured Selections · {categoryName}
          </span>
          <h3 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Curated Highlights
          </h3>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          <span>Our Visible Universe Benchmark</span>
        </div>
      </div>

      {/* BENTO GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
        {/* HERO ANCHOR CARD (Takes 7 of 12 columns on desktop) */}
        {leadProduct && (
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-card/60 via-card/40 to-background/80 p-5 sm:p-7 backdrop-blur-md md:col-span-7 transition-all duration-300 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/10">
            {/* Luminous Glow Accent */}
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-60" />

            <div>
              {/* Card Meta */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                  <Star className="size-3.5 fill-primary text-primary" />
                  <span>Editor's Selection</span>
                </span>
                {leadProduct.price != null && (
                  <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {formatPrice(leadProduct.price, leadProduct.currency)}
                  </span>
                )}
              </div>

              {/* Product Visual */}
              <div className="my-5 overflow-hidden rounded-2xl border border-border/40 bg-background/50 aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center">
                {leadProduct.image ? (
                  <img
                    src={leadProduct.image}
                    alt={leadProduct.imageAlt ?? leadProduct.name}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <span className="text-xs font-mono">Astronomical Specimen</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <h4 className="text-lg sm:text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                <Link
                  to="/product/$slug"
                  params={{ slug: leadProduct.slug }}
                  className="focus:outline-none focus-visible:underline"
                >
                  {leadProduct.name}
                </Link>
              </h4>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-border/40">
              <Link
                to="/product/$slug"
                params={{ slug: leadProduct.slug }}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "rounded-full px-5 py-2 text-xs font-semibold shadow-md shadow-primary/20",
                )}
              >
                <span>View Details</span>
                <ArrowUpRight className="ml-1 size-3.5" />
              </Link>

              {leadProduct.affiliate_url && (
                <a
                  href={leadProduct.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logOutboundClick(leadProduct.id)}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "rounded-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>Retailer</span>
                  <ExternalLink className="ml-1 size-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* COMPANION CARDS (Takes 5 of 12 columns on desktop) */}
        <div className="flex flex-col gap-4 sm:gap-6 md:col-span-5">
          {companionProducts.map((product) => (
            <div
              key={product.id}
              className="group relative flex flex-col sm:flex-row items-center gap-4 overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-md transition-all duration-300 hover:border-border/80 hover:bg-card/70"
            >
              {/* Product Thumbnail */}
              <div className="size-24 sm:size-28 shrink-0 overflow-hidden rounded-xl border border-border/30 bg-background/50 flex items-center justify-center">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.imageAlt ?? product.name}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs font-mono text-muted-foreground">Optics</span>
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Selected
                  </span>
                  {product.price != null && (
                    <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                      {formatPrice(product.price, product.currency)}
                    </span>
                  )}
                </div>

                <h5 className="font-semibold text-sm tracking-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  <Link
                    to="/product/$slug"
                    params={{ slug: product.slug }}
                    className="focus:outline-none focus-visible:underline"
                  >
                    {product.name}
                  </Link>
                </h5>

                <div className="pt-2 flex items-center gap-3 text-xs">
                  <Link
                    to="/product/$slug"
                    params={{ slug: product.slug }}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-primary hover:underline"
                  >
                    <span>View</span>
                    <ArrowUpRight className="size-3" />
                  </Link>
                  {product.affiliate_url && (
                    <a
                      href={product.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => logOutboundClick(product.id)}
                      className="font-mono text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <span>Retailer</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
