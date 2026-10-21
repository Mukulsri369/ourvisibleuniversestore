import { CURRENT_PAGE_SCHEMA_VERSION, type PageDocument } from "../schema/page-document";
import type { EditorNode } from "../schema/nodes";
import { createDeterministicNodeId } from "./ids";

const FIXED_TIMESTAMP = "2026-10-20T15:00:00.000Z";

/**
 * 1. Basic landing-page section fixture (Heading, paragraph, image, button, and container)
 */
export const BASIC_SECTION_DOCUMENT_FIXTURE: PageDocument = {
  id: "doc-basic-landing-01",
  pageId: "page-landing-01",
  pageType: "landing",
  slug: "celestial-intro",
  schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
  name: "Basic Landing Page Section Fixture",
  metadata: {
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    description: "Deterministic basic landing page section fixture",
  },
  root: [
    {
      id: "section-intro-1",
      type: "Section",
      name: "Intro Section",
      props: { title: "Observatory Essentials" },
      style: {
        geometry: {
          width: { unit: "%", value: 100 },
          padding: { top: 64, right: 24, bottom: 64, left: 24, unit: "px" },
        },
        appearance: {
          backgroundColor: "#0b0f19",
        },
      },
      children: [
        {
          id: "container-intro-1",
          type: "Container",
          name: "Content Container",
          props: {},
          style: {
            geometry: {
              maxWidth: { unit: "px", value: 1280 },
            },
            layout: {
              mode: "flex",
              flex: {
                direction: "column",
                alignItems: "center",
                rowGapPx: 20,
              },
            },
          },
          responsive: {
            mobile: {
              geometry: {
                padding: { top: 32, right: 16, bottom: 32, left: 16, unit: "px" },
              },
            },
          },
          children: [
            {
              id: "heading-intro-1",
              type: "Heading",
              name: "Main Heading",
              props: {
                text: "Precision Optics for Deep-Sky Exploration",
                headingLevel: "h1",
              },
              style: {
                appearance: {
                  typography: {
                    fontFamily: "Prata",
                    fontSize: { unit: "px", value: 48 },
                    fontWeight: 400,
                    lineHeight: 1.2,
                    textAlign: "center",
                    color: "#f8fafc",
                  },
                },
              },
              responsive: {
                mobile: {
                  appearance: {
                    typography: {
                      fontSize: { unit: "px", value: 32 },
                    },
                  },
                },
              },
              children: [],
            },
            {
              id: "text-intro-1",
              type: "Text",
              name: "Lead Paragraph",
              props: {
                text: "Curated apochromatic refractors, smart observatories, and planetary specimens.",
              },
              style: {
                geometry: {
                  maxWidth: { unit: "px", value: 640 },
                },
                appearance: {
                  typography: {
                    fontSize: { unit: "px", value: 17 },
                    lineHeight: 1.65,
                    textAlign: "center",
                    color: "#94a3b8",
                  },
                },
              },
              children: [],
            },
            {
              id: "image-intro-1",
              type: "Image",
              name: "Feature Image",
              props: {},
              style: {
                geometry: {
                  width: { unit: "px", value: 720 },
                  aspectRatio: { width: 16, height: 9 },
                },
                shape: {
                  shapeType: "rounded-rectangle",
                  cornerRadius: { mode: "uniform", unit: "px", uniform: 16 },
                },
              },
              media: {
                primary: {
                  assetId: "asset-apo-80",
                  mediaType: "image",
                  url: "/api/public/images/prod-apo-80-1.webp",
                  altText: "80mm ED Triplet Refractor",
                  objectFit: "cover",
                  loadingPriority: "eager",
                },
              },
              children: [],
            },
            {
              id: "button-intro-1",
              type: "Button",
              name: "Primary CTA Button",
              props: {
                label: "Browse Optical Instruments",
                href: "/shop",
                variant: "planet",
              },
              style: {
                geometry: {
                  height: { unit: "px", value: 54 },
                },
                shape: {
                  shapeType: "pill",
                  cornerRadius: { mode: "uniform", unit: "px", uniform: 999 },
                },
              },
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * 2. Product collection fixture (Collection binding, card template config, grid layout, and responsive columns)
 */
export const PRODUCT_COLLECTION_DOCUMENT_FIXTURE: PageDocument = {
  id: "doc-product-collection-01",
  pageId: "page-home-featured",
  pageType: "home",
  slug: "/",
  schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
  name: "Featured Product Collection Fixture",
  metadata: {
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  root: [
    {
      id: "section-featured-grid",
      type: "ProductGrid",
      name: "Featured Products Grid",
      props: {
        eyebrow: "Hand-picked",
        title: "Featured Instruments",
        showCountBadge: true,
        showViewAllLink: true,
        viewAllLabel: "View all",
        viewAllHref: "/shop",
      },
      binding: {
        kind: "product_collection",
        source: "featured",
        sortMode: "deterministic_shuffle",
        deterministicSeed: 42,
        limit: 12,
        cardDisplay: {
          showCategoryBadge: true,
          showFeaturedStar: true,
          showPrice: true,
          showQuickPreviewButton: true,
          showBuyButton: true,
          enableHoverImageSlideshow: true,
          compactMode: false,
        },
      },
      style: {
        layout: {
          mode: "grid",
          grid: {
            columns: 6,
            columnGapPx: 16,
            rowGapPx: 16,
          },
        },
        shape: {
          shapeType: "rounded-rectangle",
          cornerRadius: { mode: "uniform", unit: "px", uniform: 16 },
        },
      },
      responsive: {
        tablet: {
          layout: {
            mode: "grid",
            grid: {
              columns: 4,
              columnGapPx: 14,
              rowGapPx: 14,
            },
          },
        },
        mobile: {
          layout: {
            mode: "grid",
            grid: {
              columns: 2,
              columnGapPx: 10,
              rowGapPx: 10,
            },
          },
        },
      },
      children: [],
    },
  ],
};

/**
 * 3. Category grid fixture (Category bindings, card shapes, bento spans, and mobile overrides)
 */
export const CATEGORY_GRID_DOCUMENT_FIXTURE: PageDocument = {
  id: "doc-category-bento-01",
  pageId: "page-home-categories",
  pageType: "home",
  slug: "/",
  schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
  name: "Category Bento Grid Fixture",
  metadata: {
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  root: [
    {
      id: "section-category-bento",
      type: "CategoryGrid",
      name: "Shop by Celestial Sector",
      props: {
        eyebrow: "Explore Sectors",
        title: "Browse by Category",
      },
      binding: {
        kind: "category_collection",
        mode: "all_active",
        respectDisplayOrder: true,
        hideEmptyCategories: true,
        limit: 8,
      },
      style: {
        layout: {
          mode: "bento",
          bento: {
            columns: 4,
            rowHeightPx: 220,
            gapPx: 16,
            cellSpans: [
              { itemIndex: 0, colSpan: 2, rowSpan: 2 },
              { itemIndex: 1, colSpan: 2, rowSpan: 1 },
            ],
          },
        },
        shape: {
          shapeType: "rounded-rectangle",
          cornerRadius: { mode: "uniform", unit: "px", uniform: 20 },
        },
      },
      responsive: {
        tablet: {
          layout: {
            mode: "grid",
            grid: {
              columns: 2,
              columnGapPx: 14,
              rowGapPx: 14,
            },
          },
        },
        mobile: {
          layout: {
            mode: "grid",
            grid: {
              columns: 1,
              columnGapPx: 10,
              rowGapPx: 10,
            },
          },
        },
      },
      children: [],
    },
  ],
};

/**
 * 4. Hero & Dynamic Category Section Homepage fixture (PlanetHero + CelestialScrollWorld + RepeatedCategorySections)
 */
export const HOMEPAGE_HERO_AND_DYNAMIC_CATEGORIES_FIXTURE: PageDocument = {
  id: "doc-homepage-complete-01",
  pageId: "page-storefront-home",
  pageType: "home",
  slug: "/",
  schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
  name: "Our Visible Universe Storefront Homepage Baseline Document",
  metadata: {
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    description:
      "Models the actual PlanetHero, CelestialScrollWorld, Festival, Rails, and Dynamic Categories",
  },
  settings: {
    celestialWorldEnabled: true,
    preserveCategoryOrder: true,
    preserveFestivalOrder: true,
    containerMaxWidthPx: 1440,
  },
  root: [
    {
      id: "node-store-header",
      type: "StoreHeader",
      name: "Global Storefront Header",
      locked: true,
      props: {},
      style: {},
      children: [],
    },
    {
      id: "node-celestial-world",
      type: "CelestialScrollWorld",
      name: "Celestial Scroll Background",
      props: {},
      style: {
        animation: {
          celestialScroll: {
            enabled: true,
            springStiffness: 55,
            springDamping: 24,
            springMass: 0.6,
            showOrbitalRings: true,
            earthEnabled: true,
            venusEnabled: true,
            marsEnabled: true,
          },
        },
      },
      children: [],
    },
    {
      id: "node-planet-hero",
      type: "PlanetHero",
      name: "Interactive Planet Hero",
      props: {
        brandTitle: "OUR VISIBLE",
        brandHighlight: "UNIVERSE",
        eyebrow: "Explore",
        label: "Explore collection",
        href: "/shop",
        scrollTargetId: "festival-special",
      },
      style: {
        geometry: {
          minHeight: { unit: "px", value: 620 },
          maxHeight: { unit: "px", value: 1080 },
          overflowX: "hidden",
          overflowY: "hidden",
        },
        animation: {
          planetHero: {
            defaultPlanetId: "earth",
            enableVideoPlayback: true,
            titleSlideDurationSec: 0.45,
            ledeFadeDurationSec: 0.55,
            ruleScaleDurationSec: 0.65,
            cutoutHoverScale: 1.045,
          },
        },
      },
      media: {
        earthPoster: {
          mediaType: "poster",
          url: "https://assets.codepen.io/1651485/earth.webp",
          altText: "Earth poster frame",
        },
      },
      children: [],
    },
    {
      id: "node-festival-section",
      type: "FestivalSection",
      name: "Festival Special Rail",
      props: {
        eyebrow: "Celestial Festival",
        title: "Solstice Stargazing Event",
        subtitle: "Limited-time celestial instruments & deep-sky accessories",
        variant: "festive",
      },
      binding: {
        kind: "product_collection",
        source: "festival",
        sortMode: "default_preserve_order",
        limit: 24,
        hideWhenEmpty: true,
      },
      style: {
        layout: {
          mode: "carousel",
          carousel: {
            visibleCards: 6,
            gapPx: 16,
            snapAlign: "start",
            showArrows: true,
            showEdgeFade: true,
          },
        },
      },
      children: [],
    },
    {
      id: "node-dynamic-categories",
      type: "Section",
      name: "Dynamic Category Spotlight & Rail Sections",
      props: {
        title: "Dynamic Categories",
      },
      binding: {
        kind: "repeated_category_sections",
        mode: "all_non_empty",
        respectDisplayOrder: true,
        maxCategories: 20,
        productsPerRail: 19,
        eagerLoadCount: 3,
        useSpotlightForFirstProduct: true,
        railSortMode: "deterministic_shuffle",
      },
      style: {},
      children: [],
    },
    {
      id: "node-store-footer",
      type: "StoreFooter",
      name: "Global Storefront Footer",
      locked: true,
      props: {},
      style: {},
      children: [],
    },
  ],
};

/**
 * Synthetic document builder for benchmarking parsing, validation, traversal, and immutable updates
 * across 25, 150, 500, and 1,000 nodes.
 */
export function buildSyntheticPageDocument(targetNodeCount: number): PageDocument {
  const rootSections: EditorNode[] = [];
  let created = 0;
  let sectionIdx = 1;

  while (created < targetNodeCount) {
    const sectionId = createDeterministicNodeId("Section", sectionIdx, "bench");
    created += 1;
    const containerChildren: EditorNode[] = [];

    if (created < targetNodeCount) {
      const gridId = createDeterministicNodeId("Grid", sectionIdx, "bench");
      created += 1;
      const gridItems: EditorNode[] = [];

      const itemsInThisSection = Math.min(24, targetNodeCount - created);
      for (let k = 1; k <= itemsInThisSection; k += 1) {
        const cardId = createDeterministicNodeId("ProductCard", created + 1, "bench");
        created += 1;
        gridItems.push({
          id: cardId,
          type: "ProductCard",
          name: `Product Card ${created}`,
          props: { compact: true },
          style: {
            geometry: { width: { unit: "px", value: 182 } },
            shape: {
              shapeType: "rounded-rectangle",
              cornerRadius: { mode: "uniform", unit: "px", uniform: 12 },
            },
          },
          responsive: {
            tablet: { geometry: { width: { unit: "px", value: 155 } } },
            mobile: { geometry: { width: { unit: "px", value: 113 } } },
          },
          children: [],
        });
      }

      containerChildren.push({
        id: gridId,
        type: "Grid",
        name: `Benchmark Grid ${sectionIdx}`,
        props: {},
        style: {
          layout: {
            mode: "grid",
            grid: { columns: 6, columnGapPx: 16, rowGapPx: 16 },
          },
        },
        children: gridItems,
      });
    }

    rootSections.push({
      id: sectionId,
      type: "Section",
      name: `Benchmark Section ${sectionIdx}`,
      props: { title: `Section ${sectionIdx}` },
      style: {
        geometry: {
          padding: { top: 32, right: 24, bottom: 32, left: 24, unit: "px" },
        },
      },
      children: containerChildren,
    });

    sectionIdx += 1;
  }

  return {
    id: `doc-benchmark-${targetNodeCount}`,
    pageId: "page-benchmark",
    pageType: "custom",
    slug: "benchmark",
    schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
    name: `Synthetic Benchmark Document (${created} nodes)`,
    metadata: {
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    },
    root: rootSections,
  };
}
