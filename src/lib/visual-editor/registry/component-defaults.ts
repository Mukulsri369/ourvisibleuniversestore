import type { ComponentType, SafeComponentProps } from "../schema/nodes";
import type { NodeStyleBundle } from "../schema/responsive";
import type { DataBinding } from "../schema/bindings";

export interface ComponentDefaultConfig {
  readonly props: Readonly<SafeComponentProps>;
  readonly style: Readonly<NodeStyleBundle>;
  readonly binding?: Readonly<DataBinding>;
}

export const COMPONENT_DEFAULTS: Readonly<Record<ComponentType, ComponentDefaultConfig>> =
  Object.freeze({
    // Basic elements
    Text: {
      props: { text: "Discover astronomy-inspired gear and cosmic gifts." },
      style: {},
    },
    Heading: {
      props: { text: "Cosmic Collection", headingLevel: "h2" },
      style: {},
    },
    Image: {
      props: {},
      style: {},
    },
    Video: {
      props: {},
      style: {},
    },
    Button: {
      props: { label: "Explore collection", href: "/shop", variant: "default" },
      style: {},
    },
    Icon: {
      props: { iconName: "Sparkles" },
      style: {},
    },
    Divider: {
      props: { variant: "default" },
      style: {},
    },
    Spacer: {
      props: {},
      style: {
        geometry: {
          height: { unit: "px", value: 32 },
        },
      },
    },
    Shape: {
      props: { variant: "glass" },
      style: {
        shape: {
          shapeType: "rounded-rectangle",
          cornerRadius: { mode: "uniform", unit: "px", uniform: 16 },
        },
      },
    },

    // Layout elements
    Section: {
      props: {},
      style: {},
    },
    Container: {
      props: {},
      style: {},
    },
    Stack: {
      props: {},
      style: {
        layout: {
          mode: "flex",
          flex: {
            direction: "column",
            rowGapPx: 16,
          },
        },
      },
    },
    Grid: {
      props: {},
      style: {
        layout: {
          mode: "grid",
          grid: {
            columns: 3,
            columnGapPx: 16,
            rowGapPx: 16,
          },
        },
      },
    },
    GridItem: {
      props: {},
      style: {},
    },
    Overlay: {
      props: {},
      style: {},
    },

    // Storefront elements
    PlanetHero: {
      props: {
        brandTitle: "OUR VISIBLE UNIVERSE",
        brandHighlight: "STORE",
        eyebrow: "PLANET",
        label: "Explore collection",
        href: "/shop",
        scrollTargetId: "festival-special",
      },
      style: {},
    },
    CelestialScrollWorld: {
      props: {},
      style: {},
    },
    ProductScrollRail: {
      props: {
        title: "Featured",
        variant: "default",
        showViewAllLink: true,
        viewAllLabel: "View all",
        viewAllHref: "/shop",
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "featured",
        sortMode: "default_preserve_order",
        limit: 24,
      },
    },
    ProductCard: {
      props: {
        compact: false,
      },
      style: {},
    },
    CategorySpotlightHero: {
      props: {
        label: "View product",
      },
      style: {},
    },
    CategoryCard: {
      props: {
        label: "Explore",
      },
      style: {},
    },
    StoreHeader: {
      props: {},
      style: {},
    },
    StoreFooter: {
      props: {},
      style: {},
    },

    // Storefront & Future sections
    ProductGrid: {
      props: {
        title: "Featured Instruments",
        showViewAllLink: true,
        viewAllLabel: "View all",
        viewAllHref: "/shop",
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "featured",
        sortMode: "default_preserve_order",
        limit: 12,
      },
    },
    CategoryGrid: {
      props: {
        eyebrow: "Explore Sectors",
        title: "Browse by Category",
      },
      style: {},
      binding: {
        kind: "category_collection",
        mode: "all_active",
        respectDisplayOrder: true,
        hideEmptyCategories: true,
        limit: 12,
      },
    },
    FestivalSection: {
      props: {
        eyebrow: "Festival Special",
        title: "Festival Lights",
        description: "Galaxy night lights, glowing globes, and starry lamps for festive spaces.",
        variant: "festive",
        viewAllLabel: "Explore lights",
        viewAllHref: "/search?q=light",
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "festival",
        sortMode: "default_preserve_order",
        limit: 24,
      },
    },
    FeaturedCollection: {
      props: {
        title: "Featured",
        viewAllLabel: "View all",
        viewAllHref: "/search?featured=true",
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "featured",
        sortMode: "default_preserve_order",
        limit: 24,
      },
    },
    PromotionalBanner: {
      props: {
        eyebrow: "Curated Observatory",
        title: "Explore the Visible Universe",
        description: "Handpicked instruments, celestial lighting, and space gear.",
        label: "Browse all",
        href: "/shop",
      },
      style: {},
    },
    InterestSection: {
      props: {
        title: "Explore by interest",
      },
      style: {},
    },
    BenefitsSection: {
      props: {
        title: "Why shop with us",
      },
      style: {},
    },
    InstagramSection: {
      props: {
        title: "Follow our journey",
        description: "Daily space photography and new curated arrivals on Instagram.",
        label: "Follow on Instagram",
      },
      style: {},
    },
  });

export function cloneDefaultComponentProps(type: ComponentType): SafeComponentProps {
  const entry = COMPONENT_DEFAULTS[type];
  return entry ? structuredClone(entry.props as SafeComponentProps) : {};
}

export function cloneDefaultComponentStyle(type: ComponentType): NodeStyleBundle {
  const entry = COMPONENT_DEFAULTS[type];
  return entry ? structuredClone(entry.style as NodeStyleBundle) : {};
}

export function cloneDefaultComponentBinding(type: ComponentType): DataBinding | undefined {
  const entry = COMPONENT_DEFAULTS[type];
  return entry?.binding ? structuredClone(entry.binding as DataBinding) : undefined;
}
