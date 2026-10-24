import { isProductVideo } from "@/lib/product-media";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  X,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ProductDetailView } from "@/components/store/ProductDetailView";
import { supabase } from "@/integrations/supabase/client";
import { removeStoragePaths, uploadImage, uploadProductVideo } from "@/lib/admin";
import { adminCategoriesQuery, adminDuplicateCatalogQuery } from "@/lib/admin-queries";
import { formatPrice, isValidAffiliateUrl, slugify, type ProductFull } from "@/lib/store";
import { isDuplicateAffiliateError, productSaveErrorMessage } from "@/lib/product-errors";
import { checkDuplicateAgainstCatalog, type DuplicateMatch } from "@/lib/duplicate-detector";
import { DuplicateWarningDialog } from "./DuplicateWarningDialog";
import { Field, inputCls, Section, textareaCls } from "./ui";
import { CategorySelect } from "./CategorySelect";
import { productCategoryIds } from "@/lib/product-categories";
import { currencyForUrl } from "@/lib/retailer-currency";

type Img = { key: string; url: string; path: string | null; alt: string };
type Errors = Partial<
  Record<"name" | "short" | "desc" | "category" | "images" | "affiliate" | "price", string>
>;

const RETAILERS = ["Amazon", "Flipkart", "Other"];
const CURRENCIES = ["INR", "USD", "GBP", "EUR", "CAD", "AUD", "AED"];

export function ProductForm({ productId }: { productId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(adminCategoriesQuery);
  const { data: duplicateCatalog = [] } = useQuery(adminDuplicateCatalogQuery);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(!!productId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "draft" | "publish" | "save">(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState<null | { slug: string; active: boolean; published: boolean }>(
    null,
  );
  const [removed, setRemoved] = useState<string[]>([]);

  // Duplicate detection state
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingSaveMode, setPendingSaveMode] = useState<"draft" | "publish" | "save" | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [short, setShort] = useState("");
  const [desc, setDesc] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<Img[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [retailerProductId, setRetailerProductId] = useState("");
  const [retailer, setRetailer] = useState("Amazon");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [priceDate, setPriceDate] = useState("");
  const [active, setActive] = useState(false);
  const [featured, setFeatured] = useState(false);

  // Auto-fetch from affiliate / e-commerce product URL
  const [fetchUrl, setFetchUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [checkingPrice, setCheckingPrice] = useState(false);

  async function handleAutoFetch() {
    const targetUrl = fetchUrl.trim() || affiliateUrl.trim();
    if (!targetUrl) {
      toast.error("Please enter a product URL to auto-fetch details.");
      return;
    }

    try {
      new URL(targetUrl);
    } catch {
      toast.error("Please enter a valid URL (e.g. starting with https://).");
      return;
    }

    setFetching(true);
    const toastId = toast.loading("Analyzing link & extracting product specifications and photos…");

    try {
      const res = await fetch("/api/admin/scrape-product", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      let json: {
        success?: boolean;
        error?: string;
        data?: {
          name?: string;
          slug?: string;
          short_description?: string;
          description?: string;
          brand?: string;
          price?: number | string;
          currency?: string;
          retailer?: string;
          retailer_product_id?: string;
          affiliate_url?: string;
          features?: string[];
          tags?: string[];
          images?: string[];
        };
      } | null = null;
      try {
        const text = await res.text();
        json = JSON.parse(text);
      } catch {
        throw new Error(
          "Unable to parse retailer response. The retailer site or network returned an unexpected non-JSON response.",
        );
      }

      // If partial metadata was detected (e.g. Ubuy affiliate link with Amazon ASIN)
      if (json?.data) {
        const d = json.data;
        if (d.retailer) setRetailer(d.retailer);
        if (d.retailer_product_id) setRetailerProductId(d.retailer_product_id);
        if (d.affiliate_url && !affiliateUrl) setAffiliateUrl(d.affiliate_url);
      }

      if (!res.ok || json?.error || !json?.data) {
        throw new Error(json?.error || "Failed to extract product details from URL");
      }

      const d = json.data;
      if (d.name) setName(d.name);
      if (d.slug) {
        setSlug(d.slug);
        setSlugTouched(true);
      }
      if (d.short_description) setShort(d.short_description);
      if (d.description) setDesc(d.description);
      if (d.brand) setBrand(d.brand);
      // An unavailable price must not leave another product's old amount behind.
      setPrice(d.price != null ? String(d.price) : "");
      setPriceDate(d.price != null && d.price !== "" ? new Date().toISOString().slice(0, 10) : "");
      if (d.currency) {
        setCurrency(d.currency);
      } else {
        const detected = currencyForUrl(targetUrl);
        if (detected) setCurrency(detected);
      }
      if (d.retailer) setRetailer(d.retailer);
      if (d.retailer_product_id) setRetailerProductId(d.retailer_product_id);
      if (d.affiliate_url && !affiliateUrl) setAffiliateUrl(d.affiliate_url);
      if (Array.isArray(d.features) && d.features.length) {
        setFeatures(d.features);
      }

      // Merge suggested tags without duplicates
      if (Array.isArray(d.tags) && d.tags.length) {
        setTags((prev) => [...new Set([...prev, ...(d.tags ?? [])])]);
      }

      // Add extracted high-res gallery images
      if (Array.isArray(d.images) && d.images.length) {
        const newImgs: Img[] = d.images.map((url: string, idx: number) => ({
          key: `auto-${Date.now()}-${idx}`,
          url,
          path: null,
          alt: `${d.name || "Product"} photo ${idx + 1}`,
        }));
        setImages((prev) => {
          // If previous images were auto-fetched, cleanly replace them with the authentic product photos
          const manuallyAdded = prev.filter((i) => !i.key.startsWith("auto-"));
          if (manuallyAdded.length === 0) {
            return newImgs;
          }
          const existing = new Set(manuallyAdded.map((i) => i.url));
          const additions = newImgs.filter((i) => !existing.has(i.url));
          return [...manuallyAdded, ...additions];
        });
      }

      toast.success(
        `✨ Product details and ${d.images?.length ?? 0} photos extracted! Review and adjust below.`,
        { id: toastId },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to auto-fetch details from URL.", {
        id: toastId,
      });
    } finally {
      setFetching(false);
    }
  }

  async function handleUpdatePriceFromLink() {
    const urlToCheck = affiliateUrl.trim() || fetchUrl.trim();
    if (!urlToCheck) {
      toast.error("Please enter an affiliate URL first.");
      return;
    }
    setCheckingPrice(true);
    try {
      const res = await fetch("/api/admin/check-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToCheck, productId }),
      });
      let data: {
        success?: boolean;
        price?: number;
        currency?: string;
        inStock?: boolean;
        stockMessage?: string;
        retailer?: string;
        retailer_product_id?: string;
        error?: string;
      } | null = null;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        toast.error("Unable to check price: Retailer response was non-JSON.");
        return;
      }

      // Check if product is out of stock on retailer site
      if (res.ok && data?.success && data?.inStock === false) {
        setActive(false);
        const newPriceNum = data.price ?? (price ? parseFloat(price) : null);
        const newCurrency = data.currency || currency || "INR";
        if (data.price != null) {
          setPrice(String(data.price));
          setCurrency(newCurrency);
          setPriceDate(new Date().toISOString().slice(0, 10));
        }

        if (productId) {
          await supabase
            .from("products")
            .update({
              active: false,
              ...(newPriceNum != null
                ? {
                    price: newPriceNum,
                    currency: newCurrency,
                    price_updated_at: new Date().toISOString(),
                  }
                : {}),
            })
            .eq("id", productId);
          qc.invalidateQueries({ queryKey: ["admin"] });
        }

        toast.warning(
          `⚠️ Product is Out of Stock on retailer site (${data.stockMessage || "Currently unavailable"}). Deactivated product automatically to prevent dead clicks.`,
          { duration: 6000 },
        );
        return;
      }

      if (!res.ok || !data?.success || data?.price == null) {
        toast.warning(data?.error || "Could not detect active price from retailer link.");
        return;
      }

      const newPriceNum = data.price;
      const newCurrency = data.currency || currencyForUrl(urlToCheck) || currency;
      const todayIso = new Date().toISOString().slice(0, 10);
      const oldPriceNum = price ? parseFloat(price) : null;

      setPrice(String(newPriceNum));
      setCurrency(newCurrency);
      setPriceDate(todayIso);
      if (data.retailer && !retailer) {
        setRetailer(data.retailer);
      }
      if (data.retailer_product_id && !retailerProductId) {
        setRetailerProductId(data.retailer_product_id);
      }

      // If editing an existing product, save immediately to database as requested
      if (productId) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("products")
          .update({
            price: newPriceNum,
            currency: newCurrency,
            price_updated_at: nowIso,
            updated_at: nowIso,
            ...(data.retailer ? { retailer: data.retailer } : {}),
            ...(data.retailer_product_id
              ? {
                  retailer_product_id: data.retailer_product_id,
                  ...(data.retailer === "Amazon" ? { amazon_asin: data.retailer_product_id } : {}),
                }
              : {}),
          })
          .eq("id", productId);

        if (error) {
          toast.error(
            `Price found (${formatPrice(newPriceNum, newCurrency)}) but failed to save: ${error.message}`,
          );
          return;
        }

        qc.invalidateQueries({ queryKey: ["admin"] });

        const sourceLabel = data.retailer ? ` from ${data.retailer}` : "";
        if (oldPriceNum != null && oldPriceNum !== newPriceNum) {
          toast.success(
            `✨ Price updated from ${formatPrice(oldPriceNum, currency)} to ${formatPrice(newPriceNum, newCurrency)}${sourceLabel} and saved to database!`,
          );
        } else if (oldPriceNum === newPriceNum) {
          toast.info(
            `Price verified at ${formatPrice(newPriceNum, newCurrency)}${sourceLabel} and saved to database.`,
          );
        } else {
          toast.success(
            `✨ Price set to ${formatPrice(newPriceNum, newCurrency)}${sourceLabel} and saved to database!`,
          );
        }
      } else {
        toast.success(`✨ Price populated from link: ${formatPrice(newPriceNum, newCurrency)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check price from link.");
    } finally {
      setCheckingPrice(false);
    }
  }

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
      setCategoryIds(productCategoryIds(data));
      setSubcategory(data.subcategory ?? "");
      setBrand(data.brand ?? "");
      setTags((data.product_tags ?? []).map((t) => t.tag));
      setImages(
        [...(data.product_images ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({
            key: i.id,
            url: i.image_url,
            path: i.storage_path,
            alt: i.alt_text ?? "",
          })),
      );
      setFeatures(
        [...(data.product_features ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((f) => f.feature),
      );
      setAffiliateUrl(data.affiliate_url ?? data.amazon_url ?? "");
      setRetailerProductId(data.retailer_product_id ?? data.amazon_asin ?? "");
      setRetailer(data.retailer ?? (data.amazon_url ? "Amazon" : "Other"));
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

  // Debounced background duplicate check for live helper feedback
  useEffect(() => {
    const s = short.trim();
    const d = desc.trim();
    if (!s && !d) {
      setDuplicateMatches([]);
      setCheckingDuplicates(false);
      return;
    }
    if (s.length < 10 && d.length < 20) {
      setDuplicateMatches([]);
      setCheckingDuplicates(false);
      return;
    }
    setCheckingDuplicates(true);
    const timer = setTimeout(() => {
      const matches = checkDuplicateAgainstCatalog(
        {
          id: productId,
          name,
          short_description: s,
          description: d,
        },
        duplicateCatalog,
        65,
      );
      setDuplicateMatches(matches);
      setCheckingDuplicates(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [short, desc, productId, duplicateCatalog, name]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      try {
        const r = await (f.type.startsWith("video/") ? uploadProductVideo(f) : uploadImage(f, "products"));
        setImages((s) => [...s, { key: r.path, url: r.url, path: r.path, alt: "" }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Image upload failed.");
      }
    }
    setUploading(false);
    setErrors((e) => {
      const { images: _images, ...rest } = e;
      return rest;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  const move = (i: number, d: number) =>
    setImages((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      const current = n[i];
      const target = n[j];
      if (!current || !target) return s;
      n[i] = target;
      n[j] = current;
      return n;
    });
  const makePrimary = (i: number) =>
    setImages((s) => {
      const selected = s[i];
      return selected ? [selected, ...s.filter((_, k) => k !== i)] : s;
    });
  const removeImg = (i: number) =>
    setImages((s) => {
      const p = s[i]?.path;
      if (p) setRemoved((r) => [...r, p]);
      return s.filter((_, k) => k !== i);
    });

  function addTag(raw: string) {
    const parts = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    setTags((s) => [...new Set([...s, ...parts])].slice(0, 30));
    setTagInput("");
  }

  function validate(full: boolean): Errors {
    const e: Errors = {};
    if (!name.trim()) e.name = "Product name is required.";
    if (full) {
      if (!short.trim()) e.short = "Short description is required.";
      if (!desc.trim()) e.desc = "Description is required.";
      if (!categoryIds.length) e.category = "Please select at least one category.";
      if (!images.length) e.images = "Please upload a primary media.";
      if (!affiliateUrl.trim()) e.affiliate = "Affiliate URL is required.";
      else if (!isValidAffiliateUrl(affiliateUrl))
        e.affiliate = "Please enter a valid secure affiliate URL.";
    } else if (affiliateUrl.trim() && !isValidAffiliateUrl(affiliateUrl)) {
      e.affiliate = "Please enter a valid secure affiliate URL.";
    }
    if (price && (Number.isNaN(Number(price)) || Number(price) < 0))
      e.price = "Enter a valid price or leave it empty.";
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

  async function save(mode: "draft" | "publish" | "save", bypassDuplicateCheck = false) {
    const nextActive = mode === "publish" ? true : mode === "draft" ? false : active;
    const e = validate(nextActive);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    // Publish guard: check duplicate descriptions before making active
    const isPublishing = mode === "publish" || (mode === "save" && nextActive);
    if (isPublishing && !bypassDuplicateCheck) {
      const matches = checkDuplicateAgainstCatalog(
        {
          id: productId,
          name,
          short_description: short,
          description: desc,
        },
        duplicateCatalog,
        75,
      );

      const highMatches = matches.filter(
        (m) => m.overallScore >= 80 || m.exactShortMatch || m.exactDescMatch,
      );

      if (highMatches.length > 0) {
        setDuplicateMatches(highMatches);
        setPendingSaveMode(mode);
        setShowDuplicateModal(true);
        toast.warning(
          `Duplicate warning: Description matches existing product "${highMatches[0].product.name}" (${highMatches[0].overallScore}% similarity). Review required before publishing.`,
        );
        return;
      }
    }
    setSaving(mode);
    try {
      const finalSlug = await uniqueSlug(slug || name);
      const payload = {
        name: name.trim(),
        slug: finalSlug,
        short_description: short.trim() || null,
        description: desc.trim() || null,
        category_id: categoryIds[0] ?? null,
        category_ids: categoryIds,
        subcategory: subcategory.trim() || null,
        brand: brand.trim() || null,
        affiliate_url: affiliateUrl.trim() || null, // stored exactly as entered — never altered
        retailer: retailer.trim() || null,
        retailer_product_id: retailerProductId.trim() || null,
        price: price ? Number(price) : null,
        currency,
        price_updated_at: price
          ? priceDate
            ? new Date(priceDate).toISOString()
            : new Date().toISOString()
          : null,
        featured,
        active: nextActive,
      };
      let id = productId;
      if (id) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }
      if (!id) throw new Error("Product could not be saved.");
      const pid = id;
      await Promise.all([
        supabase.from("product_images").delete().eq("product_id", pid),
        supabase.from("product_features").delete().eq("product_id", pid),
        supabase.from("product_tags").delete().eq("product_id", pid),
      ]);
      const ops = [];
      if (images.length)
        ops.push(
          supabase.from("product_images").insert(
            images.map((im, i) => ({
              product_id: pid,
              image_url: im.url,
              storage_path: im.path,
              alt_text: im.alt || name,
              sort_order: i,
            })),
          ),
        );
      const feats = features.map((f) => f.trim()).filter(Boolean);
      if (feats.length)
        ops.push(
          supabase
            .from("product_features")
            .insert(feats.map((f, i) => ({ product_id: pid, feature: f, sort_order: i }))),
        );
      if (tags.length)
        ops.push(
          supabase.from("product_tags").insert(tags.map((t) => ({ product_id: pid, tag: t }))),
        );
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
      const message = productSaveErrorMessage(err);
      if (isDuplicateAffiliateError(err))
        setErrors((current) => ({ ...current, affiliate: message }));
      toast.error(message);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading product…</p>;
  if (loadError)
    return (
      <div className="rounded-2xl border border-border p-6">
        <p className="text-destructive">{loadError}</p>
        <Link to="/admin/products" className="mt-4 inline-block text-sm text-accent">
          Back to Products
        </Link>
      </div>
    );

  const selectedCats = categoryIds.flatMap((id) => {
    const c = cats.find((cat) => cat.id === id);
    return c ? [{ name: c.name, slug: c.slug }] : [];
  });
  const previewData: ProductFull = {
    id: productId ?? "preview",
    name: name || "Product name",
    slug,
    short_description: short || null,
    description: desc || null,
    brand: brand || null,
    category_id: categoryIds[0] ?? null,
    category_ids: categoryIds,
    assigned_categories: selectedCats,
    affiliate_url: affiliateUrl || null,
    retailer,
    retailer_product_id: retailerProductId || null,
    price: price ? Number(price) : null,
    currency,
    price_updated_at: priceDate || null,
    featured,
    created_at: new Date().toISOString(),
    category: selectedCats[0] ?? null,
    image: images[0]?.url ?? null,
    imageAlt: null,
    images: images.map((i) => ({ image_url: i.url, alt_text: i.alt })),
    features: features.filter(Boolean),
    tags,
  };

  return (
    <div className="space-y-5 pb-28">
      {/* 🪄 AUTO-FILL FROM AFFILIATE URL */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card/80 to-primary/5 p-4 sm:p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary text-sm font-bold shadow-inner">
              🪄
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-sm sm:text-base font-semibold text-foreground">
                  Auto-Fill from Affiliate URL
                </h3>
                <span className="rounded-full bg-primary/15 border border-primary/20 px-2 py-0.5 font-mono text-[10px] text-primary font-medium">
                  Amazon · Flipkart · Brand Stores
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste any product link below. Auto-extracts title, price, descriptions, features,
                and high-res photos for your review.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="url"
              value={fetchUrl}
              onChange={(e) => {
                setFetchUrl(e.target.value);
                const detected = currencyForUrl(e.target.value);
                if (detected && detected !== currency) {
                  setCurrency(detected);
                  setPrice("");
                  setPriceDate("");
                }
              }}
              placeholder="Paste affiliate or product link (e.g. https://www.amazon.in/dp/... or https://amzn.to/...)"
              className="h-10 w-full rounded-xl border border-border/80 bg-background/90 pl-10 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              disabled={fetching}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAutoFetch();
                }
              }}
            />
          </div>
          <Button
            type="button"
            onClick={handleAutoFetch}
            disabled={fetching || !fetchUrl.trim()}
            className="h-10 px-4 gap-2 text-xs font-semibold shrink-0"
          >
            {fetching ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Fetching details…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> Auto-Fetch & Pre-fill
              </>
            )}
          </Button>
        </div>
      </div>

      <Section title="1 · Basic product information">
        <Field label="Product Name" required error={errors.name}>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Galaxy Star Projector"
          />
        </Field>
        <Field label="URL slug" hint={`Public URL: /product/${slug || "…"}`}>
          <input
            className={inputCls}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field
          label="Short Description"
          required
          error={errors.short}
          hint="One or two sentences shown on product cards."
        >
          <textarea
            rows={2}
            maxLength={300}
            className={textareaCls}
            value={short}
            onChange={(e) => setShort(e.target.value)}
          />
        </Field>
        <Field
          label="Full Description"
          required
          error={errors.desc}
          hint="Leave a blank line between paragraphs. Start lines with “- ” for bullet points."
        >
          <textarea
            rows={8}
            className={textareaCls}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </Field>

        {/* Real-time duplicate verification helper */}
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5 transition">
          {checkingDuplicates ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Scanning catalog for duplicate or similar descriptions...</span>
            </div>
          ) : duplicateMatches.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Duplicate Detected:</strong> Matches &ldquo;
                  {duplicateMatches[0].product.name}&rdquo; ({duplicateMatches[0].overallScore}%
                  similarity)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(true)}
                className="inline-flex items-center gap-1 font-semibold text-amber-300 underline hover:text-white"
              >
                <Eye className="size-3.5" /> Compare side-by-side
              </button>
            </div>
          ) : short.trim().length >= 10 || desc.trim().length >= 20 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
              <span>
                Unique content: No duplicate descriptions detected across {duplicateCatalog.length}{" "}
                catalog products.
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Duplicate check: Enter product descriptions above to verify uniqueness against the
              catalog.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <CategorySelect
            categories={cats}
            value={categoryIds}
            onChange={(ids) => {
              setCategoryIds(ids);
              setErrors((current) => {
                const { category: _category, ...rest } = current;
                return rest;
              });
            }}
            error={errors.category}
          />
          <Field label="Subcategory">
            <input
              className={inputCls}
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            />
          </Field>
          <Field label="Brand">
            <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
        </div>
        <Field
          label="Tags"
          hint="Press Enter or comma to add. e.g. astronomy, galaxy, telescope, NASA"
        >
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-secondary/50 p-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => setTags((s) => s.filter((x) => x !== t))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              className="min-w-32 flex-1 bg-transparent px-1 text-sm focus:outline-none"
              value={tagInput}
              onChange={(e) =>
                e.target.value.includes(",") ? addTag(e.target.value) : setTagInput(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder="Add tag…"
            />
          </div>
        </Field>
      </Section>

      <Section title="2 · Product photos and optional videos">
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WEBP, or optional MP4/WebM videos up to 50 MB. Use the star to choose the default display media. The first item is the primary
          media.
        </p>
        {errors.images && (
          <p role="alert" className="text-xs text-destructive">
            {errors.images}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((im, i) => (
            <div
              key={im.key}
              className={`overflow-hidden rounded-xl border ${i === 0 ? "border-primary" : "border-border"} bg-secondary`}
            >
              <div className="relative aspect-square">
                {isProductVideo(im.url) ? <video src={im.url} muted playsInline controls preload="metadata" className="h-full w-full object-contain" /> : <img src={im.url} alt="" className="h-full w-full object-cover" />}
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    PRIMARY
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between p-1">
                <button
                  type="button"
                  aria-label="Move left"
                  onClick={() => move(i, -1)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowUp className="size-4 -rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label="Move right"
                  onClick={() => move(i, 1)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowDown className="size-4 -rotate-90" />
                </button>
                {i !== 0 && (
                  <button
                    type="button"
                    aria-label="Make primary"
                    title="Make primary"
                    onClick={() => makePrimary(i)}
                    className="p-2 text-muted-foreground hover:text-primary"
                  >
                    <Star className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete image"
                  onClick={() => removeImg(i)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <ImagePlus className="size-6" />
            )}
            {uploading ? "Uploading…" : images.length ? "Add photos or videos" : "Upload photos or video"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </Section>

      <Section title="3 · Product features">
        {features.map((f, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputCls}
              value={f}
              placeholder="e.g. HD galaxy projection"
              onChange={(e) => setFeatures((s) => s.map((x, k) => (k === i ? e.target.value : x)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove feature"
              onClick={() => setFeatures((s) => s.filter((_, k) => k !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setFeatures((s) => [...s, ""])}>
          <Plus /> Add Feature
        </Button>
      </Section>

      <Section title="4 · Affiliate information">
        <Field
          label="Affiliate URL"
          required
          error={errors.affiliate}
          hint="Paste this product's retailer affiliate link exactly. It is stored and used unchanged."
        >
          <input
            className={inputCls}
            type="url"
            inputMode="url"
            value={affiliateUrl}
            onChange={(e) => {
              setAffiliateUrl(e.target.value);
              const detected = currencyForUrl(e.target.value);
              if (detected && detected !== currency) {
                setCurrency(detected);
                setPrice("");
                setPriceDate("");
              }
              setErrors((current) => {
                const { affiliate: _affiliate, ...rest } = current;
                return rest;
              });
            }}
            onBlur={() =>
              affiliateUrl &&
              !isValidAffiliateUrl(affiliateUrl) &&
              setErrors((x) => ({ ...x, affiliate: "Please enter a valid secure affiliate URL." }))
            }
            placeholder="https://retailer.example/product/your-affiliate-link"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Retailer">
            <select
              className={inputCls}
              value={retailer}
              onChange={(e) => setRetailer(e.target.value)}
            >
              {RETAILERS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Retailer product ID"
            hint="Optional, for example an ASIN or Flipkart product ID."
          >
            <input
              className={inputCls}
              value={retailerProductId}
              onChange={(e) => setRetailerProductId(e.target.value)}
              placeholder="Optional product ID"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="5 · Price (optional)"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={checkingPrice || (!affiliateUrl.trim() && !fetchUrl.trim())}
            onClick={handleUpdatePriceFromLink}
            title={
              affiliateUrl.trim() || fetchUrl.trim()
                ? "Check live price from retailer link and save"
                : "Enter an affiliate URL first"
            }
          >
            {checkingPrice ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Update Price from Link
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground">
          Only enter a price you have verified with the retailer. If left empty, the store shows
          “Check latest price”. Click “Update Price from Link” to inspect the live retailer page
          anytime.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price" error={errors.price}>
            <input
              className={inputCls}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 1499"
            />
          </Field>
          <Field label="Currency">
            <select
              className={inputCls}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Price last updated">
            <input
              type="date"
              className={inputCls}
              value={priceDate}
              onChange={(e) => setPriceDate(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="6 · Visibility">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Active</span>
            <span className="text-xs text-muted-foreground">Visible on the public store.</span>
          </span>
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Featured Product</span>
            <span className="text-xs text-muted-foreground">
              Shown on the homepage and featured sections.
            </span>
          </span>
          <Switch checked={featured} onCheckedChange={setFeatured} />
        </label>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-8">
          <Link to="/admin/products" className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
          <Button variant="outline" onClick={() => setPreview(true)}>
            Preview
          </Button>
          {productId ? (
            <Button variant="affiliate" disabled={!!saving || uploading} onClick={() => save("save")}>
              {saving && <Loader2 className="animate-spin" />} Save Changes
            </Button>
          ) : (
            <>
              <Button variant="secondary" disabled={!!saving || uploading} onClick={() => save("draft")}>
                {saving === "draft" && <Loader2 className="animate-spin" />} Save Draft
              </Button>
              <Button variant="affiliate" disabled={!!saving || uploading} onClick={() => save("publish")}>
                {saving === "publish" && <Loader2 className="animate-spin" />} Publish Product
              </Button>
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
          <DialogTitle className="text-2xl">
            {done?.published ? "Product published successfully." : "Changes saved."}
          </DialogTitle>
          {done && !done.active && (
            <p className="text-sm text-muted-foreground">
              This product is inactive, so it is hidden from the store.
            </p>
          )}
          <div className="mt-2 flex flex-col gap-2">
            {done?.active && (
              <a
                href={`/product/${done.slug}`}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ variant: "affiliate" })}
              >
                View Product
              </a>
            )}
            <Link to="/admin/products" className={buttonVariants({ variant: "outline" })}>
              Back to Products
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <DuplicateWarningDialog
        open={showDuplicateModal}
        onOpenChange={(open) => {
          setShowDuplicateModal(open);
          if (!open) setPendingSaveMode(null);
        }}
        matches={duplicateMatches}
        candidate={{
          name,
          short_description: short,
          description: desc,
          imageUrl: images[0]?.url,
        }}
        onProceedAnyway={() => {
          const mode = pendingSaveMode || (productId ? "save" : "publish");
          setShowDuplicateModal(false);
          setPendingSaveMode(null);
          save(mode, true);
        }}
        onCancelAndEdit={() => {
          setShowDuplicateModal(false);
          setPendingSaveMode(null);
        }}
        isPublishing={saving === "publish" || saving === "save"}
      />
    </div>
  );
}
