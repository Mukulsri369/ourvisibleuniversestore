import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AdminTitle, Field, inputCls, textareaCls } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import { pathFromUrl, removeStoragePaths, uploadImage } from "@/lib/admin";
import { adminCategoriesQuery } from "@/lib/admin-queries";
import { slugify, type Category } from "@/lib/store";

export const Route = createFileRoute("/_admin/admin/categories")({
  head: () => ({ meta: [
    { title: "Categories | OVU Admin" },
    { name: "description", content: "Administrator categories for Our Visible Universe Store." },
    { property: "og:title", content: "Categories | OVU Admin" },
    { property: "og:description", content: "Administrator categories for Our Visible Universe Store." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Categories,
});

const blank = { id: "", name: "", slug: "", description: "", image_url: "", active: true, sort_order: 0 };

function Categories() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery(adminCategoriesQuery);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function edit(c?: Category) {
    setForm(c ? { id: c.id, name: c.name, slug: c.slug, description: c.description ?? "", image_url: c.image_url ?? "", active: c.active, sort_order: c.sort_order } : blank);
    setOpen(true);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadImage(file, "categories");
      const old = pathFromUrl(form.image_url);
      setForm((f) => ({ ...f, image_url: r.url }));
      if (old) await removeStoragePaths([old]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), slug: slugify(form.slug || form.name), description: form.description.trim() || null, image_url: form.image_url || null, active: form.active, sort_order: form.sort_order };
    const result = form.id ? await supabase.from("categories").update(payload).eq("id", form.id) : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success(form.id ? "Category updated." : "Category added.");
    setOpen(false);
    qc.invalidateQueries();
  }

  async function toggle(c: Category) {
    const { error } = await supabase.from("categories").update({ active: !c.active }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
  }

  async function remove(c: Category) {
    if (!window.confirm(`Delete “${c.name}”? Products in it will become uncategorised.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await removeStoragePaths([pathFromUrl(c.image_url)]);
    toast.success("Category deleted.");
    qc.invalidateQueries();
  }

  return (
    <>
      <AdminTitle title="Categories" sub="Categories automatically appear in the product form." action={<Button variant="affiliate" onClick={() => edit()}><Plus /> Add Category</Button>} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                {c.image_url ? <img src={c.image_url} alt="" loading="lazy" className="size-14 rounded-lg object-cover" /> : <div className="nebula starfield size-14 rounded-lg" />}
                <div className="min-w-0 flex-1"><p className="font-medium">{c.name}</p><p className="line-clamp-1 text-xs text-muted-foreground">{c.description || "No description"}</p></div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={c.active} onCheckedChange={() => toggle(c)} /> {c.active ? "Active" : "Inactive"}</label>
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => edit(c)}><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(c)}><Trash2 className="text-destructive" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-background">
          <DialogTitle>{form.id ? "Edit category" : "Add category"}</DialogTitle>
          <form onSubmit={save} className="space-y-4">
            <Field label="Category name" required><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.id ? f.slug : slugify(e.target.value) }))} /></Field>
            <Field label="Slug"><input className={inputCls} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} /></Field>
            <Field label="Description"><textarea rows={3} className={textareaCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            <div>
              {form.image_url && <img src={form.image_url} alt="" className="mb-2 aspect-[2/1] w-full rounded-xl object-cover" />}
              <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}><ImagePlus /> {uploading ? "Uploading…" : "Upload category image"}</Button>
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            <label className="flex items-center justify-between"><span className="text-sm">Active</span><Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} /></label>
            <Button type="submit" variant="affiliate" className="w-full" disabled={saving}>{saving ? "Saving…" : "Save category"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}