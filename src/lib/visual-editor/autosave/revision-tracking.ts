import { computeDocumentContentFingerprint } from "../history/history-transactions";
import { DEFAULT_STORE_SCOPE } from "../persistence/index";
import type { PageDocument } from "../schema/page-document";

/**
 * Tracks exact local edit generations alongside confirmed server draft and published revisions
 * (Prompt 13, Part 11, Section 37 & Part 12, Sections 38–40).
 */
export interface RevisionTrackingState {
  readonly storeScope: string;
  readonly pageKey: string;
  readonly documentId: string;
  readonly localGeneration: number;
  readonly lastSubmittedGeneration: number;
  readonly lastSavedGeneration: number;
  readonly serverDraftRevision: number;
  readonly basePublishedRevision: number;
  readonly isPublishedLive: boolean;
  readonly persistedDocumentChecksum: string;
  readonly workingDocumentChecksum: string;
  readonly hasUnsavedChanges: boolean;
}

export function createInitialRevisionTrackingState(params: {
  readonly persistedDocument: PageDocument;
  readonly workingDocument?: PageDocument;
  readonly serverDraftRevision?: number;
  readonly basePublishedRevision?: number;
  readonly isPublishedLive?: boolean;
  readonly storeScope?: string;
  readonly pageKey?: string;
}): RevisionTrackingState {
  const workingDoc = params.workingDocument ?? params.persistedDocument;
  const persistedChecksum = computeDocumentContentFingerprint(params.persistedDocument);
  const workingChecksum = computeDocumentContentFingerprint(workingDoc);
  const hasUnsaved = workingChecksum !== persistedChecksum;

  return {
    storeScope: params.storeScope ?? DEFAULT_STORE_SCOPE,
    pageKey: params.pageKey ?? "home",
    documentId: workingDoc.id,
    localGeneration: hasUnsaved ? 1 : 0,
    lastSubmittedGeneration: 0,
    lastSavedGeneration: 0,
    serverDraftRevision: params.serverDraftRevision ?? 0,
    basePublishedRevision: params.basePublishedRevision ?? 0,
    isPublishedLive: Boolean(params.isPublishedLive),
    persistedDocumentChecksum: persistedChecksum,
    workingDocumentChecksum: workingChecksum,
    hasUnsavedChanges: hasUnsaved,
  };
}

/**
 * Advances local generation tracking when `workingDocument` is updated locally
 * (including via Undo or Redo).
 *
 * Notice:
 * - If the user undoes changes all the way back to the confirmed `persistedDocument`,
 *   `workingDocumentChecksum === persistedDocumentChecksum`, so `hasUnsavedChanges`
 *   becomes `false` automatically (Prompt 13, Part 16, Section 53).
 * - If the user undoes after an autosave has already persisted a newer state,
 *   `workingDocumentChecksum !== persistedDocumentChecksum`, so `hasUnsavedChanges`
 *   becomes `true` and schedules saving the restored state (Prompt 13, Part 17, Section 56).
 */
export function advanceLocalGeneration(
  tracking: RevisionTrackingState,
  nextWorkingDocument: PageDocument,
): RevisionTrackingState {
  const nextChecksum = computeDocumentContentFingerprint(nextWorkingDocument);
  if (nextChecksum === tracking.workingDocumentChecksum) {
    return tracking;
  }

  const nextGeneration = tracking.localGeneration + 1;
  const hasUnsaved = nextChecksum !== tracking.persistedDocumentChecksum;

  return {
    ...tracking,
    documentId: nextWorkingDocument.id,
    localGeneration: nextGeneration,
    workingDocumentChecksum: nextChecksum,
    hasUnsavedChanges: hasUnsaved,
  };
}

/**
 * Marks that a save request for `submittedGeneration` has been dispatched.
 */
export function markGenerationSubmitted(
  tracking: RevisionTrackingState,
  submittedGeneration: number,
): RevisionTrackingState {
  if (submittedGeneration <= tracking.lastSubmittedGeneration) {
    return tracking;
  }
  return {
    ...tracking,
    lastSubmittedGeneration: submittedGeneration,
  };
}

/**
 * Reconciles a confirmed server save response against the current local working state
 * (Prompt 13, Part 12, Sections 38–39).
 *
 * Crucial Race-Condition Invariant:
 * - If the user made newer edits (`tracking.localGeneration > submittedGeneration` and
 *   `tracking.workingDocumentChecksum !== confirmedChecksum`) while the save was in flight:
 *   1. `serverDraftRevision` STILL updates to `confirmedDraftRevision` so the next save
 *      uses the latest server revision instead of failing with a self-conflict.
 *   2. `persistedDocumentChecksum` updates to `confirmedChecksum`.
 *   3. `hasUnsavedChanges` REMAINS `true` because generation `11` is not yet persisted!
 */
export function reconcileConfirmedSaveGeneration(
  tracking: RevisionTrackingState,
  confirmed: {
    readonly submittedGeneration: number;
    readonly confirmedDocument: PageDocument;
    readonly confirmedDraftRevision: number;
    readonly confirmedPublishedRevision?: number;
  },
): {
  readonly tracking: RevisionTrackingState;
  readonly isStaleGenerationResponse: boolean;
  readonly stillHasUnsavedChanges: boolean;
} {
  // Ignore out-of-order responses that are older than an already confirmed save
  if (
    confirmed.submittedGeneration < tracking.lastSavedGeneration ||
    confirmed.confirmedDraftRevision < tracking.serverDraftRevision
  ) {
    return {
      tracking,
      isStaleGenerationResponse: true,
      stillHasUnsavedChanges: tracking.hasUnsavedChanges,
    };
  }

  const confirmedChecksum = computeDocumentContentFingerprint(confirmed.confirmedDocument);
  const stillHasUnsaved = tracking.workingDocumentChecksum !== confirmedChecksum;

  const updated: RevisionTrackingState = {
    ...tracking,
    lastSavedGeneration: Math.max(tracking.lastSavedGeneration, confirmed.submittedGeneration),
    lastSubmittedGeneration: Math.max(
      tracking.lastSubmittedGeneration,
      confirmed.submittedGeneration,
    ),
    serverDraftRevision: confirmed.confirmedDraftRevision,
    basePublishedRevision: confirmed.confirmedPublishedRevision ?? tracking.basePublishedRevision,
    persistedDocumentChecksum: confirmedChecksum,
    hasUnsavedChanges: stillHasUnsaved,
  };

  return {
    tracking: updated,
    isStaleGenerationResponse: false,
    stillHasUnsavedChanges: stillHasUnsaved,
  };
}

/**
 * Guards against background query refetches overwriting newer unsaved local work
 * (Prompt 13, Part 12, Section 40).
 */
export function canAcceptBackgroundServerDraft(
  tracking: RevisionTrackingState,
  incomingServerRevision: number,
  options?: { readonly forceReload?: boolean },
): boolean {
  if (options?.forceReload) {
    return true;
  }
  if (tracking.hasUnsavedChanges) {
    return false;
  }
  return incomingServerRevision >= tracking.serverDraftRevision;
}
