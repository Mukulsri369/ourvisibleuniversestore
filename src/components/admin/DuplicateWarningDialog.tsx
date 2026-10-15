import { useState } from "react";
import { AlertTriangle, ExternalLink, ArrowRight, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/store";
import { firstImage } from "@/lib/admin-queries";
import { type DuplicateMatch, findSharedKeywords } from "@/lib/duplicate-detector";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: DuplicateMatch[];
  candidate: {
    name: string;
    short_description: string;
    description: string;
    imageUrl?: string;
  };
  onProceedAnyway: () => void;
  onCancelAndEdit: () => void;
  isPublishing?: boolean;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  matches,
  candidate,
  onProceedAnyway,
  onCancelAndEdit,
  isPublishing = false,
}: DuplicateWarningDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!matches || matches.length === 0) return null;

  const currentMatch = matches[selectedIndex] || matches[0];
  const matchedProd = currentMatch.product;

  const sharedShortWords = findSharedKeywords(
    candidate.short_description,
    matchedProd.short_description,
  );
  const sharedDescWords = findSharedKeywords(candidate.description, matchedProd.description);

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

  const existingThumb = firstImage(
    matchedProd as unknown as import("@/lib/admin-queries").AdminRow,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-amber-500/30 bg-background/95 p-6 backdrop-blur sm:rounded-2xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Duplicate Product Detected
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
                Our background verification detected {matches.length}{" "}
                {matches.length === 1 ? "existing product" : "existing products"} with identical or
                highly similar descriptions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Multiple Matches Navigator if > 1 */}
        {matches.length > 1 && (
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/40 p-2 text-xs">
            <span className="font-medium text-muted-foreground">
              Duplicate Match {selectedIndex + 1} of {matches.length}
            </span>
            <div className="flex gap-1.5">
              {matches.map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    selectedIndex === idx
                      ? "bg-amber-500 text-black shadow-sm"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  #{idx + 1} ({m.overallScore}%)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Score & Match Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Similarity Score
              </span>
              <span className="font-mono text-2xl font-bold text-amber-400">
                {currentMatch.overallScore}%
              </span>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="flex flex-col text-xs">
              <span className="font-medium text-foreground">
                {currentMatch.exactShortMatch && currentMatch.exactDescMatch
                  ? "Exact Match (Short & Full Descriptions)"
                  : currentMatch.exactShortMatch
                    ? "Exact Match (Short Description)"
                    : currentMatch.exactDescMatch
                      ? "Exact Match (Full Description)"
                      : "High Text Similarity"}
              </span>
              <span className="text-muted-foreground">
                Short: {currentMatch.shortScore}% · Full: {currentMatch.descScore}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {currentMatch.reasons.map((r, i) => (
              <span
                key={i}
                className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/20"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Candidate Product (Left) */}
          <div className="flex flex-col rounded-xl border border-border/80 bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Candidate (Being Published)
              </span>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                New Entry
              </span>
            </div>

            <div className="flex items-start gap-3">
              {candidate.imageUrl ? (
                <img
                  src={candidate.imageUrl}
                  alt={candidate.name}
                  className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
                  No img
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold text-foreground" title={candidate.name}>
                  {candidate.name || "Untitled Product"}
                </h4>
                <p className="text-xs text-muted-foreground">Draft ready to publish</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="block font-medium text-muted-foreground mb-1">
                  Short Description
                </span>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-2.5 leading-relaxed text-foreground">
                  {renderHighlightedText(candidate.short_description, sharedShortWords)}
                </div>
              </div>

              <div>
                <span className="block font-medium text-muted-foreground mb-1">
                  Full Description Snippet
                </span>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border/50 bg-secondary/30 p-2.5 leading-relaxed text-foreground">
                  {renderHighlightedText(
                    candidate.description?.slice(0, 450) +
                      (candidate.description && candidate.description.length > 450 ? "…" : ""),
                    sharedDescWords,
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Matched Product (Right) */}
          <div className="flex flex-col rounded-xl border border-amber-500/30 bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Existing Product in Catalog
              </span>
              <a
                href={`/admin/products/edit/${matchedProd.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Open in Editor <ExternalLink className="size-3" />
              </a>
            </div>

            <div className="flex items-start gap-3">
              {existingThumb ? (
                <img
                  src={existingThumb}
                  alt={matchedProd.name}
                  className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
                  No img
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold text-foreground" title={matchedProd.name}>
                  {matchedProd.name}
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {matchedProd.categories?.name && <span>{matchedProd.categories.name}</span>}
                  {matchedProd.price != null && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-foreground font-medium">
                        {formatPrice(matchedProd.price, matchedProd.currency || "INR")}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      matchedProd.active ? "text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        matchedProd.active ? "bg-emerald-400" : "bg-muted-foreground"
                      }`}
                    />
                    {matchedProd.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="block font-medium text-muted-foreground mb-1">
                  Short Description
                </span>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-2.5 leading-relaxed text-foreground">
                  {renderHighlightedText(matchedProd.short_description, sharedShortWords)}
                </div>
              </div>

              <div>
                <span className="block font-medium text-muted-foreground mb-1">
                  Full Description Snippet
                </span>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border/50 bg-secondary/30 p-2.5 leading-relaxed text-foreground">
                  {renderHighlightedText(
                    matchedProd.description?.slice(0, 450) +
                      (matchedProd.description && matchedProd.description.length > 450 ? "…" : ""),
                    sharedDescWords,
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex flex-col-reverse items-center justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Highlighted words indicate identical or overlapping text patterns.
          </p>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onCancelAndEdit}
              className="text-xs font-medium"
            >
              Cancel & Modify Text
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={onProceedAnyway}
              disabled={isPublishing}
              className="bg-amber-600 text-xs font-semibold text-white hover:bg-amber-500"
            >
              {isPublishing ? "Publishing..." : "Proceed & Publish Anyway"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
