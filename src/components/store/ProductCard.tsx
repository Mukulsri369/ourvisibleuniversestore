import { isProductVideo } from "@/lib/product-media";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Eye, Telescope } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatPrice, logOutboundClick, type ProductCardData } from "@/lib/store";
import { BuyButton } from "./BuyButton";
import { ProductQuickPreviewModal } from "./ProductQuickPreviewModal";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  alt,
  className,
  eager,
  style,
}: {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  const mediaVideo = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = mediaVideo.current;
    if (!element || reducedMotion || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void element.play().catch(() => {});
      else element.pause();
    }, { threshold: .2 });
    observer.observe(element);
    return () => { observer.disconnect(); element.pause(); };
  }, [src, reducedMotion]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        style={style}
        className={cn(
          "flex items-center justify-center bg-secondary/80 nebula text-muted-foreground",
          className,
        )}
      >
        <Telescope className="size-6 sm:size-8 opacity-40" />
      </div>
    );
  }
  if (isProductVideo(src)) return <video ref={mediaVideo} src={src!} aria-label={alt} muted playsInline controls={!!reducedMotion} loop preload="metadata" style={style} className={cn("object-cover", className)} />;
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      data-product-image-zoom
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
        const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
        event.currentTarget.style.setProperty("--product-image-x", `${x}%`);
        event.currentTarget.style.setProperty("--product-image-y", `${y}%`);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.removeProperty("--product-image-x");
        event.currentTarget.style.removeProperty("--product-image-y");
      }}
      style={style}
      className={cn("product-image-hover-zoom object-cover", className)}
    />
  );
}

export function ProductCard({
  p,
  compact = false,
  className = "",
  style,
  imageStyle,
  onQuickPreview,
  editorInstanceId,
}: {
  p: ProductCardData;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
  imageStyle?: React.CSSProperties;
  onQuickPreview?: (p: ProductCardData) => void;
  editorInstanceId?: string;
}) {
  const price = formatPrice(p.price, p.currency);
  const [active, setActive] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Normalize image list
  const imageList =
    p.images && p.images.length > 0
      ? p.images
      : p.image
        ? [{ image_url: p.image, alt_text: p.imageAlt }]
        : [];
  const hasMultipleImages = imageList.length > 1;

  // Reset to first image if product changes
  useEffect(() => {
    setActive(0);
    setIsHovered(false);
  }, [p.id]);

  const currentImg = imageList[active] ?? imageList[0];
  const currentSrc = currentImg?.image_url ?? p.image;
  const currentAlt = currentImg?.alt_text || p.imageAlt || p.name;

  if (compact) {
    return (
      <article
        style={style}
        data-editor-instance-id={editorInstanceId}
        data-editor-instance-type={editorInstanceId ? "ProductCard" : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "product-card-cinematic group relative flex flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-sm snap-start shrink-0 select-none",
          "w-[calc((100vw-48px)/1.75)] min-w-[calc((100vw-48px)/1.75)] max-w-[calc((100vw-48px)/1.75)] sm:max-w-none sm:w-[180px] sm:min-w-[180px] md:w-[205px] md:min-w-[205px] lg:w-[220px] lg:min-w-[220px] xl:w-[238px] xl:min-w-[238px]",
          className,
        )}
      >
        {/* COMPACT IMAGE CONTAINER */}
        <div
          style={imageStyle?.aspectRatio ? { aspectRatio: imageStyle.aspectRatio } : undefined}
          className="relative aspect-square w-full overflow-hidden bg-secondary/60"
        >
          <Link to="/product/$slug" params={{ slug: p.slug }} className="block size-full relative">
            {hasMultipleImages ? (
              <AnimatePresence initial={false}>
                <motion.div
                  key={currentSrc || active}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  className="absolute inset-0 h-full w-full"
                >
                  <ProductImage
                    src={currentSrc}
                    alt={currentAlt}
                    style={imageStyle}
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <ProductImage
                src={p.image}
                alt={p.imageAlt || p.name}
                style={imageStyle}
                className="h-full w-full"
              />
            )}
          </Link>

          {/* SUBTLE MULTI-IMAGE INDICATOR DOTS (CLICKABLE ON HOVER/FOCUS) */}
          {hasMultipleImages && (
            <div className="absolute bottom-1 left-0 right-0 z-10 flex justify-center items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {imageList.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActive(idx);
                  }}
                  aria-label={`View image ${idx + 1}`}
                  className="p-0.5 focus:outline-none"
                >
                  <span
                    className={cn(
                      "block h-1 rounded-full transition-all duration-300",
                      idx === active
                        ? "w-2.5 sm:w-3 bg-primary shadow-sm"
                        : "w-1 bg-foreground/50 hover:bg-foreground/80",
                    )}
                  />
                </button>
              ))}
            </div>
          )}

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
              <p className="hidden sm:block text-[9px] uppercase tracking-widest font-mono text-muted-foreground truncate mb-1">
                {p.category.name}
              </p>
            )}
            <Link to="/product/$slug" params={{ slug: p.slug }}>
              <h3
                className="line-clamp-2 text-xs sm:text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary"
                title={p.name}
              >
                {p.name}
              </h3>
            </Link>
          </div>

          <div className="pt-0.5">
            <p className="text-xs sm:text-sm font-semibold text-primary truncate">
              {price ?? <span className="font-normal text-[10px] text-muted-foreground">Price</span>}
            </p>

            <div className="mt-1 flex items-center gap-1">
              {onQuickPreview && (
                <button
                  onClick={() => onQuickPreview(p)}
                  className="sm:hidden flex-1 h-7 rounded-md bg-secondary/80 text-[10px] font-medium text-foreground hover:text-primary"
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
                  className="inline-flex h-7 sm:h-8 w-full sm:w-auto sm:flex-1 items-center justify-center gap-1 rounded-md bg-primary/15 sm:bg-primary text-[10px] sm:text-xs font-semibold text-primary sm:text-primary-foreground hover:bg-primary/25 sm:hover:bg-primary/90 transition-colors"
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
      style={style}
      data-editor-instance-id={editorInstanceId}
      data-editor-instance-type={editorInstanceId ? "ProductCard" : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "product-card-cinematic group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/65 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-sm",
        className,
      )}
    >
      {/* MAX PHOTO CONTAINER (70%+ OF CARD HEIGHT) */}
      <div
        style={imageStyle?.aspectRatio ? { aspectRatio: imageStyle.aspectRatio } : undefined}
        className="relative aspect-square w-full overflow-hidden bg-secondary/50"
      >
        <Link to="/product/$slug" params={{ slug: p.slug }} className="block size-full relative">
          {hasMultipleImages ? (
            <AnimatePresence initial={false}>
              <motion.div
                key={currentSrc || active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="absolute inset-0 h-full w-full"
              >
                <ProductImage
                  src={currentSrc}
                  alt={currentAlt}
                  style={imageStyle}
                  className="h-full w-full object-cover"
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <ProductImage
              src={p.image}
              alt={p.imageAlt || p.name}
              style={imageStyle}
              className="h-full w-full"
            />
          )}
        </Link>

        {/* SUBTLE MULTI-IMAGE INDICATOR DOTS (CLICKABLE ON HOVER/FOCUS) */}
        {hasMultipleImages && (
          <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {imageList.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActive(idx);
                }}
                aria-label={`View image ${idx + 1}`}
                className="p-1 focus:outline-none"
              >
                <span
                  className={cn(
                    "block h-1 rounded-full transition-all duration-300",
                    idx === active
                      ? "w-4 bg-primary shadow-sm"
                      : "w-1.5 bg-foreground/50 hover:bg-foreground/80",
                  )}
                />
              </button>
            ))}
          </div>
        )}

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
            <h3
              style={style?.color ? { color: style.color } : undefined}
              className="line-clamp-2 text-xs sm:text-[13px] font-medium leading-snug text-foreground hover:text-primary transition-colors"
            >
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
  style,
  editorParentNodeId,
}: {
  items: ProductCardData[];
  className?: string;
  style?: React.CSSProperties;
  editorParentNodeId?: string;
}) {
  const [previewProduct, setPreviewProduct] = useState<ProductCardData | null>(null);

  return (
    <>
      {/* EXPANDED 5-6 PRODUCT ROW GRID */}
      <div
        style={style}
        className={cn(
          "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6",
          className,
        )}
      >
        {items.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            editorInstanceId={
              editorParentNodeId ? `${editorParentNodeId}::product::${p.id}` : undefined
            }
            onQuickPreview={(prod) => setPreviewProduct(prod)}
          />
        ))}
      </div>

      {/* QUICK PREVIEW MODAL WITH SLIDESHOW */}
      <ProductQuickPreviewModal product={previewProduct} onClose={() => setPreviewProduct(null)} />
    </>
  );
}
