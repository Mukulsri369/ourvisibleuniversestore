import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CategorySelect } from "@/components/admin/CategorySelect";
import { productCategoryIds } from "@/lib/product-categories";
import { listProducts, relatedQuery } from "@/lib/store";
import { storePublicCatalogue } from "@/lib/catalogue-api.functions";
vi.mock("@/lib/catalogue-api.functions", () => ({
  storePublicCatalogue: vi.fn(async () => ({ data: [], count: 0 })),
  storeOutboundClick: vi.fn(),
}));

describe("product category selection", () => {
  it("preserves existing products and selected order", () => {
    expect(productCategoryIds({ category_id: "old" })).toEqual(["old"]);
    expect(
      productCategoryIds({ category_ids: ["lights", "decor", "lights"], category_id: "old" }),
    ).toEqual(["lights", "decor"]);
    expect(productCategoryIds({ category_ids: [], category_id: null })).toEqual([]);
  });

  it("selects and removes categories independently", async () => {
    function Example() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <CategorySelect
          categories={[
            { id: "a", name: "Lights", active: true },
            { id: "b", name: "Showpieces", active: true },
          ]}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Select categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Lights" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Showpieces" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select categories" })).toHaveTextContent(
        "Lights, Showpieces",
      ),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Lights" }));
    expect(screen.getByRole("checkbox", { name: "Showpieces" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Select categories" })).toHaveTextContent(
      "Showpieces",
    );
  });
});

describe("category browsing", () => {
  it("filters and searches all memberships, not only the first", async () => {
    const spy = vi.mocked(storePublicCatalogue);
    spy.mockClear();
    try {
      await listProducts({ category: "lights", q: "Lights" });
      // The independent endpoint applies these filters to every membership in SQL.
      // Real MariaDB coverage verifies second-category matches and visibility rules.
      expect(spy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          categorySlugs: expect.arrayContaining(["lights", "cosmic-lighting"]),
          terms: ["lights"],
          limit: 200,
        }),
      });
      const related = relatedQuery({
        id: "product",
        category_id: "first",
        category_ids: ["first", "second"],
        tags: [],
      });
      await (related.queryFn as () => Promise<unknown>)();
      expect(spy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          categoryIds: ["first", "second"],
          excludeId: "product",
          limit: 4,
        }),
      });
    } finally {
      spy.mockClear();
    }
  });
});
