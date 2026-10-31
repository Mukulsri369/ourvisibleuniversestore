import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getStorePageById,
  listPageVersions,
  PersistenceError,
  type PersistenceDatabaseAdapter,
  type StorePageRecord,
  type StorePageVersionMetadata,
} from "@/lib/visual-editor/persistence";
import { publishPageDraft, restorePublishedVersion } from "@/lib/visual-editor/publishing";

export interface StudioPublishingProps {
  page: StorePageRecord | null;
  draftRevision: number;
  isDirty: boolean;
  disabled?: boolean;
  adapter?: PersistenceDatabaseAdapter;
  onPublished: (page: StorePageRecord, action: "publish" | "restore") => void;
}
export function StudioPublishing({
  page,
  draftRevision,
  isDirty,
  disabled = false,
  adapter,
  onPublished,
}: StudioPublishingProps) {
  const client = useQueryClient(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState(""),
    [offset, setOffset] = useState(0),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null),
    [restoring, setRestoring] = useState<StorePageVersionMetadata | null>(null);
  const history = useQuery({
    queryKey: ["admin", "design-history", page?.id, page?.publishedRevision, offset],
    enabled: open && Boolean(page),
    queryFn: () => listPageVersions({ pageId: page!.id, limit: 20, offset, adapter }),
    retry: false,
  });
  async function completed(updated: StorePageRecord, action: "publish" | "restore") {
    onPublished(updated, action);
    setOffset(0);
    setNotes("");
    setRestoring(null);
    setMessage(
      action === "publish"
        ? "Your saved draft is now published."
        : "The selected version is now published. Your saved draft is unchanged.",
    );
    await Promise.all([
      client.invalidateQueries({ queryKey: ["storefront", "published-page"] }),
      client.invalidateQueries({ queryKey: ["admin", "design-history", updated.id] }),
    ]);
  }
  function showError(value: unknown) {
    setError(
      value instanceof PersistenceError
        ? value.publicMessage
        : "The action could not be completed. Refresh the status and try again.",
    );
  }
  async function publish() {
    if (!page || isDirty || disabled || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await publishPageDraft(
        {
          pageId: page.id,
          expectedDraftRevision: draftRevision,
          expectedPublishedRevision: page.publishedRevision,
          releaseNotes: notes.trim() || null,
        },
        { adapter },
      );
      if (!result.ok) throw result.error;
      await completed(result.page, "publish");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!page || !restoring || disabled || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await restorePublishedVersion(
        {
          pageId: page.id,
          targetVersionId: restoring.id,
          expectedPublishedRevision: page.publishedRevision,
          syncDraftToRestoredVersion: false,
          releaseNotes: notes.trim() || null,
        },
        { adapter },
      );
      if (!result.ok) throw result.error;
      await completed(result.page, "restore");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
      setRestoring(null);
    }
  }
  async function refresh() {
    if (!page || busy) return;
    setBusy(true);
    setError(null);
    try {
      const latest = await getStorePageById(page.id, { adapter });
      if (latest) onPublished(latest, "restore");
      await history.refetch();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            data-testid="studio-publishing-open"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/40 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            <span>Publish &amp; history</span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Publish storefront design</DialogTitle>
            <DialogDescription>
              Publish a saved draft or restore a previous published design.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-lg border border-border bg-secondary/40 p-3 text-sm"
            >
              {message}
            </p>
          )}
          {!page ? (
            <p className="text-sm text-muted-foreground">
              Save a draft first to start publishing and version history.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  Saved draft {draftRevision} · Published revision {page.publishedRevision}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void refresh()}
                >
                  Refresh status
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="studio-release-notes">Release notes (optional)</Label>
                <Textarea
                  id="studio-release-notes"
                  value={notes}
                  maxLength={1000}
                  disabled={busy}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe this update"
                />
              </div>
              {isDirty && (
                <p className="text-sm text-muted-foreground">
                  Save your current edits before publishing.
                </p>
              )}
              <Button
                type="button"
                disabled={busy || disabled || isDirty || draftRevision < 1}
                onClick={() => void publish()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Publish saved draft
              </Button>
              <section
                className="space-y-3 border-t border-border pt-4"
                aria-label="Published design versions"
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <History className="size-4" />
                  Version history
                </h3>
                {history.isPending ? (
                  <p className="text-sm text-muted-foreground">Loading versions…</p>
                ) : history.isError ? (
                  <div>
                    <p role="alert" className="text-sm text-destructive">
                      Version history could not be loaded.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
                      Retry history
                    </Button>
                  </div>
                ) : (
                  <>
                    {!history.data.items.length && (
                      <p className="text-sm text-muted-foreground">
                        No design has been published yet.
                      </p>
                    )}
                    <ul className="space-y-2">
                      {history.data.items.map((version) => (
                        <li
                          key={version.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              Version {version.versionNumber}
                              {version.isCurrentPublished ? " · Currently published" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(version.createdAt).toLocaleString()}
                            </p>
                            {version.releaseNotes && (
                              <p className="mt-1 break-words text-sm text-muted-foreground">
                                {version.releaseNotes}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || version.isCurrentPublished}
                            onClick={() => setRestoring(version)}
                          >
                            Restore version {version.versionNumber}
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || offset === 0}
                        onClick={() => setOffset((n) => Math.max(0, n - 20))}
                      >
                        Newer versions
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {history.data.total} versions
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || offset + 20 >= history.data.total}
                        onClick={() => setOffset((n) => n + 20)}
                      >
                        Older versions
                      </Button>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(restoring)}
        onOpenChange={(value) => {
          if (!value && !busy) setRestoring(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {restoring?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This publishes the selected design as a new version. Your saved draft and unsaved
              edits stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void restore();
              }}
            >
              Confirm restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
