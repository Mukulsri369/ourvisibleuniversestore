import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { AdminTitle, Field, inputCls } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import { adminDuplicateCatalogQuery, firstImage, type AdminRow } from "@/lib/admin-queries";
import { formatPrice } from "@/lib/store";
import {
  scanCatalogDuplicates,
  findSharedKeywords,
  type DuplicatePair,
  type CatalogProduct,
} from "@/lib/duplicate-detector";

export const Route = createFileRoute("/_admin/admin/duplicates")({
  head: () => ({
    meta: [{ title: "Product Duplicates | OVU Admin" }],
  }),
  component: AdminDuplicatesPage,
});

function AdminDuplicatesPage() {
  const qc = useQueryClient();
  const {
    data: catalog = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery(adminDuplicateCatalogQuery);

  const [threshold, setThreshold] = useState<"all" | "high" | "exact">("high");
  const [fieldFilter, setFieldFilter] = useState<"all" | "short" | "desc">("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dismissedPairIds, setDismissedPairIds] = useState<Set<string>>(new Set());
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Compute catalog duplicate pairs and measure scan time
  const { allPairs, scanDurationMs } = useMemo(() => {
    if (!catalog.length) return { allPairs: [] as DuplicatePair[], scanDurationMs: 0 };
    const t0 = performance.now();
    const pairs = scanCatalogDuplicates(catalog, 65);
    const t1 = performance.now();
    return { allPairs: pairs, scanDurationMs: Math.max(1, Math.round(t1 - t0)) };
  }, [catalog]);

  // Filter pairs based on controls
  const filteredPairs = useMemo(() => {
    return allPairs.filter((pair) => {
      if (dismissedPairIds.has(pair.id)) return false;

      // Threshold filter
      if (
        threshold === "exact" &&
        !pair.exactShortMatch &&
        !pair.exactDescMatch &&
        pair.overallScore < 100
      ) {
        return false;
      }
      if (
        threshold === "high" &&
        pair.overallScore < 80 &&
        !pair.exactShortMatch &&
        !pair.exactDescMatch
      ) {
        return false;
      }

      // Field filter
      if (fieldFilter === "short" && pair.shortScore < 70 && !pair.exactShortMatch) {
        return false;
      }
      if (fieldFilter === "desc" && pair.descScore < 70 && !pair.exactDescMatch) {
        return false;
      }

      // Active only filter
      if (activeOnly && (!pair.productA.active || !pair.productB.active)) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName =
          pair.productA.name.toLowerCase().includes(q) ||
          pair.productB.name.toLowerCase().includes(q);
        const matchesDesc =
          (pair.productA.short_description || "").toLowerCase().includes(q) ||
          (pair.productB.short_description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [allPairs, threshold, fieldFilter, activeOnly, searchQuery, dismissedPairIds]);

  // Metrics
  const exactCount = useMemo(
    () =>
      allPairs.filter((p) => p.exactShortMatch || p.exactDescMatch || p.overallScore === 100)
        .length,
    [allPairs],
  );
  const highCount = useMemo(
    () => allPairs.filter((p) => p.overallScore >= 80 && p.overallScore < 100).length,
    [allPairs],
  );

  // Handle deactivation of a duplicate product
  async function handleToggleActive(prod: CatalogProduct) {
    const nextState = !prod.active;
    setActionLoadingId(`toggle-${prod.id}`);
    try {
      const { error } = await supabase
        .from("products")
        .update({ active: nextState })
        .eq("id", prod.id);

      if (error) throw error;

      toast.success(`"${prod.name}" marked as ${nextState ? "Active" : "Inactive"}.`);
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update status: ${message}`);
    } finally {
      setActionLoadingId(null);
    }
  }

  // Handle soft deleting (trash)
  async function handleTrashProduct(prod: CatalogProduct) {
    if (!confirm(`Are you sure you want to move "${prod.name}" to trash?`)) return;
    setActionLoadingId(`trash-${prod.id}`);
    try {
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq("id", prod.id);

      if (error) throw error;

      toast.success(`"${prod.name}" moved to trash.`);
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to trash product: ${message}`);
    } finally {
      setActionLoadingId(null);
    }
  }

  function handleDismissPair(pairId: string) {
    setDismissedPairIds((prev) => new Set([...prev, pairId]));
    toast.info("Pair dismissed from current view session.");
  }

  function handleResetDismissed() {
    setDismissedPairIds(new Set());
    toast.success("Review queue reset.");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AdminTitle title="Duplicate Detection & Hygiene" />
          <p className="mt-1 text-sm text-muted-foreground">
            Analyze descriptions across the catalog to detect duplicate listings, copy-paste errors,
            and near-clones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dismissedPairIds.size > 0 && (
            <Button variant="outline" size="sm" onClick={handleResetDismissed} className="text-xs">
              Reset Dismissed ({dismissedPairIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Rescan Catalog
          </Button>
        </div>
      </div>

      {/* Metrics overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Products Scanned</span>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">{catalog.length}</div>
          <span className="text-[11px] text-muted-foreground">
            {catalog.length > 0 ? (
              <span className="text-emerald-400/90 font-mono">Indexed in {scanDurationMs}ms</span>
            ) : (
              "Active & draft items"
            )}
          </span>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Duplicate Pairs</span>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-400">{allPairs.length}</div>
          <span className="text-[11px] text-muted-foreground">≥65% similarity detected</span>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">High Similarity</span>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-500">{highCount}</div>
          <span className="text-[11px] text-muted-foreground">80% – 99% match</span>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Exact Matches</span>
          <div className="mt-1 font-mono text-2xl font-bold text-rose-400">{exactCount}</div>
          <span className="text-[11px] text-muted-foreground">Identical descriptions</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search product names or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputCls} pl-9 text-xs`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Threshold Toggles */}
            <div className="flex rounded-lg border border-border bg-secondary/60 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setThreshold("all")}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  threshold === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All (≥65%)
              </button>
              <button
                type="button"
                onClick={() => setThreshold("high")}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  threshold === "high"
                    ? "bg-amber-500 text-black shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                High (≥80%)
              </button>
              <button
                type="button"
                onClick={() => setThreshold("exact")}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  threshold === "exact"
                    ? "bg-rose-500 text-white shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Exact Only
              </button>
            </div>

            {/* Field selector */}
            <select
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value as "all" | "short" | "desc")}
              className={`${inputCls} w-auto text-xs`}
            >
              <option value="all">Compare All Fields</option>
              <option value="short">Short Description Focus</option>
              <option value="desc">Full Description Focus</option>
            </select>

            {/* Active only checkbox */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none pl-1">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="size-3.5 rounded border-border text-primary focus:ring-primary"
              />
              <span>Both Active Only</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredPairs.length}</strong> duplicate{" "}
            {filteredPairs.length === 1 ? "pair" : "pairs"}
          </span>
          {dismissedPairIds.size > 0 && (
            <span>{dismissedPairIds.size} pairs dismissed in this session</span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Scanning {catalog.length} products with Sørensen-Dice similarity algorithm...
          </p>
        </div>
      ) : filteredPairs.length === 0 ? (
        /* Empty clean state */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/5 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="size-8" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No Duplicate Products Found
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {allPairs.length > 0
              ? "All duplicate pairs have either been resolved, dismissed, or filtered out by current criteria."
              : "Every product in your catalog has unique descriptions and short descriptions."}
          </p>
          {threshold !== "all" && allPairs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setThreshold("all");
                setSearchQuery("");
              }}
              className="mt-4 text-xs"
            >
              View Lower Similarity Matches (≥65%)
            </Button>
          )}
        </div>
      ) : (
        /* Pairs list */
        <div className="space-y-6">
          {filteredPairs.map((pair) => (
            <DuplicatePairCard
              key={pair.id}
              pair={pair}
              actionLoadingId={actionLoadingId}
              onToggleActive={handleToggleActive}
              onTrash={handleTrashProduct}
              onDismiss={handleDismissPair}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DuplicatePairCardProps {
  pair: DuplicatePair;
  actionLoadingId: string | null;
  onToggleActive: (prod: CatalogProduct) => Promise<void>;
  onTrash: (prod: CatalogProduct) => Promise<void>;
  onDismiss: (id: string) => void;
}

function DuplicatePairCard({
  pair,
  actionLoadingId,
  onToggleActive,
  onTrash,
  onDismiss,
}: DuplicatePairCardProps) {
  const { productA, productB, overallScore, shortScore, descScore, reasons } = pair;

  const sharedShortWords = findSharedKeywords(
    productA.short_description,
    productB.short_description,
  );
  const sharedDescWords = findSharedKeywords(productA.description, productB.description);

  function renderHighlightedText(text?: string | null, sharedWords?: Set<string>) {
    if (!text) return <span className="text-muted-foreground italic">None provided</span>;
    if (!sharedWords || sharedWords.size === 0) return <span>{text}</span>;

    const words = text.split(/(\s+)/);
    return (
      <span>
        {words.map((w, idx) => {
          const cleanWord = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
          const isMatch = cleanWord.length > 3 && sharedWords.has(cleanWord);
          if (isMatch) {
            return (
              <mark key={idx} className="rounded bg-amber-500/25 px-0.5 font-medium text-amber-200">
                {w}
              </mark>
            );
          }
          return <span key={idx}>{w}</span>;
        })}
      </span>
    );
  }

  const badgeColor =
    overallScore >= 95
      ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
      : overallScore >= 80
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-blue-500/15 text-blue-400 border-blue-500/30";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-border/90">
      {/* Top Banner with Score and Reasons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-secondary/30 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold ${badgeColor}`}
          >
            <AlertTriangle className="size-3.5" />
            <span>{overallScore}% Similarity</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Short: <strong className="text-foreground font-mono">{shortScore}%</strong>
            </span>
            <span>·</span>
            <span>
              Full: <strong className="text-foreground font-mono">{descScore}%</strong>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r, i) => (
              <span
                key={i}
                className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground font-medium"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(pair.id)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title="Dismiss from current review session"
        >
          <XCircle className="size-3.5" /> Dismiss
        </button>
      </div>

      {/* Side-by-Side Product Cards */}
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Product A */}
        <ProductComparisonColumn
          product={productA}
          sharedShortWords={sharedShortWords}
          sharedDescWords={sharedDescWords}
          renderHighlightedText={renderHighlightedText}
          actionLoadingId={actionLoadingId}
          onToggleActive={onToggleActive}
          onTrash={onTrash}
        />

        {/* Product B */}
        <ProductComparisonColumn
          product={productB}
          sharedShortWords={sharedShortWords}
          sharedDescWords={sharedDescWords}
          renderHighlightedText={renderHighlightedText}
          actionLoadingId={actionLoadingId}
          onToggleActive={onToggleActive}
          onTrash={onTrash}
        />
      </div>
    </div>
  );
}

interface ProductComparisonColumnProps {
  product: CatalogProduct;
  sharedShortWords: Set<string>;
  sharedDescWords: Set<string>;
  renderHighlightedText: (text?: string | null, words?: Set<string>) => React.ReactNode;
  actionLoadingId: string | null;
  onToggleActive: (prod: CatalogProduct) => Promise<void>;
  onTrash: (prod: CatalogProduct) => Promise<void>;
}

function ProductComparisonColumn({
  product,
  sharedShortWords,
  sharedDescWords,
  renderHighlightedText,
  actionLoadingId,
  onToggleActive,
  onTrash,
}: ProductComparisonColumnProps) {
  const thumb = firstImage(product as unknown as AdminRow);
  const isToggling = actionLoadingId === `toggle-${product.id}`;
  const isTrashing = actionLoadingId === `trash-${product.id}`;

  return (
    <div className="flex flex-col justify-between p-5 space-y-4">
      <div>
        {/* Product Identity */}
        <div className="flex items-start gap-3">
          {thumb ? (
            <img
              src={thumb}
              alt={product.name}
              className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs text-muted-foreground">
              No image
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                  product.active ? "text-emerald-400" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    product.active ? "bg-emerald-400" : "bg-muted-foreground"
                  }`}
                />
                {product.active ? "Active" : "Inactive"}
              </span>
              {product.featured && (
                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                  Featured
                </span>
              )}
            </div>

            <h4 className="mt-1 font-semibold text-foreground line-clamp-1" title={product.name}>
              {product.name}
            </h4>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {product.categories?.name && <span>{product.categories.name}</span>}
              {product.price != null && (
                <>
                  <span>·</span>
                  <span className="font-mono text-foreground font-semibold">
                    {formatPrice(product.price, product.currency || "INR")}
                  </span>
                </>
              )}
              {product.retailer && (
                <>
                  <span>·</span>
                  <span>{product.retailer}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Short Description */}
        <div className="mt-4">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Short Description
          </span>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-xs leading-relaxed text-foreground">
            {renderHighlightedText(product.short_description, sharedShortWords)}
          </div>
        </div>

        {/* Full Description */}
        <div className="mt-3">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Full Description Snippet
          </span>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-xs leading-relaxed text-foreground">
            {renderHighlightedText(
              product.description?.slice(0, 450) +
                (product.description && product.description.length > 450 ? "…" : ""),
              sharedDescWords,
            )}
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1.5">
          <Link
            to="/admin/products/edit/$id"
            params={{ id: product.id }}
            className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1 text-xs"}
          >
            <Pencil className="size-3" /> Edit
          </Link>
          <a
            href={`/product/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={
              buttonVariants({ variant: "ghost", size: "sm" }) +
              " gap-1 text-xs text-muted-foreground"
            }
          >
            <ExternalLink className="size-3" /> View
          </a>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggleActive(product)}
            disabled={isToggling}
            className={`text-xs gap-1 ${
              product.active
                ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            }`}
          >
            {isToggling ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Power className="size-3" />
            )}
            {product.active ? "Deactivate" : "Activate"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onTrash(product)}
            disabled={isTrashing}
            className="text-xs text-muted-foreground hover:text-destructive gap-1"
          >
            {isTrashing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Trash2 className="size-3" />
            )}
            Trash
          </Button>
        </div>
      </div>
    </div>
  );
}
