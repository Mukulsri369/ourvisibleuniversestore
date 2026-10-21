import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "../homepage/default-homepage-document";
import type { StudioPointerInteractionMode, StudioSelectionSource } from "../interactions/index";
import type { PersistenceError, StorePageDraftRecord, StorePageRecord } from "../persistence/index";
import type { RenderMode } from "../rendering/RenderContext";
import type { PageDocument } from "../schema/page-document";
import { isDocumentDirty } from "./studio-document";
import type { StudioDraftInitializationSource } from "./studio-persistence";
import {
  STUDIO_DEVICE_PRESETS,
  type StudioDevicePreset,
  type StudioZoomMode,
} from "./studio-viewport";

export type StudioInspectorTab = "content" | "layout" | "appearance" | "responsive";

export type StudioPersistenceStatus =
  "loading" | "saved" | "unsaved" | "saving" | "error" | "conflict";

export type StudioMobileDrawer = "none" | "layers" | "inspector";

/**
 * 1. Persisted & Working Document State (Part 11, Section 27)
 */
export interface StudioDocumentState {
  readonly persistedDocument: PageDocument;
  readonly workingDocument: PageDocument;
  readonly isDirty: boolean;
}

/**
 * 2. Editor UI & Viewport State (Part 11, Section 27 & Prompt 10 Part 3, Section 7)
 */
export interface StudioUIState {
  readonly selectedNodeId: string | null;
  readonly hoveredNodeId: string | null;
  readonly previousSelectedNodeId: string | null;
  readonly selectionSource: StudioSelectionSource;
  readonly interactionMode: StudioPointerInteractionMode;
  readonly activeInspectorTab: StudioInspectorTab;
  readonly expandedLayerIds: ReadonlySet<string>;
  readonly layerSearchQuery: string;
  readonly devicePreset: StudioDevicePreset;
  readonly viewportWidthPx: number;
  readonly zoomMode: StudioZoomMode;
  readonly zoomPercent: number;
  readonly renderMode: Extract<RenderMode, "editor" | "preview">;
  readonly leftPanelCollapsed: boolean;
  readonly rightPanelCollapsed: boolean;
  readonly mobileActiveDrawer: StudioMobileDrawer;
  readonly showRulers: boolean;
}

/**
 * 3. Persistence Lifecycle State (Part 11, Section 27)
 */
export interface StudioPersistenceState {
  readonly status: StudioPersistenceStatus;
  readonly initializationSource: StudioDraftInitializationSource | null;
  readonly draftRevision: number;
  readonly publishedRevision: number;
  readonly isPublishedLive: boolean;
  readonly lastSavedAt: string | null;
  readonly error: PersistenceError | null;
  readonly validationError: string | null;
  readonly pageRecord: StorePageRecord | null;
  readonly draftRecord: StorePageDraftRecord | null;
}

export function createInitialStudioDocumentState(
  initialDoc: PageDocument = DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
): StudioDocumentState {
  const cloned = structuredClone(initialDoc);
  return {
    persistedDocument: cloned,
    workingDocument: structuredClone(initialDoc),
    isDirty: false,
  };
}

export function createInitialStudioUIState(): StudioUIState {
  return {
    selectedNodeId: CANONICAL_HOMEPAGE_NODE_IDS.planetHero,
    hoveredNodeId: null,
    previousSelectedNodeId: null,
    selectionSource: "initial",
    interactionMode: "idle",
    activeInspectorTab: "content",
    expandedLayerIds: new Set<string>([CANONICAL_HOMEPAGE_NODE_IDS.dynamicCategories]),
    layerSearchQuery: "",
    devicePreset: "desktop",
    viewportWidthPx: STUDIO_DEVICE_PRESETS.desktop.widthPx,
    zoomMode: "manual",
    zoomPercent: 100,
    renderMode: "editor",
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    mobileActiveDrawer: "none",
    showRulers: true,
  };
}

export function createInitialStudioPersistenceState(): StudioPersistenceState {
  return {
    status: "loading",
    initializationSource: null,
    draftRevision: 0,
    publishedRevision: 0,
    isPublishedLive: false,
    lastSavedAt: null,
    error: null,
    validationError: null,
    pageRecord: null,
    draftRecord: null,
  };
}

export function applyWorkingDocumentUpdate(
  currentDocState: StudioDocumentState,
  currentPersistenceState: StudioPersistenceState,
  nextWorkingDocument: PageDocument,
): {
  documentState: StudioDocumentState;
  persistenceState: StudioPersistenceState;
} {
  const dirty = isDocumentDirty(nextWorkingDocument, currentDocState.persistedDocument);
  const nextStatus: StudioPersistenceStatus =
    currentPersistenceState.status === "saving" ? "saving" : dirty ? "unsaved" : "saved";

  return {
    documentState: {
      ...currentDocState,
      workingDocument: nextWorkingDocument,
      isDirty: dirty,
    },
    persistenceState: {
      ...currentPersistenceState,
      status: nextStatus,
      validationError: null,
    },
  };
}
