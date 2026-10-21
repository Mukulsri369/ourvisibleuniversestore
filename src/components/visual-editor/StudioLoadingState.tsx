import React from "react";
import { Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

export interface StudioLoadingStateProps {
  message?: string;
  subMessage?: string;
}

export function StudioLoadingState({
  message = "Loading Store Design Studio…",
  subMessage = "Resolving storefront configuration, authorized draft state, and live product catalog.",
}: StudioLoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="studio-loading-state"
      className="flex h-screen w-full flex-col items-center justify-center bg-background px-6 text-center text-foreground"
    >
      <div className="flex max-w-md flex-col items-center gap-4">
        <Loader2 className="size-7 animate-spin text-primary" />
        <div className="space-y-1.5">
          <h1 className="font-sans text-base font-semibold tracking-tight">{message}</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">{subMessage}</p>
        </div>
      </div>
    </div>
  );
}

export interface StudioAccessErrorStateProps {
  title: string;
  message: string;
  onReturnToAdmin?: () => void;
  onRetry?: () => void;
}

export function StudioAccessErrorState({
  title,
  message,
  onReturnToAdmin,
  onRetry,
}: StudioAccessErrorStateProps) {
  return (
    <div
      role="alert"
      data-testid="studio-access-error-state"
      className="flex h-screen w-full flex-col items-center justify-center bg-background px-6 text-center text-foreground"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-left">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="space-y-2">
            <h1 className="font-sans text-base font-semibold text-foreground">{title}</h1>
            <p className="text-xs leading-relaxed text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-border pt-4">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-border bg-secondary/70 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Retry
            </button>
          )}
          {onReturnToAdmin && (
            <button
              type="button"
              onClick={onReturnToAdmin}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Return to Admin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface StudioInlineErrorBannerProps {
  message: string;
  conflictDetails?: string;
  onReloadDraft?: () => void;
  onDismiss?: () => void;
}

export function StudioInlineErrorBanner({
  message,
  conflictDetails,
  onReloadDraft,
  onDismiss,
}: StudioInlineErrorBannerProps) {
  return (
    <div
      role="alert"
      data-testid="studio-error-banner"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-foreground"
    >
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0 text-destructive" />
        <span>{message}</span>
        {conflictDetails && (
          <span className="font-mono text-[11px] text-muted-foreground">· {conflictDetails}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onReloadDraft && (
          <button
            type="button"
            onClick={onReloadDraft}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
          >
            Reload Latest Draft
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
