import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowUpRight,
  Sparkles,
  Telescope,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatPrice, logOutboundClick, productQuery, type ProductCardData } from "@/lib/store";
import { BuyButton } from "./BuyButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductQuickPreviewModalProps {
  product: ProductCardData | null;
  onClose: () => void;
}

export function ProductQuickPreviewModal({ product, onClose }: ProductQuickPreviewModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Fetch full product details (to acquire all alternate gallery images)
  const { data: fullProduct } = useQuery({
    ...productQuery(product?.slug ?? ""),
    enabled: !!product?.slug,
  });

  // Collect all available image URLs
  const images =
    fullProduct?.images && fullProduct.images.length > 0
      ? fullProduct.images
      : product?.images && product.images.length > 0
        ? product.images
        : product?.image
          ? [{ image_url: product.image, alt_text: product.imageAlt || product.name }]
          : [];

  // Reset image index when product changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.id]);

  const nextImage = useCallback(() => {
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Handle escape and arrow key shortcuts
  useEffect(() => {
    if (!product) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        nextImage();
      } else if (e.key === "ArrowLeft") {
        prevImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [product, onClose, nextImage, prevImage]);

  if (!product) return null;

  const currentImg = images[activeImageIndex];
  const price = formatPrice(product.price, product.currency);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-primary/40 bg-card/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
        {/* TOP GLOW ACCENT */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-80 rounded-full bg-primary/20 blur-3xl" />

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full border border-border/80 bg-background/80 text-foreground backdrop-blur hover:bg-secondary hover:text-primary transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* SLIDESHOW VIEWPORT */}
          <div className="relative flex flex-col justify-between bg-secondary/30 p-4 sm:p-6 border-b md:border-b-0 md:border-r border-border/50">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-secondary/50 border border-border/40 flex items-center justify-center">
              {currentImg?.image_url ? (
                <img
                  key={currentImg.image_url}
                  src={currentImg.image_url}
                  alt={currentImg.alt_text || product.name}
                  className="size-full object-cover transition-opacity duration-300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <Telescope className="size-10 opacity-40 mb-2" />
                  <span className="text-xs font-mono">Cosmic Optical Specimen</span>
                </div>
              )}

              {/* SLIDESHOW CONTROLS (IF MULTIPLE IMAGES) */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      prevImage();
                    }}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-primary hover:text-primary-foreground transition-all shadow-md"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextImage();
                    }}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-primary hover:text-primary-foreground transition-all shadow-md"
                  >
                    <ChevronRight className="size-4" />
                  </button>

                  <div className="absolute bottom-2.5 right-2.5 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[10px] text-foreground backdrop-blur border border-border/60">
                    {activeImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* THUMBNAIL STRIP */}
            {images.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2 overflow-x-auto py-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={`View image ${idx + 1}`}
                    className={cn(
                      "size-10 sm:size-11 shrink-0 overflow-hidden rounded-lg border transition-all",
                      activeImageIndex === idx
                        ? "border-primary ring-2 ring-primary/40 scale-105"
                        : "border-border/60 opacity-60 hover:opacity-100",
                    )}
                  >
                    <img src={img.image_url} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PRODUCT INFO & QUICK ACTIONS */}
          <div className="flex flex-col justify-between p-5 sm:p-7">
            <div>
              {/* CATEGORY & BADGE */}
              <div className="flex items-center justify-between gap-2">
                {product.category && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-semibold">
                    {product.category.name}
                  </span>
                )}
                {product.featured && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary border border-primary/30">
                    ★ Featured
                  </span>
                )}
              </div>

              {/* TITLE */}
              <h3
                id="quick-preview-title"
                className="mt-2 text-base sm:text-lg font-bold leading-snug text-foreground"
              >
                {product.name}
              </h3>

              {/* PRICE */}
              <div className="mt-3">
                <span className="font-mono text-lg sm:text-xl font-bold tabular-nums text-primary">
                  {price ?? "Check latest price"}
                </span>
              </div>

              {/* SHORT DESCRIPTION (IF AVAILABLE) */}
              {product.short_description && (
                <p className="mt-3 text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {product.short_description}
                </p>
              )}

              {/* CELESTIAL BRAND LABEL */}
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/80">
                <Sparkles className="size-3 text-primary shrink-0" />
                <span>Our Visible Universe Specimen</span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-6 flex flex-col gap-2.5 pt-4 border-t border-border/50">
              {product.affiliate_url && (
                <a
                  href={product.affiliate_url}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  onClick={() => logOutboundClick(product.id)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
                >
                  <span>Buy on Retailer</span>
                  <ExternalLink className="size-3.5" />
                </a>
              )}

              <Link
                to="/product/$slug"
                params={{ slug: product.slug }}
                onClick={onClose}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 w-full rounded-full border-border/80 text-xs font-medium text-foreground hover:bg-secondary justify-center",
                )}
              >
                <span>View Full Details & Specs</span>
                <ArrowUpRight className="ml-1.5 size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
