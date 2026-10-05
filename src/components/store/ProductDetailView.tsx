import { Link } from "@tanstack/react-router";
import { Check, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { formatPrice, type ProductFull } from "@/lib/store";
import { BuyButton } from "./BuyButton";
import { ProductImage } from "./ProductCard";

export function Description({ text }: { text: string }) {
  // Clean formatting: blank-line paragraphs, "- " bullet lines.
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="prose-cosmic">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*[-•*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {l}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function ProductDetailView({ p, disclosure, preview }: { p: ProductFull; disclosure?: string | null | undefined; preview?: boolean | undefined }) {
  const [active, setActive] = useState(0);
  const price = formatPrice(p.price, p.currency);
  const main = p.images[active] ?? p.images[0];

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      <div>
        <div className="aspect-square overflow-hidden rounded-3xl border border-border bg-secondary">
          <ProductImage src={main?.image_url ?? null} alt={main?.alt_text || p.name} className="h-full w-full" eager />
        </div>
        {p.images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {p.images.map((im, i) => (
              <button
                key={im.image_url + i}
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                className={`size-18 shrink-0 overflow-hidden rounded-xl border-2 ${i === active ? "border-primary" : "border-transparent opacity-70"}`}
              >
                <img src={im.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {p.category &&
          (preview ? (
            <p className="eyebrow">{p.category.name}</p>
          ) : (
            <Link to="/category/$slug" params={{ slug: p.category.slug }} className="eyebrow hover:underline">
              {p.category.name}
            </Link>
          ))}
        <h1 className="mt-3 text-4xl leading-tight text-foreground sm:text-5xl">{p.name}</h1>
        {p.brand && <p className="mt-2 text-sm text-muted-foreground">by {p.brand}</p>}
        {p.short_description && <p className="mt-5 text-lg text-muted-foreground">{p.short_description}</p>}

        <div className="glass mt-7 rounded-2xl p-5">
          <p className="text-2xl font-semibold text-foreground">{price ?? "Check latest price"}</p>
          {price && (
            <p className="mt-1 text-xs text-muted-foreground">
              Price shown may change. The retailer's checkout shows the final price{p.price_updated_at ? ` · last checked ${new Date(p.price_updated_at).toLocaleDateString()}` : ""}.
            </p>
          )}
          <BuyButton productId={p.id} url={p.affiliate_url} size="xl" className="mt-5 w-full" label="BUY NOW" track={!preview} />
          <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>
              {disclosure ?? "We may earn a commission from qualifying purchases."} Purchase, payment and delivery are handled by the linked retailer.
            </span>
          </p>
        </div>

        {p.features.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl">Highlights</h2>
            <ul className="mt-4 space-y-3">
              {p.features.map((f, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {p.description && (
          <div className="mt-8">
            <h2 className="mb-3 text-2xl">About this product</h2>
            <Description text={p.description} />
          </div>
        )}

        {p.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {p.tags.map((t) =>
              preview ? (
                <span key={t} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">#{t}</span>
              ) : (
                <Link key={t} to="/search" search={{ q: t }} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                  #{t}
                </Link>
              ),
            )}
          </div>
        )}
      </div>

      {!preview && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 p-3 backdrop-blur-xl lg:hidden">
          <BuyButton productId={p.id} url={p.affiliate_url} size="lg" className="w-full" label="BUY NOW" />
        </div>
      )}
    </div>
  );
}
