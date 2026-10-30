import type { Category, HomeData, ProductCardData } from "@/lib/store";
import {
  buildSelectionBreadcrumbChain,
  buildVirtualCategoryCardInstanceId,
  buildVirtualCategoryNodeId,
  buildVirtualProductInstanceId,
  getDocumentNodeLookupIndex,
  GLOBAL_CHROME_FOOTER_ID,
  GLOBAL_CHROME_HEADER_ID,
  parseStudioNodeIdentity,
  resolveParentTargetId,
  VIRTUAL_CATEGORY_CARD_DELIMITER,
  VIRTUAL_CATEGORY_DELIMITER,
  VIRTUAL_PRODUCT_DELIMITER,
  type ParsedStudioNodeIdentity,
  type SelectionBreadcrumbEntry,
  type StudioNodeIdentityKind,
} from "../interactions/index";
import {
  defaultComponentRegistry,
  type RegisteredComponentDefinition,
  type TrustedComponentCapabilities,
  type VisualComponentRegistry,
} from "../registry/index";
import { resolveProductCollection } from "../rendering/data-resolver";
import type { StorefrontDataCatalog } from "../rendering/RenderContext";
import type { ComponentType, EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import { getLockedAncestorNode } from "../structure/structural-validation";

export {
  buildVirtualCategoryCardInstanceId,
  buildVirtualCategoryNodeId,
  buildVirtualProductInstanceId,
  GLOBAL_CHROME_FOOTER_ID,
  GLOBAL_CHROME_HEADER_ID,
  parseStudioNodeIdentity,
  VIRTUAL_CATEGORY_CARD_DELIMITER,
  VIRTUAL_CATEGORY_DELIMITER,
  VIRTUAL_PRODUCT_DELIMITER,
  type ParsedStudioNodeIdentity,
  type SelectionBreadcrumbEntry,
  type StudioNodeIdentityKind,
};

export interface StudioLayerTreeItem {
  readonly id: string;
  readonly kind: StudioNodeIdentityKind;
  readonly name: string;
  readonly componentType: ComponentType | "CategorySectionInstance";
  readonly displayName: string;
  readonly categoryGroup: string;
  readonly depth: number;
  readonly hidden: boolean;
  readonly locked: boolean;
  readonly isDirectlyLocked?: boolean;
  readonly isAncestorLocked?: boolean;
  readonly isGlobalChrome: boolean;
  readonly isGlobalBackground: boolean;
  readonly isVirtualInstance: boolean;
  readonly parentId: string | null;
  readonly virtualCategory?: Category;
  readonly virtualProduct?: ProductCardData;
  readonly slotName?: string;
  readonly children: readonly StudioLayerTreeItem[];
}

export interface ResolvedStudioSelection {
  readonly selectedId: string;
  readonly identity: ParsedStudioNodeIdentity;
  /**
   * The underlying `EditorNode` in `PageDocument` (or the parent template node
   * when a runtime product/category instance is selected, or a synthesized read-only node
   * for global route chrome).
   */
  readonly node: EditorNode;
  readonly definition: RegisteredComponentDefinition | undefined;
  readonly capabilities: TrustedComponentCapabilities | undefined;
  readonly virtualCategory: Category | null;
  readonly virtualProduct: ProductCardData | null;
  readonly isVirtualCategoryInstance: boolean;
  readonly isVirtualProductInstance: boolean;
  readonly isVirtualCategoryCardInstance: boolean;
  readonly isRuntimeInstance: boolean;
  readonly isGlobalRouteChrome: boolean;
  readonly isAncestorLocked?: boolean;
  readonly lockedByAncestorName?: string | null;
  readonly parentTargetId: string | null;
  readonly breadcrumbNames: readonly string[];
  readonly breadcrumbEntries: readonly SelectionBreadcrumbEntry[];
}

function mapEditorNodeToLayerTreeItem(
  node: EditorNode,
  depth: number,
  parentId: string | null,
  categories: readonly Category[],
  registry: VisualComponentRegistry,
  homeData?: HomeData,
  slotName?: string,
  ancestorLocked: boolean = false,
): StudioLayerTreeItem {
  const def = registry.getComponent(node.type);
  const cap = def?.capabilities;
  const isDirectlyLocked = Boolean(node.locked);
  const effectiveLocked = isDirectlyLocked || ancestorLocked;
  const childrenItems: StudioLayerTreeItem[] = [];

  // 1. Named slots children
  if (node.slots) {
    for (const [sName, slotNodes] of Object.entries(node.slots)) {
      for (const slotChild of slotNodes) {
        childrenItems.push(
          mapEditorNodeToLayerTreeItem(
            slotChild,
            depth + 1,
            node.id,
            categories,
            registry,
            homeData,
            sName,
            effectiveLocked,
          ),
        );
      }
    }
  }

  // 2. Standard children
  for (const child of node.children) {
    childrenItems.push(
      mapEditorNodeToLayerTreeItem(
        child,
        depth + 1,
        node.id,
        categories,
        registry,
        homeData,
        undefined,
        effectiveLocked,
      ),
    );
  }

  // 3. Dynamic repeated category instances (derived virtually from real categories, never stored as duplicate nodes)
  if (node.binding?.kind === "repeated_category_sections" && categories.length > 0) {
    const sortedCats = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const cat of sortedCats) {
      const catVirtualId = buildVirtualCategoryNodeId(node.id, cat.id);
      const catProductChildren: StudioLayerTreeItem[] = [];

      if (homeData?.allProducts && homeData.allProducts.length > 0) {
        const catProducts = homeData.allProducts.filter(
          (p) =>
            p.category_id === cat.id ||
            (Array.isArray(p.category_ids) && p.category_ids.includes(cat.id)),
        );
        for (const prod of catProducts) {
          catProductChildren.push({
            id: buildVirtualProductInstanceId(catVirtualId, prod.id),
            kind: "virtual_product",
            name: prod.name,
            componentType: "ProductCard",
            displayName: "Product Card Instance",
            categoryGroup: "storefront",
            depth: depth + 2,
            hidden: Boolean(node.hidden),
            locked: true,
            isGlobalChrome: false,
            isGlobalBackground: false,
            isVirtualInstance: true,
            parentId: catVirtualId,
            virtualCategory: cat,
            virtualProduct: prod,
            children: [],
          });
        }
      }

      childrenItems.push({
        id: catVirtualId,
        kind: "virtual_category",
        name: `${cat.name} Sector`,
        componentType: "CategorySectionInstance",
        displayName: "Dynamic Category Section",
        categoryGroup: "section",
        depth: depth + 1,
        hidden: Boolean(node.hidden),
        locked: true,
        isGlobalChrome: false,
        isGlobalBackground: false,
        isVirtualInstance: true,
        parentId: node.id,
        virtualCategory: cat,
        children: catProductChildren,
      });
    }
  }

  // 4. Product collection runtime instances (for FeaturedCollection, ProductScrollRail, ProductGridSection, FestivalSection)
  if (
    homeData &&
    (node.type === "FeaturedCollection" ||
      node.type === "ProductScrollRail" ||
      node.type === "ProductGrid" ||
      node.type === "FestivalSection")
  ) {
    const dataCatalog: StorefrontDataCatalog = {
      featuredProducts: homeData.featured,
      newestProducts: homeData.newest,
      festivalProducts: homeData.festival,
      allProducts: homeData.allProducts,
      categories,
      settings: null,
    };
    const collectionBinding =
      node.binding?.kind === "product_collection"
        ? node.binding
        : node.type === "FeaturedCollection"
          ? ({
              kind: "product_collection",
              source: "featured",
              sortMode: "default_preserve_order",
              limit: 100,
            } as const)
          : node.type === "FestivalSection"
            ? ({
                kind: "product_collection",
                source: "festival",
                sortMode: "default_preserve_order",
                limit: 100,
              } as const)
            : undefined;

    if (collectionBinding) {
      const items = resolveProductCollection(collectionBinding, dataCatalog);
      for (const prod of items) {
        childrenItems.push({
          id: buildVirtualProductInstanceId(node.id, prod.id),
          kind: "virtual_product",
          name: prod.name,
          componentType: "ProductCard",
          displayName: "Product Card Instance",
          categoryGroup: "storefront",
          depth: depth + 1,
          hidden: Boolean(node.hidden),
          locked: true,
          isGlobalChrome: false,
          isGlobalBackground: false,
          isVirtualInstance: true,
          parentId: node.id,
          virtualProduct: prod,
          children: [],
        });
      }
    }
  }

  // 5. CategoryGridSection runtime instances
  if (node.type === "CategoryGrid" && categories.length > 0) {
    const sortedCats = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const cat of sortedCats) {
      childrenItems.push({
        id: buildVirtualCategoryCardInstanceId(node.id, cat.id),
        kind: "virtual_category_card",
        name: `${cat.name} Card`,
        componentType: "CategoryCard",
        displayName: "Category Card Instance",
        categoryGroup: "storefront",
        depth: depth + 1,
        hidden: Boolean(node.hidden),
        locked: true,
        isGlobalChrome: false,
        isGlobalBackground: false,
        isVirtualInstance: true,
        parentId: node.id,
        virtualCategory: cat,
        children: [],
      });
    }
  }

  return {
    id: node.id,
    kind: "document_node",
    name: node.name || cap?.displayName || node.type,
    componentType: node.type,
    displayName: cap?.displayName ?? node.type,
    categoryGroup: cap?.category ?? "section",
    depth,
    hidden: Boolean(node.hidden),
    locked: effectiveLocked,
    isDirectlyLocked,
    isAncestorLocked: ancestorLocked,
    isGlobalChrome: Boolean(cap?.isGlobalChrome),
    isGlobalBackground: Boolean(cap?.isGlobalBackgroundLayer),
    isVirtualInstance: false,
    parentId,
    slotName,
    children: childrenItems,
  };
}

/**
 * Builds the navigable Layer Tree from the real `PageDocument`, including shared global
 * storefront chrome (`StoreHeader`, `StoreFooter`) and virtual dynamic category/product instances.
 */
export function buildStudioLayerTree(
  document: PageDocument,
  categories: readonly Category[] = [],
  registry: VisualComponentRegistry = defaultComponentRegistry,
  homeData?: HomeData,
): StudioLayerTreeItem[] {
  const items: StudioLayerTreeItem[] = [];

  const hasExplicitHeader = document.root.some((n) => n.type === "StoreHeader");
  const hasExplicitFooter = document.root.some((n) => n.type === "StoreFooter");

  if (!hasExplicitHeader) {
    const headerCap = registry.getTrustedCapabilities("StoreHeader");
    items.push({
      id: GLOBAL_CHROME_HEADER_ID,
      kind: "global_chrome",
      name: "Store Header (Global Route Chrome)",
      componentType: "StoreHeader",
      displayName: headerCap?.displayName ?? "Store Header",
      categoryGroup: "storefront",
      depth: 0,
      hidden: false,
      locked: true,
      isGlobalChrome: true,
      isGlobalBackground: false,
      isVirtualInstance: false,
      parentId: null,
      children: [],
    });
  }

  for (const rootNode of document.root) {
    items.push(mapEditorNodeToLayerTreeItem(rootNode, 0, null, categories, registry, homeData));
  }

  if (!hasExplicitFooter) {
    const footerCap = registry.getTrustedCapabilities("StoreFooter");
    items.push({
      id: GLOBAL_CHROME_FOOTER_ID,
      kind: "global_chrome",
      name: "Store Footer (Global Route Chrome)",
      componentType: "StoreFooter",
      displayName: footerCap?.displayName ?? "Store Footer",
      categoryGroup: "storefront",
      depth: 0,
      hidden: false,
      locked: true,
      isGlobalChrome: true,
      isGlobalBackground: false,
      isVirtualInstance: false,
      parentId: null,
      children: [],
    });
  }

  return items;
}

/**
 * Filters the layer tree by name, component type, or node ID while preserving parent hierarchy.
 */
export function filterStudioLayerTree(
  items: readonly StudioLayerTreeItem[],
  searchQuery: string,
): StudioLayerTreeItem[] {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return [...items];

  const filterItem = (item: StudioLayerTreeItem): StudioLayerTreeItem | null => {
    const matchesSelf =
      item.name.toLowerCase().includes(normalized) ||
      item.componentType.toLowerCase().includes(normalized) ||
      item.displayName.toLowerCase().includes(normalized) ||
      item.id.toLowerCase().includes(normalized) ||
      (item.virtualCategory?.slug.toLowerCase().includes(normalized) ?? false) ||
      (item.virtualProduct?.slug.toLowerCase().includes(normalized) ?? false);

    const filteredChildren: StudioLayerTreeItem[] = [];
    for (const child of item.children) {
      const matchedChild = filterItem(child);
      if (matchedChild) {
        filteredChildren.push(matchedChild);
      }
    }

    if (matchesSelf || filteredChildren.length > 0) {
      return {
        ...item,
        children: matchesSelf && filteredChildren.length === 0 ? item.children : filteredChildren,
      };
    }

    return null;
  };

  const results: StudioLayerTreeItem[] = [];
  for (const item of items) {
    const matched = filterItem(item);
    if (matched) results.push(matched);
  }
  return results;
}

/**
 * Returns all ancestor layer IDs that should be expanded in the Layer Tree when `targetId`
 * is selected (Prompt 10, Part 13, Section 37).
 */
export function getAncestorLayerIdsForTarget(
  document: PageDocument,
  targetId: string | null | undefined,
): string[] {
  const identity = parseStudioNodeIdentity(targetId);
  if (!identity || !identity.documentNodeId) return [];

  const index = getDocumentNodeLookupIndex(document);
  const docAncestors = [...(index.ancestorIdsById.get(identity.documentNodeId) ?? [])];

  if (identity.isRuntimeInstance) {
    docAncestors.push(identity.documentNodeId);
    if (identity.kind === "virtual_product" && identity.virtualCategoryId) {
      docAncestors.push(
        buildVirtualCategoryNodeId(identity.documentNodeId, identity.virtualCategoryId),
      );
    }
  }

  return docAncestors;
}

/**
 * Resolves the currently selected node ID (whether a real `EditorNode`, a virtual
 * repeated category instance, a rendered `ProductCard` / `CategoryCard` runtime instance,
 * or global route chrome) into full inspector and overlay context.
 */
export function resolveSelectedNodeContext(
  document: PageDocument,
  selectedId: string | null | undefined,
  categories: readonly Category[] = [],
  registry: VisualComponentRegistry = defaultComponentRegistry,
  products: readonly ProductCardData[] = [],
): ResolvedStudioSelection | null {
  const identity = parseStudioNodeIdentity(selectedId);
  if (!identity) return null;

  const breadcrumbEntries = buildSelectionBreadcrumbChain(
    document,
    selectedId,
    categories,
    products,
    registry,
  );
  const breadcrumbNames = breadcrumbEntries.map((entry) => entry.label);
  const parentTargetId = resolveParentTargetId(document, selectedId);

  if (identity.kind === "global_chrome" && identity.globalChromeType) {
    const def = registry.getComponent(identity.globalChromeType);
    const cap = def?.capabilities;
    const synthesizedNode: EditorNode = {
      id: identity.rawId,
      type: identity.globalChromeType,
      name:
        identity.globalChromeType === "StoreHeader"
          ? "Store Header (Global Route Chrome)"
          : "Store Footer (Global Route Chrome)",
      locked: true,
      props: {},
      style: {},
      children: [],
    };
    return {
      selectedId: identity.rawId,
      identity,
      node: synthesizedNode,
      definition: def,
      capabilities: cap,
      virtualCategory: null,
      virtualProduct: null,
      isVirtualCategoryInstance: false,
      isVirtualProductInstance: false,
      isVirtualCategoryCardInstance: false,
      isRuntimeInstance: false,
      isGlobalRouteChrome: true,
      parentTargetId,
      breadcrumbNames,
      breadcrumbEntries,
    };
  }

  if (!identity.documentNodeId) return null;
  const index = getDocumentNodeLookupIndex(document);
  const targetNode = index.nodeById.get(identity.documentNodeId);
  if (!targetNode) return null;

  const def = registry.getComponent(targetNode.type);
  const cap = def?.capabilities;

  const matchedCategory = identity.virtualCategoryId
    ? (categories.find((c) => c.id === identity.virtualCategoryId) ?? null)
    : null;

  const matchedProduct = identity.virtualProductId
    ? (products.find((p) => p.id === identity.virtualProductId) ?? null)
    : null;

  const lockedAncestor = getLockedAncestorNode(document, targetNode.id);

  return {
    selectedId: identity.rawId,
    identity,
    node: targetNode,
    definition: def,
    capabilities: cap,
    virtualCategory: matchedCategory,
    virtualProduct: matchedProduct,
    isVirtualCategoryInstance: identity.kind === "virtual_category",
    isVirtualProductInstance: identity.kind === "virtual_product",
    isVirtualCategoryCardInstance: identity.kind === "virtual_category_card",
    isRuntimeInstance: identity.isRuntimeInstance,
    isGlobalRouteChrome: false,
    isAncestorLocked: Boolean(lockedAncestor),
    lockedByAncestorName: lockedAncestor ? lockedAncestor.name || lockedAncestor.type : null,
    parentTargetId,
    breadcrumbNames,
    breadcrumbEntries,
  };
}

/**
 * Collects all layer IDs in the tree that currently have child layers (used for Expand All).
 */
export function getAllExpandableLayerIds(items: readonly StudioLayerTreeItem[]): string[] {
  const expandable: string[] = [];
  const visit = (item: StudioLayerTreeItem) => {
    if (item.children.length > 0) {
      expandable.push(item.id);
      for (const child of item.children) {
        visit(child);
      }
    }
  };
  for (const rootItem of items) {
    visit(rootItem);
  }
  return expandable;
}
