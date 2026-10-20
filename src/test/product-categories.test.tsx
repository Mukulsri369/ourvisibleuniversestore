import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CategorySelect } from "@/components/admin/CategorySelect";
import { productCategoryIds } from "@/lib/product-categories";
import { listProducts, publicDb, relatedQuery } from "@/lib/store";

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
    const query: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "is",
      "order",
      "ilike",
      "limit",
      "neq",
      "overlaps",
      "contains",
      "or",
      "in",
    ])
      query[method] = vi.fn(() => query);
    query["maybeSingle"] = vi.fn(async () => ({ data: { id: "second" }, error: null }));
    query["range"] = vi.fn(async () => ({ data: [], count: 0, error: null }));
    query["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: "second" }], error: null }).then(resolve);
    const spy = vi
      .spyOn(publicDb(), "from")
      .mockReturnValue(query as unknown as ReturnType<ReturnType<typeof publicDb>["from"]>);
    try {
      await listProducts({ category: "lights", q: "Lights" });
      expect(query["overlaps"]).toHaveBeenCalledWith("category_ids", ["second"]);
      expect(query["or"]).toHaveBeenCalledWith(expect.stringContaining("category_ids.ov.{second}"));
      const related = relatedQuery({
        id: "product",
        category_id: "first",
        category_ids: ["first", "second"],
        tags: [],
      });
      await (related.queryFn as () => Promise<unknown>)();
      expect(query["overlaps"]).toHaveBeenCalledWith("category_ids", ["first", "second"]);
    } finally {
      spy.mockRestore();
    }
  });
});
