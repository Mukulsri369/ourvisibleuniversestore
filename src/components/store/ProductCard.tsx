import { Link } from "@tanstack/react-router";
import { Telescope } from "lucide-react";
import { formatPrice, type ProductCardData } from "@/lib/store";
import { BuyButton } from "./BuyButton";

export function ProductImage({ src, alt, className, eager }: { src: string | null; alt: string; className?: string; eager?: boolean }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-secondary nebula text-muted-foreground ${className ?? ""}`}>
        <Telescope className="size-10 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`object-cover ${className ?? ""}`}
    />
  );
}

export function ProductCard({ p }: { p: ProductCardData }) {
  const price = formatPrice(p.price, p.currency);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-card">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-secondary">
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
        {p.short_description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.short_description}</p>}
        <p className="mt-auto pt-1 text-sm font-semibold text-foreground">
          {price ?? <span className="font-normal text-muted-foreground">Check latest price on Amazon</span>}
        </p>
        <div className="flex gap-2 pt-1">
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-input text-xs font-medium text-foreground hover:bg-secondary"
          >
            View
          </Link>
          <BuyButton productId={p.id} url={p.amazon_url} size="sm" label="Amazon" className="h-10 flex-[1.3] rounded-full" />
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
