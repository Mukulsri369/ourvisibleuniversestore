import type { PageDocument } from "../schema/page-document";

export interface InFlightSaveTicket {
  readonly requestId: number;
  readonly submittedGeneration: number;
  readonly submittedChecksum: string;
  readonly submittedDocument: PageDocument;
  readonly expectedDraftRevision: number;
  readonly isManual: boolean;
  readonly startedAt: number;
}

export interface SaveQueueState {
  readonly nextRequestId: number;
  readonly inFlight: InFlightSaveTicket | null;
  readonly hasQueuedFollowUp: boolean;
  readonly queuedFollowUpIsManual: boolean;
}

export function createInitialSaveQueueState(): SaveQueueState {
  return {
    nextRequestId: 1,
    inFlight: null,
    hasQueuedFollowUp: false,
    queuedFollowUpIsManual: false,
  };
}

/**
 * Checks whether an identical document checksum is already in flight so duplicate
 * concurrent requests are never dispatched (Prompt 13, Part 12, Section 39 & Part 25, Section 84).
 */
export function isChecksumAlreadyInFlight(
  queue: SaveQueueState,
  candidateChecksum: string,
): boolean {
  return queue.inFlight !== null && queue.inFlight.submittedChecksum === candidateChecksum;
}

export function enqueueOrBeginSaveTicket(
  queue: SaveQueueState,
  params: {
    readonly submittedGeneration: number;
    readonly submittedChecksum: string;
    readonly submittedDocument: PageDocument;
    readonly expectedDraftRevision: number;
    readonly isManual: boolean;
    readonly timestamp?: number;
  },
): {
  readonly startedNewTicket: boolean;
  readonly ticket: InFlightSaveTicket | null;
  readonly queue: SaveQueueState;
} {
  if (queue.inFlight !== null) {
    // If the exact same checksum is already being saved, do not queue a duplicate unless manual
    if (queue.inFlight.submittedChecksum === params.submittedChecksum && !params.isManual) {
      return {
        startedNewTicket: false,
        ticket: null,
        queue,
      };
    }

    return {
      startedNewTicket: false,
      ticket: null,
      queue: {
        ...queue,
        hasQueuedFollowUp: true,
        queuedFollowUpIsManual: queue.queuedFollowUpIsManual || params.isManual,
      },
    };
  }

  const ticket: InFlightSaveTicket = {
    requestId: queue.nextRequestId,
    submittedGeneration: params.submittedGeneration,
    submittedChecksum: params.submittedChecksum,
    submittedDocument: params.submittedDocument,
    expectedDraftRevision: params.expectedDraftRevision,
    isManual: params.isManual,
    startedAt: params.timestamp ?? Date.now(),
  };

  return {
    startedNewTicket: true,
    ticket,
    queue: {
      nextRequestId: queue.nextRequestId + 1,
      inFlight: ticket,
      hasQueuedFollowUp: false,
      queuedFollowUpIsManual: false,
    },
  };
}

export function completeInFlightSaveTicket(
  queue: SaveQueueState,
  completedRequestId: number,
): {
  readonly matchedInFlight: boolean;
  readonly completedTicket: InFlightSaveTicket | null;
  readonly shouldRunFollowUp: boolean;
  readonly followUpIsManual: boolean;
  readonly queue: SaveQueueState;
} {
  if (!queue.inFlight || queue.inFlight.requestId !== completedRequestId) {
    return {
      matchedInFlight: false,
      completedTicket: null,
      shouldRunFollowUp: false,
      followUpIsManual: false,
      queue,
    };
  }

  const completed = queue.inFlight;
  const shouldFollowUp = queue.hasQueuedFollowUp;
  const isManual = queue.queuedFollowUpIsManual;

  return {
    matchedInFlight: true,
    completedTicket: completed,
    shouldRunFollowUp: shouldFollowUp,
    followUpIsManual: isManual,
    queue: {
      ...queue,
      inFlight: null,
      hasQueuedFollowUp: false,
      queuedFollowUpIsManual: false,
    },
  };
}
