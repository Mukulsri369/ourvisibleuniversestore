import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminTitle, Thumb } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import { removeStoragePaths } from "@/lib/admin";
import { ADMIN_SELECT, firstImage, type AdminRow } from "@/lib/admin-queries";
import { productSaveErrorMessage } from "@/lib/product-errors";

export const Route = createFileRoute("/_admin/admin/products/trash")({
  head: () => ({ meta: [
    { title: "Trash | OVU Admin" },
    { name: "description", content: "Administrator trash for Our Visible Universe Store." },
    { property: "og:title", content: "Trash | OVU Admin" },
    { property: "og:description", content: "Administrator trash for Our Visible Universe Store." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Trash,
});

function Trash() {
  const qc = useQueryClient();
  const [purge, setPurge] = useState<AdminRow | null>(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "trash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(ADMIN_SELECT).not("deleted_at", "is", null).order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminRow[];
    },
  });

  async function restore(r: AdminRow) {
    const { error } = await supabase.from("products").update({ deleted_at: null }).eq("id", r.id);
    if (error) { toast.error(productSaveErrorMessage(error)); return; }
    toast.success("Product restored.");
    qc.invalidateQueries();
  }

  async function destroy() {
    if (!purge) return;
    const { data: imgs } = await supabase.from("product_images").select("storage_path").eq("product_id", purge.id);
    const { error } = await supabase.from("products").delete().eq("id", purge.id);
    setPurge(null);
    if (error) { toast.error(error.message); return; }
    await removeStoragePaths((imgs ?? []).map((i) => i.storage_path));
    toast.success("Product permanently deleted.");
    qc.invalidateQueries();
  }

  return (
    <>
      <AdminTitle title="Trash" sub="Deleted products never appear on the store." action={<Link to="/admin/products" className={buttonVariants({ variant: "outline" })}>Back to Products</Link>} />
      <div className="rounded-2xl border border-border bg-card/60">
        {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Trash is empty.</p> : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <Thumb src={firstImage(r)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">Deleted {r.deleted_at && new Date(r.deleted_at).toLocaleString()}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restore(r)}><RotateCcw /> Restore</Button>
                <Button variant="ghost" size="sm" onClick={() => setPurge(r)} className="text-destructive"><Trash2 /> Delete permanently</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AlertDialog open={!!purge} onOpenChange={(o) => !o && setPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this product?</AlertDialogTitle>
            <AlertDialogDescription>This removes the product and its images forever. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={destroy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
