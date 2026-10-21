export const GLOBAL_CHROME_HEADER_ID = "global-chrome::store-header";
export const GLOBAL_CHROME_FOOTER_ID = "global-chrome::store-footer";
export const VIRTUAL_CATEGORY_DELIMITER = "::category::";
export const VIRTUAL_PRODUCT_DELIMITER = "::product::";
export const VIRTUAL_CATEGORY_CARD_DELIMITER = "::category-card::";

export type StudioNodeIdentityKind =
  | "document_node"
  | "virtual_category"
  | "virtual_product"
  | "virtual_category_card"
  | "global_chrome";

/**
 * Distinguishes definition identity (`documentNodeId` in `PageDocument`) from
 * runtime instance identity (`virtualCategoryId` or `virtualProductId`)
 * (Prompt 10, Part 6, Sections 15–17).
 */
export interface ParsedStudioNodeIdentity {
  readonly rawId: string;
  readonly kind: StudioNodeIdentityKind;
  readonly documentNodeId: string | null;
  readonly isRuntimeInstance: boolean;
  readonly virtualCategoryId?: string;
  readonly virtualProductId?: string;
  readonly globalChromeType?: "StoreHeader" | "StoreFooter";
}

export function buildVirtualCategoryNodeId(parentSectionId: string, categoryId: string): string {
  return `${parentSectionId}${VIRTUAL_CATEGORY_DELIMITER}${categoryId}`;
}

export function buildVirtualProductInstanceId(parentNodeId: string, productId: string): string {
  return `${parentNodeId}${VIRTUAL_PRODUCT_DELIMITER}${productId}`;
}

export function buildVirtualCategoryCardInstanceId(
  parentNodeId: string,
  categoryId: string,
): string {
  return `${parentNodeId}${VIRTUAL_CATEGORY_CARD_DELIMITER}${categoryId}`;
}

/**
 * Parses any studio selection or hover target ID into its underlying definition node ID
 * and runtime instance metadata in O(1) time.
 */
export function parseStudioNodeIdentity(
  nodeId: string | null | undefined,
): ParsedStudioNodeIdentity | null {
  if (!nodeId || typeof nodeId !== "string") return null;
  const trimmed = nodeId.trim();
  if (!trimmed) return null;

  if (trimmed === GLOBAL_CHROME_HEADER_ID) {
    return {
      rawId: trimmed,
      kind: "global_chrome",
      documentNodeId: null,
      isRuntimeInstance: false,
      globalChromeType: "StoreHeader",
    };
  }

  if (trimmed === GLOBAL_CHROME_FOOTER_ID) {
    return {
      rawId: trimmed,
      kind: "global_chrome",
      documentNodeId: null,
      isRuntimeInstance: false,
      globalChromeType: "StoreFooter",
    };
  }

  // 1. Check product runtime instance (`<parentNodeId>::product::<productId>`)
  const productDelimiterIndex = trimmed.indexOf(VIRTUAL_PRODUCT_DELIMITER);
  if (productDelimiterIndex > 0) {
    const parentPart = trimmed.slice(0, productDelimiterIndex);
    const virtualProductId = trimmed.slice(
      productDelimiterIndex + VIRTUAL_PRODUCT_DELIMITER.length,
    );
    if (parentPart && virtualProductId) {
      // If parentPart is itself a virtual category section (`home-dynamic-categories::category::cat-1`),
      // extract both the root documentNodeId and the enclosing virtualCategoryId!
      const nestedCatIndex = parentPart.indexOf(VIRTUAL_CATEGORY_DELIMITER);
      const documentNodeId = nestedCatIndex > 0 ? parentPart.slice(0, nestedCatIndex) : parentPart;
      const virtualCategoryId =
        nestedCatIndex > 0
          ? parentPart.slice(nestedCatIndex + VIRTUAL_CATEGORY_DELIMITER.length)
          : undefined;

      if (documentNodeId) {
        return {
          rawId: trimmed,
          kind: "virtual_product",
          documentNodeId,
          isRuntimeInstance: true,
          virtualProductId,
          ...(virtualCategoryId ? { virtualCategoryId } : {}),
        };
      }
    }
  }

  // 2. Check category card runtime instance (`<parentNodeId>::category-card::<categoryId>`)
  const categoryCardDelimiterIndex = trimmed.indexOf(VIRTUAL_CATEGORY_CARD_DELIMITER);
  if (categoryCardDelimiterIndex > 0) {
    const documentNodeId = trimmed.slice(0, categoryCardDelimiterIndex);
    const virtualCategoryId = trimmed.slice(
      categoryCardDelimiterIndex + VIRTUAL_CATEGORY_CARD_DELIMITER.length,
    );
    if (documentNodeId && virtualCategoryId) {
      return {
        rawId: trimmed,
        kind: "virtual_category_card",
        documentNodeId,
        isRuntimeInstance: true,
        virtualCategoryId,
      };
    }
  }

  // 3. Check dynamic repeated category section (`<parentNodeId>::category::<categoryId>`)
  const categoryDelimiterIndex = trimmed.indexOf(VIRTUAL_CATEGORY_DELIMITER);
  if (categoryDelimiterIndex > 0) {
    const documentNodeId = trimmed.slice(0, categoryDelimiterIndex);
    const virtualCategoryId = trimmed.slice(
      categoryDelimiterIndex + VIRTUAL_CATEGORY_DELIMITER.length,
    );
    if (documentNodeId && virtualCategoryId) {
      return {
        rawId: trimmed,
        kind: "virtual_category",
        documentNodeId,
        isRuntimeInstance: true,
        virtualCategoryId,
      };
    }
  }

  return {
    rawId: trimmed,
    kind: "document_node",
    documentNodeId: trimmed,
    isRuntimeInstance: false,
  };
}
