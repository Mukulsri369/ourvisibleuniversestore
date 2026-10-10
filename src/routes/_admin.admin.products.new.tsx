import { createFileRoute } from "@tanstack/react-router";
import { AdminTitle } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export const Route = createFileRoute("/_admin/admin/products/new")({
  head: () => ({ meta: [
    { title: "Add Product | OVU Admin" },
    { name: "description", content: "Administrator add product for Our Visible Universe Store." },
    { property: "og:title", content: "Add Product | OVU Admin" },
    { property: "og:description", content: "Administrator add product for Our Visible Universe Store." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <>
      <AdminTitle title="Add product" sub="Fill in the details, preview, then publish." />
      <ProductForm />
    </>
  ),
});
