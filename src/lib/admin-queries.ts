import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
  affiliate_url: string | null;
  category_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  categories: { name: string } | null;
  product_images: { image_url: string; sort_order: number }[];
};

export const ADMIN_SELECT = "id,name,slug,active,featured,affiliate_url,category_ids,created_at,updated_at,deleted_at,categories(name),product_images(image_url,sort_order)";

export function firstImage(r: AdminRow) {
  return [...(r.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url ?? null;
}

export const adminCategoriesQuery = queryOptions({
  queryKey: ["admin", "categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export type AdminFilters = { q: string; category: string; status: string; featured: string; page: number };

export const adminProductsQuery = (f: AdminFilters) =>
  queryOptions({
    queryKey: ["admin", "products", f],
    queryFn: async () => {
      const size = 20;
      let q = supabase.from("products").select(ADMIN_SELECT, { count: "exact" }).is("deleted_at", null);
      if (f.q) q = q.ilike("name", `%${f.q.replace(/[%,()]/g, " ")}%`);
       if (f.category) q = q.contains("category_ids", [f.category]);
      if (f.status === "active") q = q.eq("active", true);
      if (f.status === "inactive") q = q.eq("active", false);
      if (f.featured === "yes") q = q.eq("featured", true);
      if (f.featured === "no") q = q.eq("featured", false);
      const from = (f.page - 1) * size;
      const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, from + size - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as AdminRow[], total: count ?? 0, size };
    },
  });
