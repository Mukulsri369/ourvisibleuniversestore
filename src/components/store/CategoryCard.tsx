import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  Clock,
  Gift,
  GraduationCap,
  Lightbulb,
  Orbit,
  Palette,
  PartyPopper,
  Rocket,
  Shirt,
  Smartphone,
  Sparkles,
  Star,
  Telescope,
  Baby,
  Lamp,
} from "lucide-react";
import type { Category } from "@/lib/store";

const ICONS: Record<string, typeof Star> = {
  "cosmic-lighting": Lightbulb,
  "space-wall-art": Palette,
  "kids-learning": Baby,
  "space-party-supplies": PartyPopper,
  "clocks-timepieces": Clock,
  "books-guides": BookOpen,
  "space-decor": Orbit,
  "astronomy-gifts": Gift,
  "tech-accessories": Smartphone,
  // Backward compatibility legacy slugs
  lights: Lightbulb,
  lamp: Lamp,
  projectors: Sparkles,
  spaceart: Palette,
  posters: Palette,
  clock: Clock,
  books: BookOpen,
  "space-b-day-party": PartyPopper,
  "mobile-accessories": Smartphone,
  "space-gadgets": Rocket,
  "astronomy-telescopes": Telescope,
  "astronomy-apparel": Shirt,
  "galaxy-nebula": Sparkles,
  "solar-system": Orbit,
  "educational-science": GraduationCap,
};

export function CategoryCard({
  c,
  index = 0,
  style,
  imageStyle,
}: {
  c: Category;
  index?: number;
  style?: React.CSSProperties;
  imageStyle?: React.CSSProperties;
}) {
  const Icon = ICONS[c.slug] ?? Star;
  return (
    <Link
      to="/category/$slug"
      params={{ slug: c.slug }}
      style={style}
      className="group relative flex min-h-48 flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-card"
    >
      {c.image_url ? (
        <>
          <img
            src={c.image_url}
            alt=""
            loading="lazy"
            style={imageStyle}
            className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </>
      ) : (
        <div
          className="nebula starfield absolute inset-0 opacity-90"
          style={{ backgroundPosition: `${index * 37}px ${index * 53}px` }}
        />
      )}
      <div className="relative">
        <Icon className="mb-6 size-7 text-primary" strokeWidth={1.4} />
        <h3
          style={style?.color ? { color: style.color } : undefined}
          className="font-sans text-sm font-bold uppercase tracking-[0.14em] text-foreground"
        >
          {c.name}
        </h3>
        {c.description && <p className="mt-1.5 text-sm text-muted-foreground">{c.description}</p>}
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent">
          Explore{" "}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
