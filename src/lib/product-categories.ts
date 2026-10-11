/** Keep older products compatible while preserving the selected category order. */
export function productCategoryIds(product: {
  category_ids?: string[] | null;
  category_id?: string | null;
}): string[] {
  return [
    ...new Set(
      product.category_ids?.length
        ? product.category_ids
        : product.category_id
          ? [product.category_id]
          : [],
    ),
  ];
}
