import React from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Flame,
  Instagram,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Telescope,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid } from "@/components/store/ProductCard";
import { ProductScrollRail } from "@/components/store/ProductScrollRail";
import { CategorySpotlightHero } from "@/components/store/CategorySpotlightHero";
import { CategoryCard } from "@/components/store/CategoryCard";
import { EmptyState } from "@/components/store/Pagination";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import {
  resolveCategoryCollection,
  resolveProductCollection,
  resolveRepeatedCategorySections,
} from "../rendering/data-resolver";
import { AdapterBoundary } from "./AdapterBoundary";

const DEFAULT_INTERESTS = [
  "diwali lights",
  "telescope",
  "galaxy",
  "Saturn",
  "moon",
  "projector",
  "astronaut",
  "NASA",
  "solar system",
  "space t shirt",
  "astronomy gift",
] as const;

const ICON_MAP: Record<string, typeof Sparkles> = {
  Sparkles,
  Star,
  Telescope,
  Compass,
  ShieldCheck,
  BadgeCheck,
  Flame,
  Instagram,
  Rocket,
  ArrowRight,
};

export function TextAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      <p className="text-sm text-muted-foreground leading-relaxed">
        {node.props.text ?? node.props.description ?? ""}
      </p>
    </AdapterBoundary>
  );
}

export function HeadingAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const Tag = node.props.headingLevel ?? "h2";
  const content = node.props.text ?? node.props.title ?? "";
  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      {node.props.eyebrow && <p className="eyebrow">{node.props.eyebrow}</p>}
      <Tag className="font-semibold tracking-tight text-foreground">{content}</Tag>
    </AdapterBoundary>
  );
}

export function ImageAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const primaryMedia = node.media?.primary ?? Object.values(node.media ?? {})[0];
  const src = primaryMedia?.url ?? "";
  const alt = primaryMedia?.altText ?? node.props.title ?? "";

  const objectFit = resolvedStyle.shape?.imageCrop?.objectFit ?? primaryMedia?.objectFit ?? "cover";
  const focalPoint = resolvedStyle.shape?.imageCrop?.focalPoint;
  const objectPosition = focalPoint ? `${focalPoint.xPercent}% ${focalPoint.yPercent}%` : undefined;

  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={primaryMedia?.loadingPriority === "eager" ? "eager" : "lazy"}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            ...(objectPosition ? { objectPosition } : {}),
          }}
        />
      ) : (
        <div className="nebula starfield flex min-h-24 w-full items-center justify-center rounded-xl border border-border/50 text-xs text-muted-foreground">
          No image selected
        </div>
      )}
    </AdapterBoundary>
  );
}

export function VideoAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { interactionPolicy } = usePageRenderContext();
  const primaryMedia = node.media?.primary ?? Object.values(node.media ?? {})[0];
  const src = primaryMedia?.url;

  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      {src && !interactionPolicy.disableHeavyMediaAndScrollEffects ? (
        <video
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="nebula flex min-h-24 w-full items-center justify-center rounded-xl border border-border/50 text-xs text-muted-foreground">
          {node.props.title ?? "Video Media"}
        </div>
      )}
    </AdapterBoundary>
  );
}

export function ButtonAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const label = node.props.label ?? node.props.text ?? "Explore";
  const href = node.props.href ?? "/shop";
  const variant =
    node.props.variant === "planet"
      ? "planet"
      : node.props.variant === "outline"
        ? "outline"
        : node.props.variant === "ghost"
          ? "ghost"
          : node.props.variant === "glass"
            ? "glass"
            : node.props.variant === "secondary"
              ? "secondary"
              : "default";

  const isExternal = href.startsWith("https://");

  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      {isExternal ? (
        <a
          href={href}
          target={node.props.openInNewTab ? "_blank" : undefined}
          rel={node.props.openInNewTab ? "noopener noreferrer" : undefined}
          className={buttonVariants({ variant })}
        >
          {label}
        </a>
      ) : (
        <Link to={href} className={buttonVariants({ variant })}>
          {label}
        </Link>
      )}
    </AdapterBoundary>
  );
}

export function IconAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const IconComp = ICON_MAP[node.props.iconName ?? "Sparkles"] ?? Sparkles;
  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      <IconComp className="size-5 text-primary" aria-label={node.props.label} />
    </AdapterBoundary>
  );
}

export function DividerAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      <hr className="border-t border-border/70 my-4" />
    </AdapterBoundary>
  );
}

export function SpacerAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      <div aria-hidden="true" className="w-full" />
    </AdapterBoundary>
  );
}

export function ShapeAdapter({ node, resolvedStyle, children }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      {node.props.text && <span>{node.props.text}</span>}
      {children}
    </AdapterBoundary>
  );
}

export function SectionAdapter({
  node,
  resolvedStyle,
  children,
  slots,
}: ComponentAdapterRenderProps) {
  const { dataCatalog } = usePageRenderContext();

  // Support dynamic repeated category sections binding (CategorySpotlightHero + ProductScrollRail)
  if (node.binding?.kind === "repeated_category_sections") {
    const repeatedSections = resolveRepeatedCategorySections(node.binding, dataCatalog);

    return (
      <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
        {repeatedSections.map(({ category, products, spotlightProduct, sectorLore }) => (
          <section
            key={category.id}
            className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:py-10 sm:px-6 transition-all duration-500 ease-out animate-in fade-in"
          >
            {spotlightProduct && (
              <CategorySpotlightHero
                product={spotlightProduct}
                categoryName={category.name}
                categorySlug={category.slug}
                sectorLore={sectorLore}
              />
            )}
            <ProductScrollRail
              title={category.name}
              count={products.length}
              link={{
                to: "/category/$slug",
                params: { slug: category.slug },
                label: "View all",
              }}
              items={products}
              className="my-0"
            />
          </section>
        ))}
      </AdapterBoundary>
    );
  }

  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      <section className="relative z-10">
        {slots?.header}
        {children}
        {slots?.footer}
      </section>
    </AdapterBoundary>
  );
}

export function ContainerAdapter({ node, resolvedStyle, children }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary
      node={node}
      resolvedStyle={resolvedStyle}
      disableWrapperWhenUnstyledInPublic={false}
    >
      {children}
    </AdapterBoundary>
  );
}

export function ProductGridSectionAdapter({
  node,
  resolvedStyle,
  children,
}: ComponentAdapterRenderProps) {
  const { dataCatalog } = usePageRenderContext();
  const binding = node.binding?.kind === "product_collection" ? node.binding : undefined;
  const items = resolveProductCollection(binding, dataCatalog);

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:py-10 sm:px-6">
        {(node.props.title || node.props.eyebrow) && (
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              {node.props.eyebrow && <p className="eyebrow">{node.props.eyebrow}</p>}
              {node.props.title && (
                <h2 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight">
                  {node.props.title}
                </h2>
              )}
            </div>
            {node.props.showViewAllLink && node.props.viewAllHref && (
              <Link
                to={node.props.viewAllHref}
                className="hidden shrink-0 items-center gap-1 text-xs sm:text-sm font-medium text-accent hover:underline sm:inline-flex"
              >
                {node.props.viewAllLabel ?? "View all"}{" "}
                <ArrowRight className="size-3.5 sm:size-4" />
              </Link>
            )}
          </div>
        )}
        <ProductGrid items={items} />
        {children}
      </section>
    </AdapterBoundary>
  );
}

export function CategoryGridSectionAdapter({
  node,
  resolvedStyle,
  children,
}: ComponentAdapterRenderProps) {
  const { dataCatalog } = usePageRenderContext();
  const binding = node.binding?.kind === "category_collection" ? node.binding : undefined;
  const categories = resolveCategoryCollection(binding, dataCatalog);

  const cellSpans = resolvedStyle.layout?.bento?.cellSpans ?? [];

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6">
        {(node.props.title || node.props.eyebrow) && (
          <div className="mb-6">
            {node.props.eyebrow && <p className="eyebrow">{node.props.eyebrow}</p>}
            {node.props.title && (
              <h2 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight">
                {node.props.title}
              </h2>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat, idx) => {
            const span = cellSpans.find((s) => s.itemIndex === idx);
            const spanStyle: React.CSSProperties | undefined = span
              ? {
                  gridColumn: `span ${span.colSpan} / span ${span.colSpan}`,
                  gridRow: `span ${span.rowSpan} / span ${span.rowSpan}`,
                }
              : undefined;
            return (
              <div key={cat.id} style={spanStyle}>
                <CategoryCard c={cat} index={idx} />
              </div>
            );
          })}
        </div>
        {children}
      </section>
    </AdapterBoundary>
  );
}

export function FestivalSectionAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { dataCatalog } = usePageRenderContext();
  const binding =
    node.binding?.kind === "product_collection"
      ? node.binding
      : ({
          kind: "product_collection",
          source: "festival",
          sortMode: "default_preserve_order",
          limit: 24,
        } as const);

  const items = resolveProductCollection(binding, dataCatalog);
  const eyebrow = node.props.eyebrow ?? "Festival Special";
  const title = node.props.title ?? "Festival Lights";
  const desc =
    node.props.description ??
    node.props.subtitle ??
    "Galaxy night lights, glowing globes, and starry lamps for festive spaces.";

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section
        id="festival-special"
        className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 pt-12 pb-4 sm:px-6 sm:pt-16 sm:pb-6"
      >
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/25 bg-gradient-to-b from-primary/10 via-card/50 to-card/25 p-4 sm:p-8 md:p-10 shadow-glow">
          <div className="starfield absolute inset-0 opacity-40 pointer-events-none" />
          <div className="relative">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow flex items-center gap-1.5 text-primary">
                  <Flame className="size-3.5 text-primary" /> {eyebrow}
                </p>
                <h2 className="mt-1.5 text-2xl sm:text-4xl font-semibold text-foreground">
                  {title}
                </h2>
                <p className="mt-2 max-w-2xl text-xs sm:text-sm text-muted-foreground">{desc}</p>
              </div>
              <Link
                to="/search"
                search={{ q: "light" }}
                className="hidden shrink-0 items-center gap-1 text-xs sm:text-sm font-medium text-accent hover:underline sm:inline-flex"
              >
                {node.props.viewAllLabel ?? "Explore lights"}{" "}
                <ArrowRight className="size-3.5 sm:size-4" />
              </Link>
            </div>

            <div className="mt-5 sm:mt-8">
              {items.length > 0 ? (
                <ProductScrollRail variant="festive" items={items} className="my-0" />
              ) : (
                <EmptyState
                  title="Lighting collection arriving soon"
                  text="Discover glowing lamps and radiant pieces for your home."
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </AdapterBoundary>
  );
}

export function FeaturedCollectionSectionAdapter({
  node,
  resolvedStyle,
}: ComponentAdapterRenderProps) {
  const { dataCatalog } = usePageRenderContext();
  const binding =
    node.binding?.kind === "product_collection"
      ? node.binding
      : ({
          kind: "product_collection",
          source: "featured",
          sortMode: "default_preserve_order",
          limit: 24,
        } as const);

  const items = resolveProductCollection(binding, dataCatalog);
  if (items.length === 0) return null;

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section className="relative z-10 mx-auto max-w-7xl scroll-mt-20 px-4 py-6 sm:py-10 sm:px-6">
        <ProductScrollRail
          title={node.props.title ?? "Featured"}
          eyebrow={node.props.eyebrow}
          link={{
            to: node.props.viewAllHref ?? "/search",
            search: { featured: true },
            label: node.props.viewAllLabel ?? "View all",
          }}
          items={items}
          className="my-0"
        />
      </section>
    </AdapterBoundary>
  );
}

export function PromotionalBannerAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border px-5 py-10 text-center sm:px-12 sm:py-14">
          <div className="nebula starfield absolute inset-0" />
          <div className="relative">
            {node.props.eyebrow && <p className="eyebrow">{node.props.eyebrow}</p>}
            <h2 className="mx-auto mt-2 max-w-2xl text-2xl sm:text-4xl font-semibold">
              {node.props.title ?? "Explore the Visible Universe"}
            </h2>
            {node.props.description && (
              <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-muted-foreground">
                {node.props.description}
              </p>
            )}
            <Link
              to={node.props.href ?? "/shop"}
              className={`${buttonVariants({ variant: "default" })} mt-5 sm:mt-6`}
            >
              {node.props.label ?? "Explore"}
            </Link>
          </div>
        </div>
      </section>
    </AdapterBoundary>
  );
}

export function InterestSectionAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            {node.props.eyebrow && <p className="eyebrow">{node.props.eyebrow}</p>}
            <h2 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight">
              {node.props.title ?? "Explore by interest"}
            </h2>
          </div>
        </div>
        <div className="mt-5 sm:mt-6 flex flex-wrap gap-2 sm:gap-2.5">
          {DEFAULT_INTERESTS.map((t) => (
            <Link
              key={t}
              to="/search"
              search={{ q: t }}
              className="rounded-full border border-border bg-card/50 px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>
    </AdapterBoundary>
  );
}

export function BenefitsSectionAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            {node.props.eyebrow && <p className="eyebrow">{node.props.eyebrow}</p>}
            <h2 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight">
              {node.props.title ?? "Why shop with us"}
            </h2>
          </div>
        </div>
        <div className="mt-6 sm:mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Compass,
              t: "Curated collection",
              d: "Handpicked for quality, design, and space enthusiasts.",
            },
            {
              icon: ShieldCheck,
              t: "Trusted retailers",
              d: "Orders and delivery are fulfilled securely by verified merchants.",
            },
            {
              icon: BadgeCheck,
              t: "Transparent",
              d: "Clear pricing and verified links with no hidden fees.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="glass rounded-xl sm:rounded-2xl p-5 sm:p-6">
              <Icon className="size-5 sm:size-6 text-primary" strokeWidth={1.5} />
              <h3 className="mt-4 font-sans text-sm sm:text-base font-semibold">{t}</h3>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </AdapterBoundary>
  );
}

export function InstagramSectionAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { dataCatalog } = usePageRenderContext();
  const instagramUrl =
    node.props.href || dataCatalog.settings?.instagram_url || "https://instagram.com";

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border px-5 py-10 text-center sm:px-12 sm:py-14">
          <div className="nebula starfield absolute inset-0" />
          <div className="relative">
            <Sparkles className="mx-auto size-5 text-primary" />
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl sm:text-4xl font-semibold">
              {node.props.title ?? "Follow our journey"}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-muted-foreground">
              {node.props.description ??
                "Daily space photography and new curated arrivals on Instagram."}
            </p>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonVariants({ variant: "affiliate", size: "default" })} mt-5 sm:mt-6 text-xs sm:text-sm`}
            >
              <Instagram className="size-4" /> {node.props.label ?? "Follow on Instagram"}
            </a>
          </div>
        </div>
      </section>
    </AdapterBoundary>
  );
}
