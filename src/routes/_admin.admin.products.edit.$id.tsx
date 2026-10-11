import { createFileRoute } from "@tanstack/react-router";
import { AdminTitle } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export const Route = createFileRoute("/_admin/admin/products/edit/$id")({
  head: () => ({
    meta: [
      { title: "Edit Product | OVU Admin" },
      {
        name: "description",
        content: "Administrator edit product for Our Visible Universe Store.",
      },
      { property: "og:title", content: "Edit Product | OVU Admin" },
      {
        property: "og:description",
        content: "Administrator edit product for Our Visible Universe Store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Edit,
});

function Edit() {
  const { id } = Route.useParams();
  return (
    <>
      <AdminTitle title="Edit product" />
      <ProductForm key={id} productId={id} />
    </>
  );
}
