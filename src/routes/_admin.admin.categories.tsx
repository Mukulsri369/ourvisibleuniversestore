import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AdminTitle, Field, inputCls, textareaCls } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import { pathFromUrl, removeStoragePaths, uploadImage } from "@/lib/admin";
import { adminCategoriesQuery, adminDuplicateCatalogQuery } from "@/lib/admin-queries";
import { formatPrice, slugify, type Category } from "@/lib/store";
import {
  TARGET_9_TAXONOMY,
  runTaxonomyMigration,
  type MigrationStepProgress,
  type MigrationResult,
} from "@/lib/taxonomy-migration";

export const Route = createFileRoute("/_admin/admin/categories")({
  head: () => ({
    meta: [
      { title: "Categories | OVU Admin" },
      { name: "description", content: "Administrator categories for Our Visible Universe Store." },
      { property: "og:title", content: "Categories | OVU Admin" },
      {
        property: "og:description",
        content: "Administrator categories for Our Visible Universe Store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Categories,
});

const blank = {
  id: "",
  name: "",
  slug: "",
  description: "",
  image_url: "",
  active: true,
  sort_order: 0,
};

function Categories() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery(adminCategoriesQuery);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Taxonomy reorganization state
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationStepProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  async function executeTaxonomy() {
    setMigrationRunning(true);
    setMigrationResult(null);
    setMigrationProgress({
      step: "init",
      current: 5,
      total: 100,
      message: "Preparing 9-category taxonomy reorganization…",
    });
    try {
      const res = await runTaxonomyMigration(supabase, (p) => setMigrationProgress(p));
      setMigrationResult(res);
      toast.success("Catalog taxonomy successfully optimized to 9 clean categories!");
      await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      await qc.invalidateQueries({ queryKey: ["home"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["adminDuplicateCatalog"] });
    } catch (err) {
      console.error("Taxonomy migration failed:", err);
      toast.error(err instanceof Error ? err.message : "Taxonomy reorganization failed.");
    } finally {
      setMigrationRunning(false);
    }
  }

  // Spotlight showcase curation state
  const { data: siteSettings } = useQuery({
    queryKey: ["admin", "site-settings-spotlights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("social_links")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: allCatalogProducts = [] } = useQuery(adminDuplicateCatalogQuery);

  const [spotlightCategory, setSpotlightCategory] = useState<Category | null>(null);
  const [spotlightSearch, setSpotlightSearch] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [savingSpotlight, setSavingSpotlight] = useState(false);

  const socialLinks = (siteSettings?.social_links as Record<string, unknown> | null) || {};
  const currentSpotlights =
    (socialLinks.category_spotlights as Record<string, string> | undefined) || {};

  async function handleAssignSpotlight(categoryId: string, productId: string | null) {
    setSavingSpotlight(true);
    try {
      const updatedSpotlights = { ...currentSpotlights };
      if (productId) {
        updatedSpotlights[categoryId] = productId;
      } else {
        delete updatedSpotlights[categoryId];
      }

      const { error } = await supabase
        .from("site_settings")
        .update({
          social_links: {
            ...socialLinks,
            category_spotlights: updatedSpotlights,
          },
        })
        .eq("id", 1);

      if (error) throw error;

      toast.success(
        productId
          ? "Showcase display product updated for category."
          : "Reset to automatic showcase selection.",
      );
      await qc.invalidateQueries({ queryKey: ["admin", "site-settings-spotlights"] });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.invalidateQueries({ queryKey: ["home"] });
      setSpotlightCategory(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category showcase.");
    } finally {
      setSavingSpotlight(false);
    }
  }

  // Filter products belonging to the selected spotlightCategory
  const categoryProducts = useMemo(() => {
    if (!spotlightCategory) return [];
    if (showAllProducts) return allCatalogProducts;
    return allCatalogProducts.filter((p) => {
      const cids = p.category_ids?.length ? p.category_ids : [];
      return cids.includes(spotlightCategory.id);
    });
  }, [spotlightCategory, allCatalogProducts, showAllProducts]);

  const filteredSpotlightProducts = useMemo(() => {
    if (!spotlightSearch.trim()) return categoryProducts;
    const q = spotlightSearch.toLowerCase().trim();
    return categoryProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.short_description && p.short_description.toLowerCase().includes(q)),
    );
  }, [categoryProducts, spotlightSearch]);

  // Sync rows from query into local list when not dragging
  useEffect(() => {
    if (rows && draggedIndex === null && !isReordering) {
      setCategoriesList([...rows]);
    }
  }, [rows, draggedIndex, isReordering]);

  function edit(c?: Category) {
    setForm(
      c
        ? {
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description ?? "",
            image_url: c.image_url ?? "",
            active: c.active,
            sort_order: c.sort_order,
          }
        : {
            ...blank,
            sort_order: categoriesList.length,
          },
    );
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
    const payload = {
      name: form.name.trim(),
      slug: slugify(form.slug || form.name),
      description: form.description.trim() || null,
      image_url: form.image_url || null,
      active: form.active,
      sort_order: form.sort_order,
    };
    const result = form.id
      ? await supabase.from("categories").update(payload).eq("id", form.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(form.id ? "Category updated." : "Category added.");
    setOpen(false);
    qc.invalidateQueries();
  }

  async function toggle(c: Category) {
    const { error } = await supabase
      .from("categories")
      .update({ active: !c.active })
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries();
  }

  async function remove(c: Category) {
    if (!window.confirm(`Delete “${c.name}”? Products in it will become uncategorised.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await removeStoragePaths([pathFromUrl(c.image_url)]);
    toast.success("Category deleted.");
    qc.invalidateQueries();
  }

  async function persistOrder(updated: Category[]) {
    setIsReordering(true);
    try {
      // Assign sequential sort_order (0, 1, 2, ...)
      const promises = updated.map((cat, idx) =>
        supabase.from("categories").update({ sort_order: idx }).eq("id", cat.id),
      );
      const results = await Promise.all(promises);
      const err = results.find((r) => r.error);
      if (err?.error) {
        toast.error(`Order save failed: ${err.error.message}`);
        qc.invalidateQueries({ queryKey: ["admin", "categories"] });
        return;
      }
      toast.success("Category order updated on landing page.");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    } catch {
      toast.error("Failed to persist category order.");
    } finally {
      setIsReordering(false);
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLLIElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...categoriesList];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setCategoriesList(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);

    await persistOrder(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const moveCategory = async (fromIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (targetIndex < 0 || targetIndex >= categoriesList.length) return;

    const updated = [...categoriesList];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setCategoriesList(updated);
    await persistOrder(updated);
  };

  return (
    <>
      <AdminTitle
        title="Categories"
        sub="Drag and drop or use arrow buttons to arrange category sequence on the landing page."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isReordering && (
              <span className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                <Loader2 className="size-3.5 animate-spin" /> Saving order…
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
              onClick={() => {
                setMigrationResult(null);
                setShowTaxonomyModal(true);
              }}
            >
              <Sparkles className="size-4" /> 9-Category Restructuring
            </Button>
            <Button variant="affiliate" onClick={() => edit()}>
              <Plus /> Add Category
            </Button>
          </div>
        }
      />

      {/* TAXONOMY ARCHITECTURE RECOMMENDATION BANNER */}
      <div className="mb-6 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card/50 to-secondary/30 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Sparkles className="size-3.5" />
              </span>
              <h3 className="font-semibold text-sm sm:text-base text-foreground">
                Catalog Taxonomy Restructuring: 9 Balanced Categories
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Consolidate overlapping lights, lamps, art, and gadget categories into 9 clean,
              high-density categories with URL bookmark safety.
            </p>
            <div className="pt-1 flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-muted-foreground">
                Lights + Lamps + Projectors ➔ Cosmic Lighting (~67 items)
              </span>
              <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-muted-foreground">
                Space Art + Posters ➔ Wall Art (~72 items)
              </span>
              <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-muted-foreground">
                Mobile Accessories ➔ Tech (~16 items)
              </span>
              <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-muted-foreground">
                Astronomy Apparel ➔ Retired (0 items)
              </span>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              setMigrationResult(null);
              setShowTaxonomyModal(true);
            }}
            variant="outline"
            className="shrink-0 border-primary/50 text-foreground hover:bg-primary/20 gap-2"
          >
            <Layers className="size-4 text-primary" /> Review & Apply Taxonomy
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60 shadow-sm">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" /> Loading categories…
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {categoriesList.map((c, idx) => {
              const isBeingDragged = draggedIndex === idx;
              const isHoverTarget = dragOverIndex === idx && draggedIndex !== idx;
              const pinnedProductId = currentSpotlights[c.id];
              const pinnedProduct = pinnedProductId
                ? allCatalogProducts.find((p) => p.id === pinnedProductId)
                : null;

              return (
                <li
                  key={c.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex flex-wrap items-center gap-2.5 p-3 sm:gap-3 transition-colors ${
                    isBeingDragged
                      ? "opacity-40 bg-secondary/50"
                      : isHoverTarget
                        ? "bg-primary/10 border-t-2 border-primary"
                        : "hover:bg-secondary/30"
                  }`}
                >
                  {/* DRAG HANDLE */}
                  <div
                    className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none select-none rounded hover:bg-secondary"
                    title="Drag to reorder"
                  >
                    <GripVertical className="size-4.5" />
                  </div>

                  {/* ORDER BADGE */}
                  <div
                    className="flex h-6 min-w-6 items-center justify-center rounded bg-secondary px-1.5 font-mono text-[10px] font-semibold text-muted-foreground"
                    title={`Display Priority #${idx + 1}`}
                  >
                    #{idx + 1}
                  </div>

                  {/* CATEGORY IMAGE */}
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt=""
                      loading="lazy"
                      className="size-12 sm:size-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="nebula starfield size-12 sm:size-14 rounded-lg" />
                  )}

                  {/* DETAILS */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm sm:text-base text-foreground truncate">
                        {c.name}
                      </p>
                      {pinnedProduct ? (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20 max-w-[220px] truncate"
                          title={`Custom Showcase: ${pinnedProduct.name}`}
                        >
                          <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
                          <span className="truncate">{pinnedProduct.name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                          Auto Showcase
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {c.description || "No description"}
                    </p>
                  </div>

                  {/* SHOWCASE HERO SELECTOR */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-foreground/80 hover:text-foreground hover:border-primary/40 shrink-0"
                    onClick={() => {
                      setSpotlightCategory(c);
                      setSpotlightSearch("");
                      setShowAllProducts(false);
                    }}
                    title="Select landing page showcase product for this category"
                  >
                    <Star
                      className={`size-3.5 ${
                        pinnedProduct ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                      }`}
                    />
                    <span className="hidden md:inline">Showcase</span>
                  </Button>

                  {/* ACCESSIBLE REORDER ARROWS */}
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={idx === 0 || isReordering}
                      onClick={() => moveCategory(idx, "up")}
                      title="Move category up"
                      aria-label={`Move ${c.name} up`}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={idx === categoriesList.length - 1 || isReordering}
                      onClick={() => moveCategory(idx, "down")}
                      title="Move category down"
                      aria-label={`Move ${c.name} down`}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>

                  {/* ACTIVE TOGGLE */}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <Switch checked={c.active} onCheckedChange={() => toggle(c)} />{" "}
                    <span className="hidden sm:inline">{c.active ? "Active" : "Inactive"}</span>
                  </label>

                  {/* ACTIONS */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Edit"
                    onClick={() => edit(c)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Delete"
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-background">
          <DialogTitle>{form.id ? "Edit category" : "Add category"}</DialogTitle>
          <form onSubmit={save} className="space-y-4">
            <Field label="Category name" required>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: f.id ? f.slug : slugify(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Slug">
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                className={textareaCls}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <div>
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt=""
                  className="mb-2 aspect-[2/1] w-full rounded-xl object-cover"
                />
              )}
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus /> {uploading ? "Uploading…" : "Upload category image"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </div>
            <label className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </label>
            <Button type="submit" variant="affiliate" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save category"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* TAXONOMY REORGANIZATION DIALOG */}
      <Dialog open={showTaxonomyModal} onOpenChange={setShowTaxonomyModal}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-6 sm:p-7">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  9-Category Catalog Optimization
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Consolidate overlapping product types into a balanced 9-category store taxonomy.
                </p>
              </div>
            </div>

            {/* MIGRATION PROGRESS BANNER */}
            {migrationRunning && (
              <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 space-y-2.5 animate-pulse">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />{" "}
                    {migrationProgress?.message || "Restructuring…"}
                  </span>
                  <span>{migrationProgress?.current ?? 0}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${migrationProgress?.current ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* MIGRATION COMPLETION SUMMARY */}
            {migrationResult && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <span>Taxonomy Reorganization Completed Successfully!</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-background/50 p-2 border border-border/50">
                    <span className="block text-lg font-bold text-foreground">9</span>
                    <span className="text-[11px] text-muted-foreground">Target Categories</span>
                  </div>
                  <div className="rounded-lg bg-background/50 p-2 border border-border/50">
                    <span className="block text-lg font-bold text-emerald-400">
                      {migrationResult.productsReassigned}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Products Reassigned</span>
                  </div>
                  <div className="rounded-lg bg-background/50 p-2 border border-border/50">
                    <span className="block text-lg font-bold text-foreground">
                      {migrationResult.categoriesUpdated}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Categories Active</span>
                  </div>
                  <div className="rounded-lg bg-background/50 p-2 border border-border/50">
                    <span className="block text-lg font-bold text-foreground">
                      {migrationResult.categoriesDeactivated}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Legacy Deactivated</span>
                  </div>
                </div>

                {/* FINAL CATEGORY BREAKDOWN */}
                <div className="mt-3 divide-y divide-border/40 rounded-lg border border-border/40 bg-background/40">
                  {migrationResult.categorySummary.map((item) => (
                    <div
                      key={item.slug}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {item.productCount} products
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAXONOMY PREVIEW MATRIX */}
            {!migrationResult && (
              <>
                <div className="rounded-xl border border-border bg-card/60 p-3.5 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Info className="size-4 text-primary shrink-0" />
                    <span>How the 9-category restructuring works:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <strong>Zero Broken Links:</strong> Old category URLs (such as{" "}
                      <code className="text-primary font-mono text-[11px]">/category/lights</code>)
                      seamlessly resolve with backward compatibility.
                    </li>
                    <li>
                      <strong>Atomic Reassignment:</strong> Products in merged categories (like
                      Lamps, Projectors, and Posters) are cleanly re-tagged in the database.
                    </li>
                    <li>
                      <strong>Clean Storefront:</strong> The empty legacy category{" "}
                      <em>Astronomy Apparel</em> (0 items) is safely retired.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Proposed 9-Category Architecture
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                    {TARGET_9_TAXONOMY.map((cat, idx) => (
                      <div
                        key={cat.key}
                        className="rounded-xl border border-border bg-card/40 p-3 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="flex size-4.5 items-center justify-center rounded bg-secondary text-[10px] font-mono text-muted-foreground">
                              #{idx + 1}
                            </span>
                            {cat.name}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] line-clamp-2">
                          {cat.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 pt-1 text-[10px] font-mono">
                          <span className="text-primary font-sans font-medium">Slug:</span>
                          <span className="bg-secondary px-1.5 py-0.5 rounded text-foreground">
                            {cat.slug}
                          </span>
                          {cat.absorbedLegacySlugs.length > 0 && (
                            <span className="text-muted-foreground">
                              (Merges: {cat.absorbedLegacySlugs.join(", ")})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* MODAL ACTIONS */}
            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowTaxonomyModal(false)}
                disabled={migrationRunning}
              >
                {migrationResult ? "Close" : "Cancel"}
              </Button>
              {!migrationResult && (
                <Button
                  type="button"
                  variant="affiliate"
                  disabled={migrationRunning}
                  onClick={() => executeTaxonomy()}
                  className="gap-2"
                >
                  {migrationRunning ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Applying Taxonomy…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> Apply 9-Category Taxonomy
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CATEGORY SHOWCASE PRODUCT SELECTION MODAL */}
      <Dialog
        open={Boolean(spotlightCategory)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSpotlightCategory(null);
            setShowAllProducts(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-border">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Star className="size-5 fill-amber-400 text-amber-400" />
                <span>Showcase Product — {spotlightCategory?.name}</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Curate the prominent hero product displayed above this category rail on the landing
                page.
              </p>
            </div>
          </div>

          {/* SEARCH & FILTER CONTROLS */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={`Search ${showAllProducts ? "all catalog products" : `products in ${spotlightCategory?.name || ""}`}…`}
                  value={spotlightSearch}
                  onChange={(e) => setSpotlightSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* CURRENTLY PINNED / RESET BUTTON */}
              {spotlightCategory && currentSpotlights[spotlightCategory.id] && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingSpotlight}
                  onClick={() => handleAssignSpotlight(spotlightCategory.id, null)}
                  className="text-xs gap-1.5 border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/10 shrink-0"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset to Auto Fallback</span>
                </Button>
              )}
            </div>

            {/* AUTO FALLBACK EXPLANATION & SCOPE TOGGLE */}
            <div className="rounded-lg bg-secondary/40 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary shrink-0" />
                <span>
                  <strong>Smart Fallback:</strong> If no product is pinned, the category
                  automatically spotlights its top featured item, falling back to newest.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllProducts((prev) => !prev)}
                className="text-primary hover:underline font-medium text-right shrink-0"
              >
                {showAllProducts
                  ? `Show only ${spotlightCategory?.name} products`
                  : "Show all catalog products"}
              </button>
            </div>
          </div>

          {/* PRODUCT LIST */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[260px] max-h-[380px] divide-y divide-border/40 mt-1">
            {filteredSpotlightProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                <p>
                  No products found
                  {spotlightSearch ? ` matching “${spotlightSearch}”` : " in this category"}.
                </p>
                {!showAllProducts && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllProducts(true)}
                    className="text-xs"
                  >
                    Browse All Catalog Products
                  </Button>
                )}
              </div>
            ) : (
              filteredSpotlightProducts.map((p) => {
                const isSelected =
                  spotlightCategory && currentSpotlights[spotlightCategory.id] === p.id;
                const img = p.product_images?.[0]?.image_url;
                const formattedPrice = formatPrice(p.price ?? null, p.currency ?? null);

                return (
                  <div
                    key={p.id}
                    className={`pt-2.5 pb-2.5 px-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {img ? (
                        <img
                          src={img}
                          alt={p.name}
                          loading="lazy"
                          className="size-12 rounded-lg object-cover bg-secondary shrink-0"
                        />
                      ) : (
                        <div className="size-12 rounded-lg bg-secondary/80 flex items-center justify-center shrink-0">
                          <Sparkles className="size-4 text-muted-foreground" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {p.name}
                          </p>
                          {p.featured && (
                            <span className="shrink-0 text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-mono">
                              Featured
                            </span>
                          )}
                          {isSelected && (
                            <span className="shrink-0 text-[10px] bg-amber-500/20 text-amber-400 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Selected Showcase
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          {formattedPrice && (
                            <span className="font-mono font-medium text-foreground">
                              {formattedPrice}
                            </span>
                          )}
                          {p.short_description && (
                            <span className="truncate max-w-[320px] text-muted-foreground">
                              · {p.short_description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={savingSpotlight}
                          onClick={() => handleAssignSpotlight(spotlightCategory.id, null)}
                          className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove Pin
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="affiliate"
                          size="sm"
                          disabled={savingSpotlight}
                          onClick={() =>
                            spotlightCategory && handleAssignSpotlight(spotlightCategory.id, p.id)
                          }
                          className="h-8 text-xs gap-1"
                        >
                          <Star className="size-3 fill-current" />
                          <span>Set Showcase</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredSpotlightProducts.length} product
              {filteredSpotlightProducts.length === 1 ? "" : "s"} available
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSpotlightCategory(null);
                setShowAllProducts(false);
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
