import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/store/Pagination";
import { ProductBrowser, validateBrowseSearch } from "@/components/store/ProductBrowser";
import { AnimatedBlackHole } from "@/components/store/AnimatedBlackHole";
import { SpaceLaserLine } from "@/components/store/SpaceLaserLine";

const T = "Shop All Products | Our Visible Universe Store";
const D =
  "Browse every astronomy and space product in the Our Visible Universe collection — telescopes, décor, apparel and gifts.";

export const Route = createFileRoute("/_store/shop")({
  validateSearch: validateBrowseSearch,
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const search = Route.useSearch();
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ANIMATED BLACK HOLE IN BACKGROUND AT TOP */}
      <AnimatedBlackHole />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <PageHeader
          eyebrow="The full catalogue"
          title="All products"
          text="Every discovery in the Our Visible Universe collection."
        />
        <SpaceLaserLine
          label="GALACTIC INVENTORY"
          coordinates="RA 17h 45m 40s · DEC -29° 00′ 28″ · SAGITTARIUS A*"
          className="my-6 sm:my-8"
        />
        <ProductBrowser search={search} to="/shop" />
      </div>
    </div>
  );
}
