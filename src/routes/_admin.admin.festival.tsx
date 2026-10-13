import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Check,
  ExternalLink,
  Flame,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AdminTitle,
  Field,
  inputCls,
  Section,
  StatusBadge,
  textareaCls,
  Thumb,
} from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_SELECT, adminCategoriesQuery, firstImage, type AdminRow } from "@/lib/admin-queries";
import { fetchAutoFestivalProductIds } from "@/lib/store";

export const Route = createFileRoute("/_admin/admin/festival")({
  head: () => ({
    meta: [
      { title: "Festival Special Section | OVU Admin" },
      { name: "description", content: "Curate and reorder products in Festival Special." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FestivalAdmin,
});

type FestivalMeta = {
  enabled: boolean;
  title: string;
  eyebrow: string;
  description: string;
};

const DEFAULT_META: FestivalMeta = {
  enabled: true,
  title: "Festival of Lights & Cosmic Glow",
  eyebrow: "Festival Special · Diwali",
  description:
    "Illuminate your home and celebrations with radiant galaxy night lights, illuminated planets, handcrafted cosmic lamps, and festive starry glow.",
};

function FestivalAdmin() {
  const qc = useQueryClient();

  // 1. Fetch site settings to retrieve existing festival configuration
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  // 2. Fetch categories for filtering the product picker
  const { data: categories = [] } = useQuery(adminCategoriesQuery);

  // 3. Fetch all active products so the admin can search and pick any product
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["admin", "all-products-for-festival"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(ADMIN_SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminRow[];
    },
  });

  // Curated list of product IDs in order
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [meta, setMeta] = useState<FestivalMeta>(DEFAULT_META);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);

  // Search & filter state for adding new products
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Track initial state to detect unsaved changes
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [initialMeta, setInitialMeta] = useState<FestivalMeta>(DEFAULT_META);

  // Initialize state once settings and products are loaded
  useEffect(() => {
    if (!settingsData || isInitialized) return;

    const social = (settingsData.social_links as Record<string, unknown> | null) || {};
    const festSpecial = (social.festival_special as Record<string, unknown> | undefined) || {};

    const configuredIds: string[] | null = Array.isArray(social.festival_product_ids)
      ? (social.festival_product_ids as string[])
      : Array.isArray(festSpecial.product_ids)
        ? (festSpecial.product_ids as string[])
        : null;

    const loadedMeta: FestivalMeta = {
      enabled: festSpecial.enabled !== false,
      title:
        typeof festSpecial.title === "string" && festSpecial.title
          ? festSpecial.title
          : DEFAULT_META.title,
      eyebrow:
        typeof festSpecial.eyebrow === "string" && festSpecial.eyebrow
          ? festSpecial.eyebrow
          : DEFAULT_META.eyebrow,
      description:
        typeof festSpecial.description === "string" && festSpecial.description
          ? festSpecial.description
          : DEFAULT_META.description,
    };

    setMeta(loadedMeta);
    setInitialMeta(loadedMeta);

    if (configuredIds !== null) {
      setSelectedIds(configuredIds);
      setInitialIds(configuredIds);
      setIsInitialized(true);
    } else {
      // Auto-populate from tags if never configured yet
      setIsAutoLoading(true);
      fetchAutoFestivalProductIds().then((autoIds) => {
        setSelectedIds(autoIds);
        setInitialIds(autoIds);
        setIsInitialized(true);
        setIsAutoLoading(false);
      });
    }
  }, [settingsData, isInitialized]);

  // Map of products by ID for fast lookup
  const productMap = useMemo(() => {
    const map = new Map<string, AdminRow>();
    for (const p of allProducts) {
      map.set(p.id, p);
    }
    return map;
  }, [allProducts]);

  // Current list of selected products in curated order
  const festivalProducts = useMemo(() => {
    return selectedIds.map((id) => productMap.get(id)).filter((p): p is AdminRow => Boolean(p));
  }, [selectedIds, productMap]);

  // Available products for the "Add Product" picker
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const candidateProducts = useMemo(() => {
    let list = allProducts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.categories?.name && p.categories.name.toLowerCase().includes(q)),
      );
    }
    if (categoryFilter) {
      list = list.filter((p) => p.category_ids?.includes(categoryFilter));
    }
    return list;
  }, [allProducts, searchQuery, categoryFilter]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!isInitialized) return false;
    if (selectedIds.length !== initialIds.length) return true;
    for (let i = 0; i < selectedIds.length; i++) {
      if (selectedIds[i] !== initialIds[i]) return true;
    }
    if (meta.enabled !== initialMeta.enabled) return true;
    if (meta.title !== initialMeta.title) return true;
    if (meta.eyebrow !== initialMeta.eyebrow) return true;
    if (meta.description !== initialMeta.description) return true;
    return false;
  }, [isInitialized, selectedIds, initialIds, meta, initialMeta]);

  // Reorder actions
  function moveUp(index: number) {
    if (index <= 0) return;
    const next = [...selectedIds];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    setSelectedIds(next);
  }

  function moveDown(index: number) {
    if (index >= selectedIds.length - 1) return;
    const next = [...selectedIds];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    setSelectedIds(next);
  }

  function moveToTop(index: number) {
    if (index <= 0) return;
    const next = [...selectedIds];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    setSelectedIds(next);
  }

  function moveToBottom(index: number) {
    if (index >= selectedIds.length - 1) return;
    const next = [...selectedIds];
    const [item] = next.splice(index, 1);
    next.push(item);
    setSelectedIds(next);
  }

  // Add & remove actions
  function addProduct(id: string) {
    if (selectedSet.has(id)) {
      toast.info("Product is already in the Festival Special section.");
      return;
    }
    setSelectedIds((prev) => [...prev, id]);
    const prod = productMap.get(id);
    toast.success(`Added "${prod?.name || "Product"}" to Festival Special.`);
  }

  function removeProduct(id: string) {
    const prod = productMap.get(id);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    toast.success(`Removed "${prod?.name || "Product"}" from Festival Special.`);
  }

  function clearAll() {
    if (
      confirm("Are you sure you want to remove all products from the Festival Special section?")
    ) {
      setSelectedIds([]);
      toast.info("Cleared all products from Festival Special.");
    }
  }

  async function resetToAutoTags() {
    if (
      confirm(
        "Auto-fill with all products matching Diwali and light tags? This will replace your current selection with the top relevant store items.",
      )
    ) {
      setIsAutoLoading(true);
      try {
        const autoIds = await fetchAutoFestivalProductIds();
        setSelectedIds(autoIds);
        toast.success(`Loaded ${autoIds.length} festival products from store tags.`);
      } catch {
        toast.error("Failed to load automatic suggestions.");
      } finally {
        setIsAutoLoading(false);
      }
    }
  }

  // Save changes to database
  async function saveChanges() {
    if (!settingsData) return;
    setIsSaving(true);
    try {
      const currentSocial = (settingsData.social_links as Record<string, unknown> | null) || {};
      const updatedSocial = {
        ...currentSocial,
        festival_product_ids: selectedIds,
        festival_special: {
          product_ids: selectedIds,
          title: meta.title.trim(),
          eyebrow: meta.eyebrow.trim(),
          description: meta.description.trim(),
          enabled: meta.enabled,
        },
      };

      const { error } = await supabase
        .from("site_settings")
        .update({
          social_links: updatedSocial,
        })
        .eq("id", 1);

      if (error) throw error;

      toast.success("Festival Special section saved successfully!");
      setInitialIds(selectedIds);
      setInitialMeta(meta);

      // Invalidate relevant queries so admin and storefront see changes immediately
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["home"] }),
        qc.invalidateQueries({ queryKey: ["festival"] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save festival configuration.");
    } finally {
      setIsSaving(false);
    }
  }

  if (settingsLoading || productsLoading || !isInitialized) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading Festival Special configuration…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <AdminTitle
        title="Festival Special Section"
        sub="Add, remove, and arrange the exact order of products featured on the homepage festival rail."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/#festival-special"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLink className="size-4" /> View on Store
            </a>
            <Button
              onClick={saveChanges}
              disabled={isSaving || !hasChanges}
              variant={hasChanges ? "default" : "secondary"}
              className="gap-2"
            >
              {isSaving ? (
                <>Saving…</>
              ) : hasChanges ? (
                <>
                  <Check className="size-4" /> Save Changes
                </>
              ) : (
                <>Saved</>
              )}
            </Button>
          </div>
        }
      />

      {/* UNSAVED WARNING BAR */}
      {hasChanges && (
        <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          <span className="flex items-center gap-2 font-medium">
            <Flame className="size-4 shrink-0 animate-bounce" /> You have unsaved changes to the
            Festival Special list.
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedIds(initialIds);
                setMeta(initialMeta);
              }}
            >
              Discard
            </Button>
            <Button size="sm" onClick={saveChanges} disabled={isSaving}>
              Save Now
            </Button>
          </div>
        </div>
      )}

      {/* SECTION SETTINGS (TITLE, EYEBROW, ENABLED) */}
      <Section title="Section Display & Messaging">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Section Eyebrow Badge" hint="Badge text shown above the main title">
            <input
              className={inputCls}
              value={meta.eyebrow}
              onChange={(e) => setMeta({ ...meta, eyebrow: e.target.value })}
              placeholder="Festival Special · Diwali"
            />
          </Field>
          <Field label="Section Heading" hint="Main title of the festival showcase">
            <input
              className={inputCls}
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="Festival of Lights & Cosmic Glow"
            />
          </Field>
        </div>

        <Field label="Section Description" hint="Subheading text explaining the festive collection">
          <textarea
            className={textareaCls}
            rows={2}
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
          />
        </Field>

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-medium text-foreground">Section Visibility</p>
            <p className="text-xs text-muted-foreground">
              Turn off when the festival has passed, or keep active year-round.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMeta({ ...meta, enabled: !meta.enabled })}
            className="flex items-center gap-2"
          >
            <StatusBadge
              on={meta.enabled}
              onLabel="Active on Store"
              offLabel="Hidden"
              tone="primary"
            />
          </button>
        </div>
      </Section>

      {/* ORDERED CURATED PRODUCTS LIST */}
      <Section
        title={`Featured Products in Carousel (${festivalProducts.length} ${festivalProducts.length === 1 ? "product" : "products"})`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <p className="text-xs text-muted-foreground">
            Products appear on the homepage exactly in the sequence shown below (#1 is leftmost).
            Use the arrows to reorder.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={resetToAutoTags}
              disabled={isAutoLoading}
              title="Populate from Diwali & Lights tags"
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" /> Auto-fill from Tags
            </Button>
            {festivalProducts.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearAll}
                className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" /> Clear All
              </Button>
            )}
          </div>
        </div>

        {festivalProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Flame className="mx-auto size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">No products in Festival Special</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add products from the catalog below, or click "Auto-fill from Tags" to populate with
              Diwali lights.
            </p>
            <Button size="sm" variant="outline" onClick={resetToAutoTags} className="mt-4 gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> Auto-fill with Diwali products
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {festivalProducts.map((p, index) => {
              const isFirst = index === 0;
              const isLast = index === festivalProducts.length - 1;

              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/60 p-2.5 sm:p-3 transition-colors hover:border-primary/40 hover:bg-background/90"
                >
                  {/* POSITION & THUMBNAIL & INFO */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-semibold text-primary">
                      #{index + 1}
                    </span>

                    <Thumb src={firstImage(p)} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/admin/products/edit/$id"
                          params={{ id: p.id }}
                          className="truncate text-sm font-medium text-foreground hover:text-primary transition-colors"
                          title={p.name}
                        >
                          {p.name}
                        </Link>
                        {!p.active && (
                          <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.categories?.name || "General"} · {p.slug}
                      </p>
                    </div>
                  </div>

                  {/* REORDER & REMOVE ACTIONS */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveToTop(index)}
                      disabled={isFirst}
                      title="Move to top (#1)"
                      aria-label={`Move ${p.name} to top`}
                      className="size-8 text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                      <ArrowUpToLine className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => moveUp(index)}
                      disabled={isFirst}
                      title="Move up"
                      aria-label={`Move ${p.name} up`}
                      className="size-8 disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => moveDown(index)}
                      disabled={isLast}
                      title="Move down"
                      aria-label={`Move ${p.name} down`}
                      className="size-8 disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveToBottom(index)}
                      disabled={isLast}
                      title="Move to bottom"
                      aria-label={`Move ${p.name} to bottom`}
                      className="size-8 text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                      <ArrowDownToLine className="size-4" />
                    </Button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeProduct(p.id)}
                      title="Remove from festival special"
                      aria-label={`Remove ${p.name} from festival special`}
                      className="size-8 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* PRODUCT PICKER (ADD PRODUCTS) */}
      <Section title="Add Products to Festival Special">
        <p className="text-xs text-muted-foreground mb-4">
          Search the store catalog and click "+ Add" to include any item in the Festival Special
          section.
        </p>

        {/* SEARCH & CATEGORY FILTER */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Search products by title, keyword, or slug…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={inputCls}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CANDIDATES TABLE / LIST */}
        <div className="max-h-96 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-background/50">
          {candidateProducts.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No products match your search.
            </p>
          ) : (
            candidateProducts.slice(0, 40).map((p) => {
              const alreadyAdded = selectedSet.has(p.id);
              const position = alreadyAdded ? selectedIds.indexOf(p.id) + 1 : null;

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-2.5 sm:p-3 hover:bg-card/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Thumb src={firstImage(p)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.categories?.name || "General"} · {p.active ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>

                  <div>
                    {alreadyAdded ? (
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                          In Festival (#{position})
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeProduct(p.id)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addProduct(p.id)}
                        className="h-8 gap-1 border-primary/40 text-xs hover:bg-primary hover:text-primary-foreground"
                      >
                        <Plus className="size-3.5" /> Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Section>
    </div>
  );
}
