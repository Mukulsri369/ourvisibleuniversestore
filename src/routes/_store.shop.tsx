import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/store/Pagination";
import { ProductBrowser, validateBrowseSearch } from "@/components/store/ProductBrowser";

const T = "Shop All Products | Our Visible Universe Store";
const D = "Browse every astronomy and space product in the Our Visible Universe collection — telescopes, décor, apparel and gifts.";

export const Route = createFileRoute("/_store/shop")({
  validateSearch: validateBrowseSearch,
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
    ],
  }),
  component: Shop,
});

function Shop() {
  const search = Route.useSearch();
  return (
    <>
      <PageHeader eyebrow="The full catalogue" title="All products" text="Every discovery in the Our Visible Universe collection." />
      <ProductBrowser search={search} to="/shop" />
    </>
  );
}
