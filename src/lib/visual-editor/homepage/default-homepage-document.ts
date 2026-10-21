import { CURRENT_PAGE_SCHEMA_VERSION, type PageDocument } from "../schema/page-document";
import { safeParsePageDocument } from "../schema/validation";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";

export const CANONICAL_HOMEPAGE_DOCUMENT_ID = "doc-canonical-storefront-home-v1";
export const CANONICAL_HOMEPAGE_PAGE_ID = "page-storefront-home";

export const CANONICAL_HOMEPAGE_NODE_IDS = Object.freeze({
  celestialBackground: "home-celestial-scroll-world",
  planetHero: "home-planet-hero",
  festivalSection: "home-festival-special",
  featuredRail: "home-featured-products",
  newArrivalsRail: "home-new-arrivals",
  dynamicCategories: "home-dynamic-categories",
  interestSection: "home-explore-by-interest",
  benefitsSection: "home-why-shop-with-us",
  instagramSection: "home-instagram-promo",
} as const);

const CANONICAL_CREATED_AT = "2026-10-20T00:00:00.000Z";

/**
 * Canonical default `PageDocument` representing the real storefront homepage (`src/routes/_store.index.tsx`).
 *
 * Critical invariants:
 * - Zero hardcoded product or category records (all data is resolved via typed bindings from TanStack Query caches).
 * - Zero default inline style overrides (`style: {}`), ensuring `resolveNodeCssProperties` returns `undefined`
 *   and `AdapterBoundary` emits zero extra wrapper DOM nodes in `"public"` mode.
 * - Global `<StoreHeader />` and `<StoreFooter />` remain owned by `src/routes/_store.tsx`
 *   (`renderGlobalChromeInDocument: false` by default).
 */
export const DEFAULT_HOMEPAGE_PAGE_DOCUMENT: PageDocument = Object.freeze({
  id: CANONICAL_HOMEPAGE_DOCUMENT_ID,
  pageId: CANONICAL_HOMEPAGE_PAGE_ID,
  pageType: "home",
  slug: "home",
  schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
  name: "Our Visible Universe Store — Canonical Homepage",
  metadata: {
    createdAt: CANONICAL_CREATED_AT,
    updatedAt: CANONICAL_CREATED_AT,
    description:
      "Canonical configuration-driven storefront homepage preserving exact visual, responsive, animation, and data-binding parity.",
    baseRevision: 1,
  },
  settings: {
    celestialWorldEnabled: true,
    preserveCategoryOrder: true,
    containerMaxWidthPx: 1280,
  },
  root: [
    // 1. Global Celestial Scroll World (fixed background layer)
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
      type: "CelestialScrollWorld",
      name: "Celestial Scroll World",
      props: {},
      style: {},
      children: [],
    },
    // 2. Planet Hero (with relative z-10 wrapper matching _store.index.tsx)
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
      type: "PlanetHero",
      name: "Interactive Planet Hero",
      props: {
        scrollTargetId: "featured-products",
        customAttributes: {
          wrapRelativeZ10: true,
        },
      },
      style: {},
      children: [],
    },
    // 3. Festival Special (authoritative enabled/eyebrow/title/description from settings.social_links.festival_special)
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.festivalSection,
      type: "FestivalSection",
      name: "Festival Special Collection",
      props: {
        viewAllLabel: "Explore lights",
        viewAllHref: "/search",
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "festival",
        sortMode: "default_preserve_order",
        limit: 100,
      },
      children: [],
    },
    // 4. Featured Products Rail (#featured-products)
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      type: "FeaturedCollection",
      name: "Featured Products Rail",
      props: {
        title: "Featured",
        scrollTargetId: "featured-products",
        showViewAllLink: true,
        viewAllLabel: "View all",
        viewAllHref: "/search",
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "featured",
        sortMode: "default_preserve_order",
        limit: 100,
        hideWhenEmpty: true,
      },
      children: [],
    },
    // 5. New Arrivals Rail
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.newArrivalsRail,
      type: "ProductScrollRail",
      name: "New Arrivals Rail",
      props: {
        title: "New arrivals",
        variant: "default",
        showViewAllLink: true,
        viewAllLabel: "View all",
        viewAllHref: "/search",
        customAttributes: {
          wrapInStoreSection: true,
          linkSearchSort: "newest",
        },
      },
      style: {},
      binding: {
        kind: "product_collection",
        source: "new_arrivals",
        sortMode: "default_preserve_order",
        limit: 100,
        hideWhenEmpty: true,
      },
      children: [],
    },
    // 6. Dynamic Repeated Category Spotlight + Product Rail Sections with Progressive Loading
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
      type: "Section",
      name: "Dynamic Category Spotlights & Product Rails",
      props: {},
      style: {},
      binding: {
        kind: "repeated_category_sections",
        mode: "all_non_empty",
        respectDisplayOrder: true,
        maxCategories: 50,
        productsPerRail: 48,
        eagerLoadCount: 2,
        useSpotlightForFirstProduct: true,
        railSortMode: "default_preserve_order",
      },
      children: [],
    },
    // 7. Explore by Interest
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.interestSection,
      type: "InterestSection",
      name: "Explore by Interest",
      props: {
        title: "Explore by interest",
      },
      style: {},
      children: [],
    },
    // 8. Why Shop With Us
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection,
      type: "BenefitsSection",
      name: "Why Shop With Us",
      props: {
        title: "Why shop with us",
      },
      style: {},
      children: [],
    },
    // 9. Follow Our Journey (Instagram Promotional Section — uses settings.instagram_url)
    {
      id: CANONICAL_HOMEPAGE_NODE_IDS.instagramSection,
      type: "InstagramSection",
      name: "Instagram Community Banner",
      props: {
        title: "Follow our journey",
        description: "Daily space photography and new curated arrivals on Instagram.",
        label: "Follow on Instagram",
      },
      style: {},
      children: [],
    },
  ],
});

// Validate canonical document once at module initialization boundary (outside render hot paths)
const CANONICAL_VALIDATION = safeParsePageDocument(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
if (!CANONICAL_VALIDATION.success) {
  throw new Error(
    `Canonical DEFAULT_HOMEPAGE_PAGE_DOCUMENT failed schema validation: ${CANONICAL_VALIDATION.issues
      .map((i) => `${i.path}: ${i.message}`)
      .join("; ")}`,
  );
}

export function getCanonicalHomepageDocument(): PageDocument {
  return DEFAULT_HOMEPAGE_PAGE_DOCUMENT;
}

export function createDefaultHomepageDocument(): PageDocument {
  return structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
}

export interface ValidatedHomepageDocumentResult {
  readonly ok: boolean;
  readonly document: PageDocument;
  readonly usedFallback: boolean;
  readonly issues: readonly string[];
}

/**
 * Validates a candidate `PageDocument` at the document boundary (never inside hot loops or per-card renders).
 * - Fast-paths the canonical frozen `DEFAULT_HOMEPAGE_PAGE_DOCUMENT` in `O(1)` reference time.
 * - Validates custom documents against both `PageDocumentSchema` and `VisualComponentRegistry`.
 * - Falls back safely to `DEFAULT_HOMEPAGE_PAGE_DOCUMENT` if validation fails.
 */
export function resolveValidatedHomepageDocument(
  candidate?: PageDocument | unknown | null,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): ValidatedHomepageDocumentResult {
  if (!candidate || candidate === DEFAULT_HOMEPAGE_PAGE_DOCUMENT) {
    return {
      ok: true,
      document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      usedFallback: false,
      issues: [],
    };
  }

  const parsed = safeParsePageDocument(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      usedFallback: true,
      issues: parsed.issues.map((i) => `${i.path}: ${i.message}`),
    };
  }

  // Verify all root and nested nodes are registered in the active component registry
  const registryIssues: string[] = [];
  const checkNode = (node: PageDocument["root"][number], depth: number) => {
    const res = registry.validateNodeConfiguration(node, { isRootLevel: depth === 0 });
    if (!res.valid) {
      for (const errMsg of res.errors) {
        registryIssues.push(`${node.id}: ${errMsg}`);
      }
    }
    for (const child of node.children) {
      checkNode(child, depth + 1);
    }
  };

  for (const rootNode of parsed.data.root) {
    checkNode(rootNode, 0);
  }

  if (registryIssues.length > 0) {
    return {
      ok: false,
      document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      usedFallback: true,
      issues: registryIssues,
    };
  }

  return {
    ok: true,
    document: parsed.data,
    usedFallback: false,
    issues: [],
  };
}
