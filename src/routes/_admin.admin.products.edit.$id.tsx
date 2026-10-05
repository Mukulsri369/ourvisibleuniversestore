import { createFileRoute } from "@tanstack/react-router";
import { AdminTitle } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export const Route = createFileRoute("/_admin/admin/products/edit/$id")({
  head: () => ({ meta: [{ title: "Edit Product | OVU Admin" }] }),
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
