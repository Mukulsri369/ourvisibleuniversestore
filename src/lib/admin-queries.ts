import { listStoreAdminProducts } from "./store-api.functions";
import { storeAdminCategories, storeDuplicateCatalog } from "./store-api.functions";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
  affiliate_url: string | null;
  amazon_url?: string | null;
  category_ids: string[];
  price: number | null;
  currency: string | null;
  price_updated_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  categories: { name: string } | null;
  product_images: { image_url: string; sort_order: number }[];
};

export const ADMIN_SELECT =
  "id,name,slug,active,featured,affiliate_url,amazon_url,category_ids,price,currency,price_updated_at,created_at,updated_at,deleted_at,categories(name),product_images(image_url,sort_order)";

export function firstImage(r: AdminRow) {
  return (
    [...(r.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url ?? null
  );
}

export const adminCategoriesQuery = queryOptions({
  queryKey: ["admin", "categories"],
  queryFn: () => storeAdminCategories(),
});

export type AdminFilters = {
  q: string;
  category: string;
  status: string;
  featured: string;
  page: number;
};

export const adminProductsQuery = (f: AdminFilters) =>
  queryOptions({
    queryKey: ["admin", "products", f],
    queryFn: () => listStoreAdminProducts({ data: f }),
  });

export const DUPLICATE_CATALOG_SELECT =
  "id,name,slug,short_description,description,active,featured,price,currency,retailer,affiliate_url,amazon_url,category_ids,categories(name),product_images(image_url,sort_order)";

export const adminDuplicateCatalogQuery = queryOptions({
  queryKey: ["admin", "duplicate-catalog"],
  queryFn: () => storeDuplicateCatalog(),
  staleTime: 1000 * 60 * 2, // 2 minutes cache
});
