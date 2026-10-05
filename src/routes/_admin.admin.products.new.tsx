import { createFileRoute } from "@tanstack/react-router";
import { AdminTitle } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export const Route = createFileRoute("/_admin/admin/products/new")({
  head: () => ({ meta: [{ title: "Add Product | OVU Admin" }] }),
  component: () => (
    <>
      <AdminTitle title="Add product" sub="Fill in the details, preview, then publish." />
      <ProductForm />
    </>
  ),
});
