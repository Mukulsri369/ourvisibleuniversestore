import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CheckCircle2, ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ProductDetailView } from "@/components/store/ProductDetailView";
import { supabase } from "@/integrations/supabase/client";
import { removeStoragePaths, uploadImage } from "@/lib/admin";
import { adminCategoriesQuery } from "@/lib/admin-queries";
import { isValidAmazonUrl, slugify, type ProductFull } from "@/lib/store";
import { Field, inputCls, Section, textareaCls } from "./ui";

type Img = { key: string; url: string; path: string | null; alt: string };
type Errors = Partial<Record<"name" | "short" | "desc" | "category" | "images" | "amazon" | "price", string>>;

const MARKETS = ["amazon.in", "amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.com.au", "amazon.ae"];
const CURRENCIES = ["INR", "USD", "GBP", "EUR", "CAD", "AUD", "AED"];

export function ProductForm({ productId }: { productId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(adminCategoriesQuery);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(!!productId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "draft" | "publish" | "save">(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState<null | { slug: string; active: boolean; published: boolean }>(null);
  const [removed, setRemoved] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [short, setShort] = useState("");
  const [desc, setDesc] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<Img[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [amazonUrl, setAmazonUrl] = useState("");
  const [asin, setAsin] = useState("");
  const [market, setMarket] = useState("amazon.in");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [priceDate, setPriceDate] = useState("");
  const [active, setActive] = useState(false);
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*), product_features(*), product_tags(*)")
        .eq("id", productId)
        .maybeSingle();
      if (error || !data) {
        setLoadError(error?.message ?? "Product not found.");
        setLoading(false);
        return;
      }
      setName(data.name);
      setSlug(data.slug);
      setSlugTouched(true);
      setShort(data.short_description ?? "");
      setDesc(data.description ?? "");
      setCategoryId(data.category_id ?? "");
      setSubcategory(data.subcategory ?? "");
      setBrand(data.brand ?? "");
      setTags((data.product_tags ?? []).map((t) => t.tag));
      setImages(
        [...(data.product_images ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({ key: i.id, url: i.image_url, path: i.storage_path, alt: i.alt_text ?? "" })),
      );
      setFeatures([...(data.product_features ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((f) => f.feature));
      setAmazonUrl(data.amazon_url ?? "");
      setAsin(data.amazon_asin ?? "");
      setMarket(data.amazon_marketplace ?? "amazon.in");
      setPrice(data.price != null ? String(data.price) : "");
      setCurrency(data.currency ?? "INR");
      setPriceDate(data.price_updated_at ? data.price_updated_at.slice(0, 10) : "");
      setActive(data.active);
      setFeatured(data.featured);
      setLoading(false);
    })();
  }, [productId]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      try {
        const r = await uploadImage(f, "products");
        setImages((s) => [...s, { key: r.path, url: r.url, path: r.path, alt: "" }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Image upload failed.");
      }
    }
    setUploading(false);
    setErrors((e) => ({ ...e, images: undefined }));
    if (fileRef.current) fileRef.current.value = "";
  }

  const move = (i: number, d: number) =>
    setImages((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const makePrimary = (i: number) => setImages((s) => [s[i], ...s.filter((_, k) => k !== i)]);
  const removeImg = (i: number) =>
    setImages((s) => {
      const p = s[i].path;
      if (p) setRemoved((r) => [...r, p]);
      return s.filter((_, k) => k !== i);
    });

  function addTag(raw: string) {
    const parts = raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    setTags((s) => [...new Set([...s, ...parts])].slice(0, 30));
    setTagInput("");
  }

  function validate(full: boolean): Errors {
    const e: Errors = {};
    if (!name.trim()) e.name = "Product name is required.";
    if (full) {
      if (!short.trim()) e.short = "Short description is required.";
      if (!desc.trim()) e.desc = "Description is required.";
      if (!categoryId) e.category = "Please select a category.";
      if (!images.length) e.images = "Please upload a primary image.";
      if (!amazonUrl.trim()) e.amazon = "Amazon affiliate URL is required.";
      else if (!isValidAmazonUrl(amazonUrl)) e.amazon = "Please enter a valid Amazon affiliate URL.";
    } else if (amazonUrl.trim() && !isValidAmazonUrl(amazonUrl)) {
      e.amazon = "Please enter a valid Amazon affiliate URL.";
    }
    if (price && (Number.isNaN(Number(price)) || Number(price) < 0)) e.price = "Enter a valid price or leave it empty.";
    return e;
  }

  async function uniqueSlug(base: string) {
    const b = slugify(base) || "product";
    for (let n = 1; n < 50; n++) {
      const s = n === 1 ? b : `${b}-${n}`;
      let q = supabase.from("products").select("id").eq("slug", s);
      if (productId) q = q.neq("id", productId);
      const { data } = await q.maybeSingle();
      if (!data) return s;
    }
    return `${b}-${Date.now()}`;
  }

  async function save(mode: "draft" | "publish" | "save") {
    const nextActive = mode === "publish" ? true : mode === "draft" ? false : active;
    const e = validate(nextActive);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(mode);
    try {
      const finalSlug = await uniqueSlug(slug || name);
      const payload = {
        name: name.trim(),
        slug: finalSlug,
        short_description: short.trim() || null,
        description: desc.trim() || null,
        category_id: categoryId || null,
        subcategory: subcategory.trim() || null,
        brand: brand.trim() || null,
        amazon_url: amazonUrl.trim() || null, // stored exactly as entered — never altered
        amazon_asin: asin.trim().toUpperCase() || null,
        amazon_marketplace: market,
        price: price ? Number(price) : null,
        currency,
        price_updated_at: price ? (priceDate ? new Date(priceDate).toISOString() : new Date().toISOString()) : null,
        featured,
        active: nextActive,
      };
      let id = productId;
      if (id) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const pid = id!;
      await Promise.all([
        supabase.from("product_images").delete().eq("product_id", pid),
        supabase.from("product_features").delete().eq("product_id", pid),
        supabase.from("product_tags").delete().eq("product_id", pid),
      ]);
      const ops = [];
      if (images.length)
        ops.push(supabase.from("product_images").insert(images.map((im, i) => ({ product_id: pid, image_url: im.url, storage_path: im.path, alt_text: im.alt || name, sort_order: i }))));
      const feats = features.map((f) => f.trim()).filter(Boolean);
      if (feats.length) ops.push(supabase.from("product_features").insert(feats.map((f, i) => ({ product_id: pid, feature: f, sort_order: i }))));
      if (tags.length) ops.push(supabase.from("product_tags").insert(tags.map((t) => ({ product_id: pid, tag: t }))));
      const results = await Promise.all(ops);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      await removeStoragePaths(removed);
      setRemoved([]);
      setActive(nextActive);
      setSlug(finalSlug);
      qc.invalidateQueries();
      if (mode === "draft") {
        toast.success("Draft saved.");
        if (!productId) navigate({ to: "/admin/products/edit/$id", params: { id: pid } });
      } else {
        setDone({ slug: finalSlug, active: nextActive, published: mode === "publish" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the product.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading product…</p>;
  if (loadError)
    return (
      <div className="rounded-2xl border border-border p-6">
        <p className="text-destructive">{loadError}</p>
        <Link to="/admin/products" className="mt-4 inline-block text-sm text-accent">Back to Products</Link>
      </div>
    );

  const cat = cats.find((c) => c.id === categoryId);
  const previewData: ProductFull = {
    id: productId ?? "preview",
    name: name || "Product name",
    slug,
    short_description: short || null,
    description: desc || null,
    brand: brand || null,
    category_id: categoryId || null,
    amazon_url: amazonUrl || null,
    amazon_asin: asin || null,
    amazon_marketplace: market,
    price: price ? Number(price) : null,
    currency,
    price_updated_at: priceDate || null,
    featured,
    created_at: new Date().toISOString(),
    category: cat ? { name: cat.name, slug: cat.slug } : null,
    image: images[0]?.url ?? null,
    imageAlt: null,
    images: images.map((i) => ({ image_url: i.url, alt_text: i.alt })),
    features: features.filter(Boolean),
    tags,
  };

  return (
    <div className="space-y-5 pb-28">
      <Section title="1 · Basic product information">
        <Field label="Product Name" required error={errors.name}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Galaxy Star Projector" />
        </Field>
        <Field label="URL slug" hint={`Public URL: /product/${slug || "…"}`}>
          <input className={inputCls} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} />
        </Field>
        <Field label="Short Description" required error={errors.short} hint="One or two sentences shown on product cards.">
          <textarea rows={2} maxLength={300} className={textareaCls} value={short} onChange={(e) => setShort(e.target.value)} />
        </Field>
        <Field label="Full Description" required error={errors.desc} hint="Leave a blank line between paragraphs. Start lines with “- ” for bullet points.">
          <textarea rows={8} className={textareaCls} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" required error={errors.category}>
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select a category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inactive)"}</option>)}
            </select>
          </Field>
          <Field label="Subcategory"><input className={inputCls} value={subcategory} onChange={(e) => setSubcategory(e.target.value)} /></Field>
          <Field label="Brand"><input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
        </div>
        <Field label="Tags" hint="Press Enter or comma to add. e.g. astronomy, galaxy, telescope, NASA">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-secondary/50 p-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags((s) => s.filter((x) => x !== t))}><X className="size-3" /></button>
              </span>
            ))}
            <input
              className="min-w-32 flex-1 bg-transparent px-1 text-sm focus:outline-none"
              value={tagInput}
              onChange={(e) => (e.target.value.includes(",") ? addTag(e.target.value) : setTagInput(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder="Add tag…"
            />
          </div>
        </Field>
      </Section>

      <Section title="2 · Product images">
        <p className="text-xs text-muted-foreground">JPG, JPEG, PNG or WEBP. Images are automatically optimised. The first image is the primary image.</p>
        {errors.images && <p role="alert" className="text-xs text-destructive">{errors.images}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((im, i) => (
            <div key={im.key} className={`overflow-hidden rounded-xl border ${i === 0 ? "border-primary" : "border-border"} bg-secondary`}>
              <div className="relative aspect-square">
                <img src={im.url} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">PRIMARY</span>}
              </div>
              <div className="flex items-center justify-between p-1">
                <button type="button" aria-label="Move left" onClick={() => move(i, -1)} className="p-2 text-muted-foreground hover:text-foreground"><ArrowUp className="size-4 -rotate-90" /></button>
                <button type="button" aria-label="Move right" onClick={() => move(i, 1)} className="p-2 text-muted-foreground hover:text-foreground"><ArrowDown className="size-4 -rotate-90" /></button>
                {i !== 0 && <button type="button" aria-label="Make primary" title="Make primary" onClick={() => makePrimary(i)} className="p-2 text-muted-foreground hover:text-primary"><Star className="size-4" /></button>}
                <button type="button" aria-label="Delete image" onClick={() => removeImg(i)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            {uploading ? "Uploading…" : images.length ? "Add images" : "Upload primary image"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </Section>

      <Section title="3 · Product features">
        {features.map((f, i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls} value={f} placeholder="e.g. HD galaxy projection" onChange={(e) => setFeatures((s) => s.map((x, k) => (k === i ? e.target.value : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove feature" onClick={() => setFeatures((s) => s.filter((_, k) => k !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setFeatures((s) => [...s, ""])}><Plus /> Add Feature</Button>
      </Section>

      <Section title="4 · Amazon information">
        <Field label="Amazon Affiliate URL" required error={errors.amazon} hint="Paste this product's own affiliate link exactly. It is stored and used unchanged.">
          <input className={inputCls} type="url" inputMode="url" value={amazonUrl} onChange={(e) => setAmazonUrl(e.target.value)} onBlur={() => amazonUrl && !isValidAmazonUrl(amazonUrl) && setErrors((x) => ({ ...x, amazon: "Please enter a valid Amazon affiliate URL." }))} placeholder="https://www.amazon.in/dp/XXXXXXXXXX?tag=yourtag-21" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amazon ASIN"><input className={inputCls} value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B0XXXXXXXX" /></Field>
          <Field label="Amazon Marketplace">
            <select className={inputCls} value={market} onChange={(e) => setMarket(e.target.value)}>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
        </div>
      </Section>

      <Section title="5 · Price (optional)">
        <p className="text-xs text-muted-foreground">Only enter a price you have verified on Amazon. If left empty, the store shows “Check latest price on Amazon”.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price" error={errors.price}><input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 1499" /></Field>
          <Field label="Currency"><select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Price last updated"><input type="date" className={inputCls} value={priceDate} onChange={(e) => setPriceDate(e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="6 · Visibility">
        <label className="flex items-center justify-between gap-4">
          <span><span className="block text-sm font-medium">Active</span><span className="text-xs text-muted-foreground">Visible on the public store.</span></span>
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span><span className="block text-sm font-medium">Featured Product</span><span className="text-xs text-muted-foreground">Shown on the homepage and featured sections.</span></span>
          <Switch checked={featured} onCheckedChange={setFeatured} />
        </label>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-8">
          <Link to="/admin/products" className={buttonVariants({ variant: "ghost" })}>Cancel</Link>
          <Button variant="outline" onClick={() => setPreview(true)}>Preview</Button>
          {productId ? (
            <Button variant="amazon" disabled={!!saving} onClick={() => save("save")}>{saving && <Loader2 className="animate-spin" />} Save Changes</Button>
          ) : (
            <>
              <Button variant="secondary" disabled={!!saving} onClick={() => save("draft")}>{saving === "draft" && <Loader2 className="animate-spin" />} Save Draft</Button>
              <Button variant="amazon" disabled={!!saving} onClick={() => save("publish")}>{saving === "publish" && <Loader2 className="animate-spin" />} Publish Product</Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto bg-background">
          <DialogTitle className="eyebrow">Preview — how customers will see it</DialogTitle>
          <ProductDetailView p={previewData} preview />
        </DialogContent>
      </Dialog>

      <Dialog open={!!done} onOpenChange={(o) => !o && setDone(null)}>
        <DialogContent className="max-w-sm bg-background text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <DialogTitle className="text-2xl">{done?.published ? "Product published successfully." : "Changes saved."}</DialogTitle>
          {done && !done.active && <p className="text-sm text-muted-foreground">This product is inactive, so it is hidden from the store.</p>}
          <div className="mt-2 flex flex-col gap-2">
            {done?.active && <a href={`/product/${done.slug}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "amazon" })}>View Product</a>}
            <Link to="/admin/products" className={buttonVariants({ variant: "outline" })}>Back to Products</Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
