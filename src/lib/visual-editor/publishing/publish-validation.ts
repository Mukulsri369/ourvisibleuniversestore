import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import type { StorePageType } from "../persistence/persistence-types";
import { PersistenceError } from "../persistence/persistence-errors";
import {
  validateDocumentForPersistence,
  type ValidatedPersistenceDocument,
} from "../persistence/persistence-validation";

/**
 * Validates a PageDocument at the trusted publishing boundary before allowing
 * a draft or restored version to become the live storefront page.
 *
 * In addition to full schema, size, registry, and business-data validation,
 * enforces completeness rules so an empty or all-hidden document cannot replace
 * the live storefront.
 */
export function validateDocumentForPublishing(
  candidate: unknown,
  pageType: StorePageType = "home",
  registry: VisualComponentRegistry = defaultComponentRegistry,
): ValidatedPersistenceDocument {
  const validated = validateDocumentForPersistence(candidate, registry);
  const { document } = validated;

  if (document.root.length === 0) {
    throw new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: "Cannot publish an empty page document with zero root sections.",
    });
  }

  const visibleRootNodes = document.root.filter((node) => !node.hidden);

  if (visibleRootNodes.length === 0) {
    throw new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: "Cannot publish a page where all root sections are hidden.",
    });
  }

  if (pageType === "home") {
    const hasInteractiveOrContentSection = visibleRootNodes.some(
      (node) =>
        node.type !== "CelestialScrollWorld" && node.type !== "Spacer" && node.type !== "Divider",
    );
    if (!hasInteractiveOrContentSection) {
      throw new PersistenceError({
        code: "VALIDATION_FAILED",
        publicMessage:
          "Cannot publish a homepage draft that lacks visible hero or storefront content sections.",
      });
    }
  }

  return validated;
}
