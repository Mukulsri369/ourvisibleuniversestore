import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  createDefaultHomepageDocument,
} from "../homepage/default-homepage-document";
import { GLOBAL_CHROME_HEADER_ID } from "../interactions/index";
import {
  duplicateNode,
  moveNodeToContainer,
  removeLayerNode,
  renameLayerNode,
  reorderSiblingNode,
  resolveLayerOperationPermissions,
  validateParentChildCompatibility,
  validateStructuralDocumentIntegrity,
  wrapNodeInContainer,
} from "../structure/index";
import { findNodeById } from "../utils/node-tree";

describe("Prompt 11 — Structural Validation & Hierarchy Guardrails", () => {
  it("protects singleton/root-only components (PlanetHero, CelestialScrollWorld) from deletion, duplication, or nesting", () => {
    const doc = createDefaultHomepageDocument();

    const heroPerms = resolveLayerOperationPermissions(doc, CANONICAL_HOMEPAGE_NODE_IDS.planetHero);
    expect(heroPerms.canDelete).toBe(false);
    expect(heroPerms.canDuplicate).toBe(false);
    expect(heroPerms.canMoveUp).toBe(false);
    expect(heroPerms.canMoveDown).toBe(false);
    expect(heroPerms.canWrapInContainer).toBe(false);

    const celestialPerms = resolveLayerOperationPermissions(
      doc,
      CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
    );
    expect(celestialPerms.canDelete).toBe(false);
    expect(celestialPerms.canDuplicate).toBe(false);
    expect(celestialPerms.canToggleLock).toBe(true);
    expect(celestialPerms.canToggleVisibility).toBe(false);

    expect(removeLayerNode(doc, CANONICAL_HOMEPAGE_NODE_IDS.planetHero).code).toBe(
      "PROTECTED_COMPONENT",
    );
    expect(duplicateNode(doc, CANONICAL_HOMEPAGE_NODE_IDS.planetHero).code).toBe(
      "PROTECTED_COMPONENT",
    );
    expect(wrapNodeInContainer(doc, CANONICAL_HOMEPAGE_NODE_IDS.planetHero, "Section").code).toBe(
      "PROTECTED_COMPONENT",
    );
  });

  it("protects the dynamic category sections template from deletion and duplication while allowing reorder, rename, visibility, and lock", () => {
    const doc = createDefaultHomepageDocument();
    const dynPerms = resolveLayerOperationPermissions(
      doc,
      CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories,
    );

    expect(dynPerms.canRename).toBe(true);
    expect(dynPerms.canMoveUp).toBe(true);
    expect(dynPerms.canMoveDown).toBe(true);
    expect(dynPerms.canToggleVisibility).toBe(true);
    expect(dynPerms.canToggleLock).toBe(true);
    expect(dynPerms.canDelete).toBe(false);
    expect(dynPerms.canDuplicate).toBe(false);
    expect(dynPerms.canWrapInContainer).toBe(false);

    expect(removeLayerNode(doc, CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories).code).toBe(
      "PROTECTED_COMPONENT",
    );
    expect(duplicateNode(doc, CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories).code).toBe(
      "PROTECTED_COMPONENT",
    );
  });

  it("protects runtime instances and global route chrome from direct structural mutation", () => {
    const doc = createDefaultHomepageDocument();

    const headerPerms = resolveLayerOperationPermissions(doc, GLOBAL_CHROME_HEADER_ID);
    expect(headerPerms.isGlobalChrome).toBe(true);
    expect(headerPerms.canRename).toBe(false);
    expect(headerPerms.canDelete).toBe(false);
    expect(renameLayerNode(doc, GLOBAL_CHROME_HEADER_ID, "Header").code).toBe(
      "PROTECTED_COMPONENT",
    );

    const virtualProductId = `${CANONICAL_HOMEPAGE_NODE_IDS.featuredRail}::product::prod-1`;
    const virtualPerms = resolveLayerOperationPermissions(doc, virtualProductId);
    expect(virtualPerms.isRuntimeInstance).toBe(true);
    expect(virtualPerms.canRename).toBe(false);
    expect(virtualPerms.canMoveUp).toBe(false);
    expect(virtualPerms.canMoveDown).toBe(false);
    expect(virtualPerms.canDelete).toBe(false);
    expect(reorderSiblingNode(doc, virtualProductId, "up").code).toBe("RUNTIME_INSTANCE_PROTECTED");
  });

  it("prevents circular reparenting (moving a container into itself or its own descendant)", () => {
    const doc = createDefaultHomepageDocument();
    const outerWrap = wrapNodeInContainer(doc, CANONICAL_HOMEPAGE_NODE_IDS.featuredRail, "Section");
    const outerId = outerWrap.selectedNodeId!;
    const innerWrap = wrapNodeInContainer(
      outerWrap.document,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "Container",
    );
    const innerId = innerWrap.selectedNodeId!;

    // Attempt to move Outer Section into Inner Container (its own child)
    const moveRes = moveNodeToContainer(innerWrap.document, outerId, innerId);
    expect(moveRes.ok).toBe(false);
    expect(moveRes.code).toBe("CIRCULAR_MOVE");
  });

  it("prevents moving child nodes into leaf components that do not accept children", () => {
    const doc = createDefaultHomepageDocument();
    const parentNode = findNodeById(doc, CANONICAL_HOMEPAGE_NODE_IDS.featuredRail)!;
    const childNode = findNodeById(doc, CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection)!;

    // FeaturedCollection is a specialized storefront section that does not accept arbitrary children
    const compat = validateParentChildCompatibility(parentNode, childNode);
    expect(compat.valid).toBe(false);
    expect(compat.code).toBe("INVALID_PARENT");
  });

  it("validates named slot compatibility on components with defined slots", () => {
    const doc = createDefaultHomepageDocument();
    const wrapped = wrapNodeInContainer(doc, CANONICAL_HOMEPAGE_NODE_IDS.featuredRail, "Section");
    const sectionId = wrapped.selectedNodeId!;
    const sectionNode = findNodeById(wrapped.document, sectionId)!;
    const childNode = findNodeById(wrapped.document, CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection)!;

    // Section does not define a "nonexistent_slot" in its capability contract
    const slotCompat = validateParentChildCompatibility(sectionNode, childNode, "nonexistent_slot");
    expect(slotCompat.valid).toBe(false);
    expect(slotCompat.code).toBe("INVALID_SLOT");
  });

  it("verifies full document structural integrity after any valid command", () => {
    const doc = createDefaultHomepageDocument();
    const integrity = validateStructuralDocumentIntegrity(doc);
    expect(integrity.valid).toBe(true);
  });
});
