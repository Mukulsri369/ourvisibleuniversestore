import type {
  PersistenceError,
  StorePageDraftRecord,
  StorePageRecord,
} from "../persistence/index";
import type { PageDocument } from "../schema/page-document";
import type { StudioSaveDraftInput, StudioSaveDraftOutcome } from "../studio/studio-persistence";
import type { StudioAutosaveStatus } from "./autosave-state";
import {
  advanceLocalGeneration,
  createInitialRevisionTrackingState,
  markGenerationSubmitted,
  reconcileConfirmedSaveGeneration,
  type RevisionTrackingState,
} from "./revision-tracking";
import { classifySaveFailure, computeRetryBackoffDelayMs } from "./save-errors";
import {
  completeInFlightSaveTicket,
  createInitialSaveQueueState,
  enqueueOrBeginSaveTicket,
  type SaveQueueState,
} from "./save-queue";

export interface AutosaveCoordinatorConfig {
  readonly enabled: boolean;
  readonly debounceMs: number;
  readonly maxWaitMs: number;
  readonly maxRetries: number;
  readonly baseRetryDelayMs: number;
  readonly pageKey: string;
  readonly slug: string;
  readonly storeScope: string;
}

export const DEFAULT_AUTOSAVE_CONFIG: AutosaveCoordinatorConfig = {
  enabled: true,
  debounceMs: 1800,
  maxWaitMs: 8000,
  maxRetries: 3,
  baseRetryDelayMs: 1500,
  pageKey: "home",
  slug: "/",
  storeScope: "default",
};

export interface AutosaveCoordinatorSnapshot {
  readonly status: StudioAutosaveStatus;
  readonly persistedDocument: PageDocument;
  readonly workingDocument: PageDocument;
  readonly isDirty: boolean;
  readonly tracking: RevisionTrackingState;
  readonly isOnline: boolean;
  readonly isInteractionActive: boolean;
  readonly retryAttempt: number;
  readonly totalSaveRequestsSent: number;
  readonly lastSavedAt: string | null;
  readonly error: PersistenceError | null;
  readonly validationError: string | null;
  readonly pageRecord: StorePageRecord | null;
  readonly draftRecord: StorePageDraftRecord | null;
}

export type SaveDraftExecutor = (input: StudioSaveDraftInput) => Promise<StudioSaveDraftOutcome>;

/**
 * Disciplined, revision-aware Autosave & Save Coordinator (Prompt 13, Parts 10–14).
 *
 * Guarantees:
 * 1. Trailing debounce (`debounceMs`) + bounded `maxWaitMs` for sustained editing.
 * 2. Defers autosave while an active continuous interaction (slider drag, color scrub) is open.
 * 3. Single-flight save execution: never sends concurrent competing writes for the same draft.
 * 4. Generation-aware reconciliation: if a user edits during an in-flight save, the older save's
 *    response updates `serverDraftRevision` and `persistedDocument` without clearing `isDirty`,
 *    and automatically schedules saving the newer generation with the updated revision.
 * 5. Conflict safety: `DRAFT_REVISION_CONFLICT` halts automatic retries immediately and preserves
 *    the user's unsaved work and history in memory.
 * 6. Offline & transient failure handling: preserves work locally, transitions to `"offline"` or
 *    `"error"`, and supports bounded exponential backoff retries + manual retry.
 */
export class AutosaveCoordinator {
  private config: AutosaveCoordinatorConfig;
  private executeSave: SaveDraftExecutor;
  private listeners = new Set<(snapshot: AutosaveCoordinatorSnapshot) => void>();

  private status: StudioAutosaveStatus = "loading";
  private persistedDocument: PageDocument;
  private workingDocument: PageDocument;
  private tracking: RevisionTrackingState;
  private queue: SaveQueueState = createInitialSaveQueueState();

  private isOnline: boolean = true;
  private isInteractionActive: boolean = false;
  private retryAttempt: number = 0;
  private totalSaveRequestsSent: number = 0;
  private lastSavedAt: string | null = null;
  private error: PersistenceError | null = null;
  private validationError: string | null = null;
  private pageRecord: StorePageRecord | null = null;
  private draftRecord: StorePageDraftRecord | null = null;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed: boolean = false;

  constructor(params: {
    readonly initialDocument: PageDocument;
    readonly executeSave: SaveDraftExecutor;
    readonly config?: Partial<AutosaveCoordinatorConfig>;
    readonly isOnline?: boolean;
  }) {
    this.config = {
      ...DEFAULT_AUTOSAVE_CONFIG,
      ...params.config,
    };
    this.executeSave = params.executeSave;
    this.isOnline = params.isOnline ?? true;
    this.persistedDocument = structuredClone(params.initialDocument);
    this.workingDocument = structuredClone(params.initialDocument);
    this.tracking = createInitialRevisionTrackingState({
      persistedDocument: this.persistedDocument,
      workingDocument: this.workingDocument,
      storeScope: this.config.storeScope,
      pageKey: this.config.pageKey,
    });
  }

  public subscribe(listener: (snapshot: AutosaveCoordinatorSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): AutosaveCoordinatorSnapshot {
    return {
      status: this.status,
      persistedDocument: this.persistedDocument,
      workingDocument: this.workingDocument,
      isDirty: this.tracking.hasUnsavedChanges,
      tracking: this.tracking,
      isOnline: this.isOnline,
      isInteractionActive: this.isInteractionActive,
      retryAttempt: this.retryAttempt,
      totalSaveRequestsSent: this.totalSaveRequestsSent,
      lastSavedAt: this.lastSavedAt,
      error: this.error,
      validationError: this.validationError,
      pageRecord: this.pageRecord,
      draftRecord: this.draftRecord,
    };
  }

  /**
   * Initializes or resets the coordinator from a verified server draft load.
   * Respects `forceReload` vs background refresh so unsaved local work is never overwritten
   * by a background query refetch (Prompt 13, Part 12, Section 40).
   */
  public initializeFromLoadedDraft(params: {
    readonly persistedDocument: PageDocument;
    readonly workingDocument?: PageDocument;
    readonly draftRevision: number;
    readonly publishedRevision: number;
    readonly isPublishedLive: boolean;
    readonly lastSavedAt: string | null;
    readonly pageRecord: StorePageRecord | null;
    readonly draftRecord: StorePageDraftRecord | null;
    readonly error: PersistenceError | null;
    readonly forceOverwriteUnsaved?: boolean;
  }): boolean {
    if (
      !params.forceOverwriteUnsaved &&
      this.status !== "loading" &&
      this.tracking.hasUnsavedChanges
    ) {
      return false;
    }

    this.clearTimers();
    this.retryAttempt = 0;
    this.persistedDocument = params.persistedDocument;
    this.workingDocument = params.workingDocument ?? params.persistedDocument;
    this.tracking = createInitialRevisionTrackingState({
      persistedDocument: this.persistedDocument,
      workingDocument: this.workingDocument,
      serverDraftRevision: params.draftRevision,
      basePublishedRevision: params.publishedRevision,
      isPublishedLive: params.isPublishedLive,
      storeScope: this.config.storeScope,
      pageKey: this.config.pageKey,
    });
    this.lastSavedAt = params.lastSavedAt;
    this.pageRecord = params.pageRecord;
    this.draftRecord = params.draftRecord;
    this.error = params.error;
    this.validationError = null;
    this.status = params.error
      ? "error"
      : this.tracking.hasUnsavedChanges
        ? this.isOnline
          ? "unsaved"
          : "offline"
        : "saved";

    this.emit();
    return true;
  }

  /**
   * Updates the working document after a validated structural edit, property edit, or Undo/Redo.
   * Schedules debounced autosave only if the document content substantively changed.
   */
  public notifyWorkingDocumentChanged(
    nextWorkingDocument: PageDocument,
    options?: {
      readonly isTransientInteraction?: boolean;
      readonly scheduleAutosave?: boolean;
    },
  ): void {
    if (this.disposed) return;

    const prevChecksum = this.tracking.workingDocumentChecksum;
    this.workingDocument = nextWorkingDocument;
    this.isInteractionActive = Boolean(options?.isTransientInteraction);
    this.tracking = advanceLocalGeneration(this.tracking, nextWorkingDocument);
    this.validationError = null;

    // If the document content did not substantively change (e.g. no-op), do nothing
    if (this.tracking.workingDocumentChecksum === prevChecksum && !options?.isTransientInteraction) {
      return;
    }

    // If the user undid changes back to the exact confirmed persisted document, clear pending timers and mark saved
    if (!this.tracking.hasUnsavedChanges) {
      this.clearTimers();
      this.retryAttempt = 0;
      if (this.queue.inFlight === null) {
        this.error = null;
        this.status = "saved";
      }
      this.emit();
      return;
    }

    // Document has unsaved changes
    this.retryAttempt = 0;
    if (this.queue.inFlight !== null) {
      // A save is already in flight; mark that a newer generation exists so follow-up runs
      this.queue = {
        ...this.queue,
        hasQueuedFollowUp: true,
      };
      this.status = "saving";
      this.emit();
      return;
    }

    if (this.status !== "conflict") {
      this.error = null;
      this.status = this.isOnline ? "unsaved" : "offline";
    }

    const shouldSchedule = options?.scheduleAutosave ?? this.config.enabled;
    if (shouldSchedule && !this.isInteractionActive && this.status !== "conflict") {
      this.scheduleDebouncedAutosave();
    } else if (this.isInteractionActive) {
      // Defer debounce timer while slider/pointer interaction is open, but keep maxWait safeguard
      this.clearDebounceTimerOnly();
      if (shouldSchedule && this.status !== "conflict") {
        this.ensureMaxWaitTimer();
      }
    }

    this.emit();
  }

  /**
   * Notifies the coordinator that an active continuous interaction (slider drag, color scrub)
   * has started or completed (Prompt 13, Part 10, Section 33).
   */
  public setInteractionActive(active: boolean): void {
    if (this.disposed || this.isInteractionActive === active) return;
    this.isInteractionActive = active;

    if (!active && this.tracking.hasUnsavedChanges && this.config.enabled) {
      if (this.status !== "conflict" && this.queue.inFlight === null) {
        this.scheduleDebouncedAutosave();
      }
    } else if (active) {
      this.clearDebounceTimerOnly();
    }

    this.emit();
  }

  public setValidationError(validationError: string | null): void {
    this.validationError = validationError;
    if (validationError) {
      this.status = "validation_error";
    } else if (this.queue.inFlight !== null) {
      this.status = "saving";
    } else {
      this.status = this.tracking.hasUnsavedChanges
        ? this.isOnline
          ? "unsaved"
          : "offline"
        : "saved";
    }
    this.emit();
  }

  public dismissError(): void {
    this.error = null;
    this.validationError = null;
    this.status =
      this.queue.inFlight !== null
        ? "saving"
        : this.tracking.hasUnsavedChanges
          ? this.isOnline
            ? "unsaved"
            : "offline"
          : "saved";
    this.emit();
  }

  /**
   * Updates network connectivity state and triggers a safe retry when connectivity returns
   * while unsaved changes are waiting (Prompt 13, Part 14, Section 45).
   */
  public setOnlineStatus(online: boolean): void {
    if (this.disposed || this.isOnline === online) return;
    this.isOnline = online;

    if (!online) {
      this.clearTimers();
      if (this.tracking.hasUnsavedChanges && this.queue.inFlight === null) {
        this.status = "offline";
      }
      this.emit();
      return;
    }

    // Returned online
    if (this.tracking.hasUnsavedChanges && this.status !== "conflict") {
      this.retryAttempt = 0;
      this.error = null;
      this.status = "unsaved";
      if (this.config.enabled && !this.isInteractionActive) {
        this.scheduleDebouncedAutosave(300);
      }
    }
    this.emit();
  }

  /**
   * Reverts the working document back to the last confirmed `persistedDocument`.
   */
  public revertToPersistedDocument(): PageDocument {
    this.clearTimers();
    this.retryAttempt = 0;
    this.error = null;
    this.validationError = null;
    const restored = structuredClone(this.persistedDocument);
    this.workingDocument = restored;
    this.tracking = advanceLocalGeneration(this.tracking, restored);
    this.status = "saved";
    this.emit();
    return restored;
  }

  /**
   * Immediately executes a manual Save Draft or Retry Save (Prompt 13, Part 10, Section 31 & Part 14, Section 47).
   */
  public async saveNow(options?: { readonly forceEvenIfClean?: boolean }): Promise<boolean> {
    if (this.disposed) return false;
    this.clearTimers();
    this.retryAttempt = 0;

    if (
      !options?.forceEvenIfClean &&
      !this.tracking.hasUnsavedChanges &&
      this.tracking.serverDraftRevision > 0
    ) {
      this.status = "saved";
      this.emit();
      return true;
    }

    return this.dispatchSaveRequest({ isManual: true });
  }

  public dispose(): void {
    this.disposed = true;
    this.clearTimers();
    this.listeners.clear();
  }

  private scheduleDebouncedAutosave(customDelayMs?: number): void {
    this.clearDebounceTimerOnly();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const delay = customDelayMs ?? this.config.debounceMs;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.disposed || this.isInteractionActive) return;
      if (!this.isOnline) {
        this.status = "offline";
        this.emit();
        return;
      }
      if (this.tracking.hasUnsavedChanges && this.status !== "conflict") {
        void this.dispatchSaveRequest({ isManual: false });
      }
    }, delay);

    this.ensureMaxWaitTimer();
  }

  private ensureMaxWaitTimer(): void {
    if (this.maxWaitTimer !== null || this.config.maxWaitMs <= 0) return;
    this.maxWaitTimer = setTimeout(() => {
      this.maxWaitTimer = null;
      if (this.disposed) return;
      // Do not persist a transient mid-drag state; if interaction is still active, wait until commit
      if (this.isInteractionActive) {
        this.ensureMaxWaitTimer();
        return;
      }
      if (this.isOnline && this.tracking.hasUnsavedChanges && this.status !== "conflict") {
        this.clearDebounceTimerOnly();
        void this.dispatchSaveRequest({ isManual: false });
      }
    }, this.config.maxWaitMs);
  }

  private scheduleRetrySave(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const delayMs = computeRetryBackoffDelayMs(
      this.retryAttempt,
      this.config.baseRetryDelayMs,
    );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.disposed || !this.isOnline) return;
      if (this.tracking.hasUnsavedChanges && this.status !== "conflict") {
        void this.dispatchSaveRequest({ isManual: false });
      }
    }, delayMs);
  }

  private async dispatchSaveRequest(params: { readonly isManual: boolean }): Promise<boolean> {
    this.clearTimers();

    if (!this.isOnline && !params.isManual) {
      this.status = "offline";
      this.emit();
      return false;
    }

    const enqueued = enqueueOrBeginSaveTicket(this.queue, {
      submittedGeneration: this.tracking.localGeneration,
      submittedChecksum: this.tracking.workingDocumentChecksum,
      submittedDocument: this.workingDocument,
      expectedDraftRevision: this.tracking.serverDraftRevision,
      isManual: params.isManual,
    });

    this.queue = enqueued.queue;
    if (!enqueued.startedNewTicket || !enqueued.ticket) {
      this.emit();
      return false;
    }

    const ticket = enqueued.ticket;
    this.totalSaveRequestsSent += 1;
    this.tracking = markGenerationSubmitted(this.tracking, ticket.submittedGeneration);
    this.status = "saving";
    this.error = null;
    this.validationError = null;
    this.emit();

    let outcome: StudioSaveDraftOutcome;
    try {
      outcome = await this.executeSave({
        workingDocument: ticket.submittedDocument,
        expectedDraftRevision: ticket.expectedDraftRevision,
        pageKey: this.config.pageKey,
        slug: this.config.slug,
        title: ticket.submittedDocument.name || "Storefront Homepage",
      });
    } catch (unexpectedErr) {
      const classified = classifySaveFailure(unexpectedErr, {
        expectedDraftRevision: ticket.expectedDraftRevision,
        isBrowserOnline: this.isOnline,
      });
      outcome = {
        ok: false,
        persistedDocument: this.persistedDocument,
        draftRevision: ticket.expectedDraftRevision,
        publishedRevision: this.tracking.basePublishedRevision,
        savedAt: null,
        pageRecord: this.pageRecord,
        draftRecord: this.draftRecord,
        error: classified.error,
      };
    }

    if (this.disposed) return false;

    const completion = completeInFlightSaveTicket(this.queue, ticket.requestId);
    this.queue = completion.queue;
    if (!completion.matchedInFlight) {
      return false;
    }

    if (outcome.ok) {
      this.retryAttempt = 0;
      const reconciled = reconcileConfirmedSaveGeneration(this.tracking, {
        submittedGeneration: ticket.submittedGeneration,
        confirmedDocument: outcome.persistedDocument,
        confirmedDraftRevision: outcome.draftRevision,
        confirmedPublishedRevision: outcome.publishedRevision,
      });

      this.tracking = reconciled.tracking;
      if (!reconciled.isStaleGenerationResponse) {
        this.persistedDocument = outcome.persistedDocument;
        this.lastSavedAt = outcome.savedAt;
        this.pageRecord = outcome.pageRecord ?? this.pageRecord;
        this.draftRecord = outcome.draftRecord ?? this.draftRecord;
      }

      if (reconciled.stillHasUnsavedChanges) {
        // Newer local edits occurred while this save was in flight!
        // Keep status as unsaved and schedule/run follow-up save with the updated server revision.
        this.status = this.isOnline ? "unsaved" : "offline";
        this.error = null;
        this.emit();

        if (completion.followUpIsManual) {
          return this.dispatchSaveRequest({ isManual: true });
        }
        if (this.config.enabled && !this.isInteractionActive && this.isOnline) {
          this.scheduleDebouncedAutosave();
        }
        return true;
      }

      this.status = "saved";
      this.error = null;
      this.emit();
      return true;
    }

    // Save failed: classify error
    const classified = classifySaveFailure(outcome.error, {
      expectedDraftRevision: ticket.expectedDraftRevision,
      isBrowserOnline: this.isOnline,
    });

    this.error = classified.error;

    if (classified.category === "conflict") {
      // HALT automatic retries on revision conflict so another admin's draft is never overwritten
      this.clearTimers();
      this.retryAttempt = 0;
      this.status = "conflict";
      this.emit();
      return false;
    }

    if (classified.isOfflineLikely) {
      this.isOnline = false;
      this.status = "offline";
      this.emit();
      return false;
    }

    this.status = classified.targetStatus;
    if (
      classified.canAutoRetry &&
      this.isOnline &&
      this.retryAttempt < this.config.maxRetries &&
      this.tracking.hasUnsavedChanges
    ) {
      this.retryAttempt += 1;
      this.scheduleRetrySave();
    }

    this.emit();
    return false;
  }

  private clearDebounceTimerOnly(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearDebounceTimerOnly();
    if (this.maxWaitTimer !== null) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private emit(): void {
    if (this.disposed) return;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
