import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminTitle, inputCls, StatusBadge, Thumb } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import { adminCategoriesQuery, adminProductsQuery, firstImage, type AdminRow } from "@/lib/admin-queries";
import { isValidAmazonUrl } from "@/lib/store";

export const Route = createFileRoute("/_admin/admin/products/")({
  head: () => ({ meta: [{ title: "Products | OVU Admin" }] }),
  component: Products,
});

function Products() {
  const qc = useQueryClient();
  const [f, setF] = useState({ q: "", category: "", status: "", featured: "", page: 1 });
  const { data, isLoading, isError } = useQuery(adminProductsQuery(f));
  const { data: cats = [] } = useQuery(adminCategoriesQuery);
  const [del, setDel] = useState<AdminRow | null>(null);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p, page: p.page ?? 1 }));
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  async function toggleActive(r: AdminRow) {
    if (!r.active) {
      if (!r.amazon_url || !isValidAmazonUrl(r.amazon_url)) { toast.error("Add a valid Amazon affiliate URL before activating."); return; }
      if (!firstImage(r)) { toast.error("Upload a primary image before activating."); return; }
    }
    const { error } = await supabase.from("products").update({ active: !r.active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(r.active ? "Product hidden from store." : "Product is live.");
    refresh();
  }

  async function softDelete() {
    if (!del) return;
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", del.id);
    setDel(null);
    if (error) { toast.error(error.message); return; }
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
          <div className="flex gap-2">
            <Link to="/admin/products/trash" className={buttonVariants({ variant: "outline" })}><Trash2 /> Trash</Link>
            <Link to="/admin/products/new" className={buttonVariants({ variant: "amazon" })}><Plus /> Add Product</Link>
          </div>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <input className={inputCls} placeholder="Search by name…" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <select className={inputCls} value={f.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={inputCls} value={f.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive / Draft</option>
        </select>
        <select className={inputCls} value={f.featured} onChange={(e) => set({ featured: e.target.value })}>
          <option value="">Featured: any</option><option value="yes">Featured</option><option value="no">Not featured</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : isError ? <p className="p-6 text-sm text-destructive">Couldn't load products. Please refresh.</p> : data!.rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No products match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr><th className="p-3">Product</th><th>Category</th><th>Amazon URL</th><th>Status</th><th>Featured</th><th>Added</th><th>Updated</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3"><div className="flex items-center gap-3"><Thumb src={firstImage(r)} /><span className="max-w-56 truncate font-medium">{r.name}</span></div></td>
                    <td className="text-muted-foreground">{r.categories?.name ?? "—"}</td>
                    <td><StatusBadge on={!!r.amazon_url && isValidAmazonUrl(r.amazon_url)} onLabel="Valid" offLabel="Missing" /></td>
                    <td><button onClick={() => toggleActive(r)} title="Toggle active"><StatusBadge on={r.active} onLabel="Active" offLabel="Inactive" /></button></td>
                    <td><StatusBadge on={r.featured} onLabel="Featured" offLabel="—" tone="primary" /></td>
                    <td className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {r.active && <a href={`/product/${r.slug}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="View"><Eye /></a>}
                        <Link to="/admin/products/edit/$id" params={{ id: r.id }} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Edit"><Pencil /></Link>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(r)}>{r.active ? "Deactivate" : "Activate"}</Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDel(r)}><Trash2 className="text-destructive" /></Button>
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
          <Button variant="outline" disabled={f.page <= 1} onClick={() => set({ page: f.page - 1 })}>Previous</Button>
          <span className="text-xs text-muted-foreground">{f.page} / {pages}</span>
          <Button variant="outline" disabled={f.page >= pages} onClick={() => set({ page: f.page + 1 })}>Next</Button>
        </div>
      )}

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>Deleting this product will remove it from the public store. You can restore it from Trash.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={softDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Product</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
