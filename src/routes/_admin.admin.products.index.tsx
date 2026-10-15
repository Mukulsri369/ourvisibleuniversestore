import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Flame, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminTitle, inputCls, StatusBadge, Thumb } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCategoriesQuery,
  adminProductsQuery,
  firstImage,
  type AdminRow,
} from "@/lib/admin-queries";
import { formatPrice, isValidAffiliateUrl } from "@/lib/store";
import { productSaveErrorMessage } from "@/lib/product-errors";

export const Route = createFileRoute("/_admin/admin/products/")({
  head: () => ({
    meta: [
      { title: "Products | OVU Admin" },
      { name: "description", content: "Administrator products for Our Visible Universe Store." },
      { property: "og:title", content: "Products | OVU Admin" },
      {
        property: "og:description",
        content: "Administrator products for Our Visible Universe Store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Products,
});

function formatRelativePriceTime(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffHours = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function Products() {
  const qc = useQueryClient();
  const [f, setF] = useState({ q: "", category: "", status: "", featured: "", page: 1 });
  const { data, isLoading, isError } = useQuery(adminProductsQuery(f));
  const { data: cats = [] } = useQuery(adminCategoriesQuery);
  const [del, setDel] = useState<AdminRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p, page: p.page ?? 1 }));
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  async function handleUpdateSinglePrice(r: AdminRow) {
    const targetUrl = r.affiliate_url || r.amazon_url;
    if (!targetUrl) {
      toast.error("Product has no affiliate URL or product link to check.");
      return;
    }
    setUpdatingId(r.id);
    try {
      const res = await fetch("/api/admin/check-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, productId: r.id }),
      });
      let result: {
        success?: boolean;
        price?: number;
        currency?: string;
        inStock?: boolean;
        stockMessage?: string;
        title?: string;
        retailer?: string;
        retailer_product_id?: string;
        error?: string;
      } | null = null;
      try {
        const text = await res.text();
        result = JSON.parse(text);
      } catch {
        toast.error("Unable to check price: Retailer returned non-JSON response.");
        return;
      }

      // Check if product is out of stock on retailer site
      if (res.ok && result?.success && result?.inStock === false) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("products")
          .update({
            active: false,
            updated_at: nowIso,
            ...(result.retailer ? { retailer: result.retailer } : {}),
            ...(result.retailer_product_id
              ? {
                  retailer_product_id: result.retailer_product_id,
                  ...(result.retailer === "Amazon"
                    ? { amazon_asin: result.retailer_product_id }
                    : {}),
                }
              : {}),
            ...(result.price != null
              ? {
                  price: result.price,
                  currency: result.currency || "INR",
                  price_updated_at: nowIso,
                }
              : {}),
          })
          .eq("id", r.id);

        if (error) {
          toast.error(`Out of stock detected but failed to deactivate: ${error.message}`);
        } else {
          toast.warning(
            `⚠️ "${r.name.slice(0, 32)}…" is Out of Stock on retailer site. Product has been automatically deactivated to prevent dead clicks.`,
            { duration: 6000 },
          );
          refresh();
        }
        return;
      }

      if (!res.ok || !result?.success || result?.price == null) {
        toast.warning(result?.error || "Could not detect active price on retailer page.");
        return;
      }

      const newPrice = result.price;
      const newCurrency = result.currency || "INR";
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("products")
        .update({
          price: newPrice,
          currency: newCurrency,
          price_updated_at: nowIso,
          updated_at: nowIso,
          ...(result.retailer ? { retailer: result.retailer } : {}),
          ...(result.retailer_product_id
            ? {
                retailer_product_id: result.retailer_product_id,
                ...(result.retailer === "Amazon"
                  ? { amazon_asin: result.retailer_product_id }
                  : {}),
              }
            : {}),
        })
        .eq("id", r.id);

      if (error) {
        toast.error(
          `Price found (${formatPrice(newPrice, newCurrency)}) but failed to save: ${error.message}`,
        );
        return;
      }

      if (r.price != null && r.price !== newPrice) {
        toast.success(
          `✨ Price updated from ${formatPrice(r.price, r.currency)} to ${formatPrice(newPrice, newCurrency)} for "${r.name.slice(0, 32)}…"`,
        );
      } else if (r.price === newPrice) {
        toast.info(`Price verified: unchanged at ${formatPrice(newPrice, newCurrency)}.`);
      } else {
        toast.success(
          `✨ Price set to ${formatPrice(newPrice, newCurrency)} for "${r.name.slice(0, 32)}…"`,
        );
      }

      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update price.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleBatchUpdatePrices() {
    setIsBatchUpdating(true);
    try {
      const { data: prods, error } = await supabase
        .from("products")
        .select("id, name, affiliate_url, amazon_url, price, currency")
        .is("deleted_at", null);

      if (error || !prods) {
        toast.error(
          "Failed to load products for batch update: " + (error?.message || "Unknown error"),
        );
        return;
      }

      const eligible = prods.filter((p) => p.affiliate_url || p.amazon_url);
      if (!eligible.length) {
        toast.info("No products with affiliate links found to update.");
        return;
      }

      setBatchProgress({ current: 0, total: eligible.length });
      toast.loading(`Refreshing prices for ${eligible.length} products…`, {
        id: "batch-price-update",
      });

      let updatedCount = 0;
      let unchangedCount = 0;
      let deactivatedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < eligible.length; i++) {
        const p = eligible[i];
        setBatchProgress({ current: i + 1, total: eligible.length });
        const targetUrl = p.affiliate_url || p.amazon_url;
        try {
          const res = await fetch("/api/admin/check-price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: targetUrl, productId: p.id }),
          });
          let result: {
            success?: boolean;
            price?: number;
            currency?: string;
            inStock?: boolean;
            retailer?: string;
            retailer_product_id?: string;
            error?: string;
          } | null = null;
          try {
            const text = await res.text();
            result = JSON.parse(text);
          } catch {
            failedCount++;
            continue;
          }

          if (res.ok && result?.success) {
            const nowIso = new Date().toISOString();
            if (result.inStock === false) {
              // Automatically deactivate out-of-stock product
              deactivatedCount++;
              await supabase
                .from("products")
                .update({
                  active: false,
                  ...(result.price != null
                    ? {
                        price: result.price,
                        currency: result.currency || "INR",
                        price_updated_at: nowIso,
                      }
                    : {}),
                })
                .eq("id", p.id);
            } else if (result.price != null) {
              await supabase
                .from("products")
                .update({
                  price: result.price,
                  currency: result.currency || "INR",
                  price_updated_at: nowIso,
                  updated_at: nowIso,
                  ...(result.retailer ? { retailer: result.retailer } : {}),
                  ...(result.retailer_product_id
                    ? {
                        retailer_product_id: result.retailer_product_id,
                        ...(result.retailer === "Amazon"
                          ? { amazon_asin: result.retailer_product_id }
                          : {}),
                      }
                    : {}),
                })
                .eq("id", p.id);

              if (p.price != null && p.price !== result.price) {
                updatedCount++;
              } else {
                unchangedCount++;
              }
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      toast.success(
        `🎉 Batch update complete: ${updatedCount} updated, ${unchangedCount} verified${deactivatedCount > 0 ? `, ${deactivatedCount} out-of-stock deactivated` : ""}${failedCount > 0 ? `, ${failedCount} could not be detected` : ""}.`,
        { id: "batch-price-update", duration: 6000 },
      );
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch price refresh failed", {
        id: "batch-price-update",
      });
    } finally {
      setIsBatchUpdating(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  }

  async function toggleActive(r: AdminRow) {
    if (!r.active) {
      if (!r.affiliate_url || !isValidAffiliateUrl(r.affiliate_url)) {
        toast.error("Add a valid affiliate URL before activating.");
        return;
      }
      if (!firstImage(r)) {
        toast.error("Upload a primary image before activating.");
        return;
      }
    }
    const { error } = await supabase.from("products").update({ active: !r.active }).eq("id", r.id);
    if (error) {
      toast.error(productSaveErrorMessage(error));
      return;
    }
    toast.success(r.active ? "Product hidden from store." : "Product is live.");
    refresh();
  }

  async function softDelete() {
    if (!del) return;
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", del.id);
    setDel(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Moved to trash.");
    refresh();
  }

  const pages = data ? Math.ceil(data.total / data.size) : 1;

  return (
    <>
      <AdminTitle
        title="Products"
        sub={data ? `${data.total} products` : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBatchUpdating}
              onClick={handleBatchUpdatePrices}
              className="gap-1.5"
              title="Check live prices for all products with affiliate URLs"
            >
              {isBatchUpdating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  Refreshing ({batchProgress.current}/{batchProgress.total})
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" /> Refresh All Prices
                </>
              )}
            </Button>
            <Link
              to="/admin/festival"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Flame className="size-4 text-primary" /> Festival Special
            </Link>
            <Link
              to="/admin/products/trash"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Trash2 /> Trash
            </Link>
            <Link
              to="/admin/products/new"
              className={buttonVariants({ variant: "affiliate", size: "sm" })}
            >
              <Plus /> Add Product
            </Link>
          </div>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <input
          className={inputCls}
          placeholder="Search by name…"
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
        />
        <select
          className={inputCls}
          value={f.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={f.status}
          onChange={(e) => set({ status: e.target.value })}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive / Draft</option>
        </select>
        <select
          className={inputCls}
          value={f.featured}
          onChange={(e) => set({ featured: e.target.value })}
        >
          <option value="">Featured: any</option>
          <option value="yes">Featured</option>
          <option value="no">Not featured</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="p-6 text-sm text-destructive">Couldn't load products. Please refresh.</p>
        ) : !data?.rows.length ? (
          <p className="p-6 text-sm text-muted-foreground">No products match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Affiliate URL</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th>Added</th>
                  <th>Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Thumb src={firstImage(r)} />
                        <span className="max-w-56 truncate font-medium">{r.name}</span>
                      </div>
                    </td>
                    <td className="max-w-56 py-2 pr-3 text-muted-foreground">
                      {r.category_ids
                        .map((id) => cats.find((c) => c.id === id)?.name)
                        .filter(Boolean)
                        .join(", ") ||
                        r.categories?.name ||
                        "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-foreground">
                            {r.price != null ? (
                              formatPrice(r.price, r.currency || "INR")
                            ) : (
                              <span className="font-normal text-muted-foreground">—</span>
                            )}
                          </div>
                          {r.price_updated_at && (
                            <div
                              className="text-[10px] text-muted-foreground"
                              title={new Date(r.price_updated_at).toLocaleString()}
                            >
                              {formatRelativePriceTime(r.price_updated_at)}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          disabled={
                            updatingId === r.id ||
                            isBatchUpdating ||
                            (!r.affiliate_url && !r.amazon_url)
                          }
                          title={
                            r.affiliate_url || r.amazon_url
                              ? "Check and update latest price from retailer link"
                              : "No affiliate link set"
                          }
                          onClick={() => handleUpdateSinglePrice(r)}
                        >
                          {updatingId === r.id ? (
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        on={!!r.affiliate_url && isValidAffiliateUrl(r.affiliate_url)}
                        onLabel="Valid"
                        offLabel="Missing"
                      />
                    </td>
                    <td>
                      <button onClick={() => toggleActive(r)} title="Toggle active">
                        <StatusBadge on={r.active} onLabel="Active" offLabel="Inactive" />
                      </button>
                    </td>
                    <td>
                      <StatusBadge on={r.featured} onLabel="Featured" offLabel="—" tone="primary" />
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {r.active && (
                          <a
                            href={`/product/${r.slug}`}
                            target="_blank"
                            rel="noopener"
                            className={buttonVariants({ variant: "ghost", size: "icon" })}
                            aria-label="View"
                          >
                            <Eye />
                          </a>
                        )}
                        <Link
                          to="/admin/products/edit/$id"
                          params={{ id: r.id }}
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                          aria-label="Edit"
                        >
                          <Pencil />
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(r)}>
                          {r.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => setDel(r)}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={f.page <= 1}
            onClick={() => set({ page: f.page - 1 })}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {f.page} / {pages}
          </span>
          <Button
            variant="outline"
            disabled={f.page >= pages}
            onClick={() => set({ page: f.page + 1 })}
          >
            Next
          </Button>
        </div>
      )}

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this product will remove it from the public store. You can restore it from
              Trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={softDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
