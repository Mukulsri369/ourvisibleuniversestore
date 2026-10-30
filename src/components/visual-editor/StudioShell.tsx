import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  categoriesQuery,
  homeQuery,
  settingsQuery,
  type Category,
  type HomeData,
  type Settings,
} from "@/lib/store";
import type { ElementGeometryMeasurement } from "@/lib/visual-editor/geometry";
import {
  hoverStudioTarget,
  resolveStudioKeyboardSelectionAction,
  restorePreviousStudioSelection,
  selectStudioTarget,
  syncSelectionWithDocument,
  type StudioSelectionSource,
} from "@/lib/visual-editor/interactions";
import type { PersistenceDatabaseAdapter } from "@/lib/visual-editor/persistence/index";
import type { SpacingBox } from "@/lib/visual-editor/schema/geometry";
import type { SafeComponentProps } from "@/lib/visual-editor/schema/nodes";
import type { EditorBreakpoint } from "@/lib/visual-editor/schema/responsive";
import {
  applyWorkingDocumentUpdate,
  areDocumentsContentEqual,
  canRedoHistory,
  canUndoHistory,
  classifySaveFailure,
  clearLocalDraftRecoverySnapshot,
  computeRetryBackoffDelayMs,
  createInitialHistoryState,
  createInitialStudioDocumentState,
  createInitialStudioPersistenceState,
  createInitialStudioUIState,
  executeStructuralCommandWithHistory,
  getAncestorLayerIdsForTarget,
  getNextRedoLabel,
  getNextUndoLabel,
  inferDevicePresetFromWidth,
  isDocumentDirty,
  loadStudioWorkspaceDraft,
  recordEditingTransaction,
  recordPropertyMutationInHistory,
  redoEditingTransaction,
  resetInspectorBreakpointOverrides,
  resetInspectorStyleProperty,
  resolveSelectedNodeContext,
  resolveStudioViewportState,
  saveLocalDraftRecoverySnapshot,
  saveStudioWorkspaceDraft,
  STUDIO_DEVICE_PRESETS,
  undoEditingTransaction,
  updateInspectorStyleProperty,
  updateStudioNodeAppearance,
  updateStudioNodeName,
  updateStudioNodeProp,
  updateStudioNodeSpacing,
  updateStudioNodeVisibility,
  type DraftRecoveryEvaluationResult,
  type HistoryActionType,
  type HistoryState,
  type InspectorStylePath,
  type StructuralCommand,
  type StructuralOperationResult,
  type StructuralUndoSnapshot,
  type StudioAppearancePatch,
  type StudioDevicePreset,
  type StudioDocumentState,
  type StudioInspectorTab,
  type StudioMobileDrawer,
  type StudioPersistenceState,
  type StudioUIState,
  type StudioZoomMode,
} from "@/lib/visual-editor/studio";
import { RecoveryDialog } from "./history";
import { StudioCanvas } from "./StudioCanvas";
import { StudioInspector } from "./StudioInspector";
import { StudioLayersPanel } from "./StudioLayersPanel";
import {
  StudioAccessErrorState,
  StudioInlineErrorBanner,
  StudioLoadingState,
} from "./StudioLoadingState";
import { StudioStatusBar } from "./StudioStatusBar";
import { StudioToolbar } from "./StudioToolbar";

export interface StudioShellProps {
  /** Session-scoped local recovery isolation; production route supplies the authenticated ID. */
  userScope?: string;
  /**
   * Optional persistence adapter override (used in integration tests; defaults to independent MariaDB transport).
   */
  persistenceAdapter?: PersistenceDatabaseAdapter;
  /**
   * Optional pre-resolved catalog data (used in deterministic tests; defaults to live TanStack Query hooks).
   */
  initialHomeData?: HomeData;
  initialCategories?: Category[];
  initialSettings?: Settings | null;
  onNavigateToAdmin?: () => void;
  /**
   * Optional autosave configuration (defaults to enabled with 1800ms debounce and 8000ms maxWait).
   */
  autosaveEnabled?: boolean;
  autosaveDebounceMs?: number;
  autosaveMaxWaitMs?: number;
  autosaveMaxRetries?: number;
  autosaveBaseRetryDelayMs?: number;
}

const EMPTY_HOME_DATA: HomeData = {
  featured: [],
  newest: [],
  festival: [],
  allProducts: [],
};

export function StudioShell({
  userScope = "admin",
  persistenceAdapter,
  initialHomeData,
  initialCategories,
  initialSettings,
  onNavigateToAdmin,
  autosaveEnabled = true,
  autosaveDebounceMs = 1800,
  autosaveMaxWaitMs = 8000,
  autosaveMaxRetries = 3,
  autosaveBaseRetryDelayMs = 1500,
}: StudioShellProps) {
  const queryClient = useQueryClient();

  if (initialSettings !== undefined && !queryClient.getQueryData(settingsQuery.queryKey)) {
    queryClient.setQueryData(settingsQuery.queryKey, initialSettings);
  }
  if (initialCategories !== undefined && !queryClient.getQueryData(categoriesQuery.queryKey)) {
    queryClient.setQueryData(categoriesQuery.queryKey, initialCategories);
  }
  if (initialHomeData !== undefined && !queryClient.getQueryData(homeQuery.queryKey)) {
    queryClient.setQueryData(homeQuery.queryKey, initialHomeData);
  }

  const homeQueryResult = useQuery({
    ...homeQuery,
    initialData: initialHomeData,
  });
  const categoriesQueryResult = useQuery({
    ...categoriesQuery,
    initialData: initialCategories,
  });
  const settingsQueryResult = useQuery({
    ...settingsQuery,
    initialData: initialSettings,
  });

  useEffect(() => {
    if (settingsQueryResult.data === undefined && !settingsQueryResult.isLoading) {
      queryClient.setQueryData(settingsQuery.queryKey, null);
    }
    if (categoriesQueryResult.data === undefined && !categoriesQueryResult.isLoading) {
      queryClient.setQueryData(categoriesQuery.queryKey, []);
    }
  }, [
    queryClient,
    settingsQueryResult.data,
    settingsQueryResult.isLoading,
    categoriesQueryResult.data,
    categoriesQueryResult.isLoading,
  ]);

  // 1. Separated State Slices (Document, History, UI, and Persistence)
  const [documentState, setDocumentState] = useState<StudioDocumentState>(() =>
    createInitialStudioDocumentState(),
  );
  const [historyState, setHistoryState] = useState<HistoryState>(() => createInitialHistoryState());
  const [uiState, setUiState] = useState<StudioUIState>(() => createInitialStudioUIState());
  const [persistenceState, setPersistenceState] = useState<StudioPersistenceState>(() =>
    createInitialStudioPersistenceState(),
  );
  const [availableCanvasWidthPx, setAvailableCanvasWidthPx] = useState<number>(1200);
  const [selectedGeometry, setSelectedGeometry] = useState<ElementGeometryMeasurement | null>(null);
  const [scrollRequestNodeId, setScrollRequestNodeId] = useState<{
    nodeId: string;
    seq: number;
  } | null>(null);
  const [showUnsavedExitConfirm, setShowUnsavedExitConfirm] = useState(false);
  const [lastUndoSnapshot, setLastUndoSnapshot] = useState<StructuralUndoSnapshot | null>(null);
  const [recoveryEvaluation, setRecoveryEvaluation] =
    useState<DraftRecoveryEvaluationResult | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

  // Refs for synchronous race-free save coordination
  const isSavingRef = useRef(false);
  const queuedSaveAfterInFlightRef = useRef<{ needed: boolean; isManual: boolean }>({
    needed: false,
    isManual: false,
  });
  const localGenerationRef = useRef(0);
  const lastSubmittedGenerationRef = useRef(0);
  const lastSavedGenerationRef = useRef(0);
  const latestWorkingDocumentRef = useRef(documentState.workingDocument);
  latestWorkingDocumentRef.current = documentState.workingDocument;
  const latestPersistedDocumentRef = useRef(documentState.persistedDocument);
  latestPersistedDocumentRef.current = documentState.persistedDocument;
  const latestDraftRevisionRef = useRef(persistenceState.draftRevision);
  latestDraftRevisionRef.current = persistenceState.draftRevision;
  const isOnlineRef = useRef<boolean>(
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true,
  );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutosaveTimers = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current !== null) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAutosaveTimers();
    };
  }, [clearAutosaveTimers]);

  // 2. Load Authorized Draft on Mount (Part 12, Section 29 & Prompt 13 Part 15, Section 48)
  const loadDraft = useCallback(
    async (options?: { forceOverwriteUnsaved?: boolean }) => {
      // Prevent background refetch from overwriting unsaved local work (Prompt 13, Part 12, Section 40)
      if (
        !options?.forceOverwriteUnsaved &&
        persistenceState.status !== "loading" &&
        !areDocumentsContentEqual(
          latestWorkingDocumentRef.current,
          latestPersistedDocumentRef.current,
        )
      ) {
        return;
      }

      clearAutosaveTimers();
      setPersistenceState((prev) => ({
        ...prev,
        status: "loading",
        error: null,
        validationError: null,
      }));

      const outcome = await loadStudioWorkspaceDraft({
        adapter: persistenceAdapter,
        userScope,
        pageKey: "home",
        pageSlug: "/",
      });

      localGenerationRef.current = 0;
      lastSubmittedGenerationRef.current = 0;
      lastSavedGenerationRef.current = 0;
      latestWorkingDocumentRef.current = outcome.workingDocument;
      latestPersistedDocumentRef.current = outcome.persistedDocument;
      latestDraftRevisionRef.current = outcome.draftRevision;

      setDocumentState({
        persistedDocument: outcome.persistedDocument,
        workingDocument: outcome.workingDocument,
        isDirty: false,
      });
      setHistoryState(createInitialHistoryState());
      setLastUndoSnapshot(null);

      const hasValidRecovery =
        outcome.recoveryEvaluation &&
        (outcome.recoveryEvaluation.status === "recoverable" ||
          outcome.recoveryEvaluation.status === "stale_against_server");

      setRecoveryEvaluation(outcome.recoveryEvaluation ?? null);
      setShowRecoveryDialog(
        Boolean(hasValidRecovery && outcome.recoveryEvaluation?.status === "recoverable"),
      );

      setPersistenceState({
        status: outcome.error ? "error" : hasValidRecovery ? "recovery_available" : "saved",
        initializationSource: outcome.source,
        draftRevision: outcome.draftRevision,
        publishedRevision: outcome.publishedRevision,
        isPublishedLive: outcome.isPublishedLive,
        lastSavedAt: outcome.draftRecord?.updatedAt ?? null,
        error: outcome.error,
        validationError: null,
        pageRecord: outcome.pageRecord,
        draftRecord: outcome.draftRecord,
        localGeneration: 0,
        lastSubmittedGeneration: 0,
        lastSavedGeneration: 0,
        isOnline: isOnlineRef.current,
        retryAttempt: 0,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistenceAdapter, userScope, clearAutosaveTimers],
  );

  useEffect(() => {
    void loadDraft({ forceOverwriteUnsaved: true });
  }, [loadDraft]);

  // 2b. Track Browser Online/Offline Connectivity (Prompt 13, Part 14, Section 45)
  useEffect(() => {
    const handleOffline = () => {
      isOnlineRef.current = false;
      clearAutosaveTimers();
      setPersistenceState((prev) => ({
        ...prev,
        isOnline: false,
        status:
          !areDocumentsContentEqual(
            latestWorkingDocumentRef.current,
            latestPersistedDocumentRef.current,
          ) && prev.status !== "conflict"
            ? "offline"
            : prev.status,
      }));
    };

    const handleOnline = () => {
      isOnlineRef.current = true;
      setPersistenceState((prev) => {
        const dirty = !areDocumentsContentEqual(
          latestWorkingDocumentRef.current,
          latestPersistedDocumentRef.current,
        );
        return {
          ...prev,
          isOnline: true,
          retryAttempt: 0,
          error: prev.status === "offline" ? null : prev.error,
          status: prev.status === "conflict" ? "conflict" : dirty ? "unsaved" : "saved",
        };
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [clearAutosaveTimers]);

  // 3. Browser beforeunload & Scoped Local Recovery Checkpoint Protection (Prompt 13, Parts 15–16)
  useEffect(() => {
    if (!documentState.isDirty) {
      if (persistenceState.status === "saved") {
        clearLocalDraftRecoverySnapshot("home", { userScope });
      }
      return;
    }

    const latestTxLabel = getNextUndoLabel(historyState);
    saveLocalDraftRecoverySnapshot("home", documentState.workingDocument, {
      userScope,
      baseDraftRevision: persistenceState.draftRevision,
      lastTransactionLabel: latestTxLabel,
    });

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    documentState.isDirty,
    documentState.workingDocument,
    persistenceState.draftRevision,
    persistenceState.status,
    historyState,
    userScope,
  ]);

  // 4. Synchronize Selection State if workingDocument or renderMode changes
  useEffect(() => {
    setUiState((prev) => {
      const synced = syncSelectionWithDocument(
        {
          selectedNodeId: prev.selectedNodeId,
          hoveredNodeId: prev.hoveredNodeId,
          previousSelectedNodeId: prev.previousSelectedNodeId,
          selectionSource: prev.selectionSource,
          interactionMode: prev.interactionMode,
        },
        documentState.workingDocument,
        prev.renderMode,
      );
      if (
        synced.selectedNodeId === prev.selectedNodeId &&
        synced.hoveredNodeId === prev.hoveredNodeId &&
        synced.interactionMode === prev.interactionMode
      ) {
        return prev;
      }
      return {
        ...prev,
        selectedNodeId: synced.selectedNodeId,
        hoveredNodeId: synced.hoveredNodeId,
        interactionMode: synced.interactionMode,
      };
    });
  }, [documentState.workingDocument]);

  // 5. Resolved Viewport & Breakpoint (Strictly decoupled from Zoom)
  const resolvedViewport = useMemo(
    () =>
      resolveStudioViewportState({
        devicePreset: uiState.devicePreset,
        viewportWidthPx: uiState.viewportWidthPx,
        zoomMode: uiState.zoomMode,
        zoomPercent: uiState.zoomPercent,
        availableContainerWidthPx: availableCanvasWidthPx,
      }),
    [
      uiState.devicePreset,
      uiState.viewportWidthPx,
      uiState.zoomMode,
      uiState.zoomPercent,
      availableCanvasWidthPx,
    ],
  );

  const categories = useMemo(
    () => categoriesQueryResult.data ?? initialCategories ?? [],
    [categoriesQueryResult.data, initialCategories],
  );
  const homeData = homeQueryResult.data ?? initialHomeData ?? EMPTY_HOME_DATA;
  const settingsData =
    settingsQueryResult.data !== undefined ? settingsQueryResult.data : (initialSettings ?? null);

  // Collect all unique products across rails and catalog for runtime instance resolution
  const allKnownProducts = useMemo(() => {
    const byId = new Map<string, HomeData["allProducts"][number]>();
    for (const list of [
      homeData.allProducts,
      homeData.featured,
      homeData.newest,
      homeData.festival,
    ]) {
      for (const item of list ?? []) {
        if (item?.id && !byId.has(item.id)) {
          byId.set(item.id, item);
        }
      }
    }
    return Array.from(byId.values());
  }, [homeData]);

  // 6. Resolved Selection Context for Inspector & Overlay
  const selectedContext = useMemo(
    () =>
      resolveSelectedNodeContext(
        documentState.workingDocument,
        uiState.selectedNodeId,
        categories,
        undefined,
        allKnownProducts,
      ),
    [documentState.workingDocument, uiState.selectedNodeId, categories, allKnownProducts],
  );

  const hoveredContext = useMemo(
    () =>
      resolveSelectedNodeContext(
        documentState.workingDocument,
        uiState.hoveredNodeId,
        categories,
        undefined,
        allKnownProducts,
      ),
    [documentState.workingDocument, uiState.hoveredNodeId, categories, allKnownProducts],
  );

  // 7. Centralized Selection & Hover Controller Handlers
  const handleSelectNode = useCallback(
    (
      nodeId: string | null,
      options?: { scrollIntoView?: boolean; source?: StudioSelectionSource },
    ) => {
      const source: StudioSelectionSource = options?.source ?? "programmatic";

      setUiState((prev) => {
        const nextSel = selectStudioTarget(
          {
            selectedNodeId: prev.selectedNodeId,
            hoveredNodeId: prev.hoveredNodeId,
            previousSelectedNodeId: prev.previousSelectedNodeId,
            selectionSource: prev.selectionSource,
            interactionMode: prev.interactionMode,
          },
          latestWorkingDocumentRef.current,
          nodeId,
          source,
          prev.renderMode,
        );

        const ancestorsToExpand = getAncestorLayerIdsForTarget(
          latestWorkingDocumentRef.current,
          nextSel.selectedNodeId,
        );
        let nextExpanded = prev.expandedLayerIds;
        if (ancestorsToExpand.some((id) => !prev.expandedLayerIds.has(id))) {
          const updatedSet = new Set(prev.expandedLayerIds);
          for (const ancId of ancestorsToExpand) {
            updatedSet.add(ancId);
          }
          nextExpanded = updatedSet;
        }

        if (
          nextSel.selectedNodeId === prev.selectedNodeId &&
          nextSel.selectionSource === prev.selectionSource &&
          nextExpanded === prev.expandedLayerIds
        ) {
          return prev;
        }

        return {
          ...prev,
          selectedNodeId: nextSel.selectedNodeId,
          previousSelectedNodeId: nextSel.previousSelectedNodeId,
          selectionSource: nextSel.selectionSource,
          expandedLayerIds: nextExpanded,
        };
      });

      if (nodeId && options?.scrollIntoView) {
        setScrollRequestNodeId((prev) => ({
          nodeId,
          seq: (prev?.seq ?? 0) + 1,
        }));
      }
    },
    [],
  );

  const handleHoverNode = useCallback((nodeId: string | null) => {
    setUiState((prev) => {
      const nextHov = hoverStudioTarget(
        {
          selectedNodeId: prev.selectedNodeId,
          hoveredNodeId: prev.hoveredNodeId,
          previousSelectedNodeId: prev.previousSelectedNodeId,
          selectionSource: prev.selectionSource,
          interactionMode: prev.interactionMode,
        },
        latestWorkingDocumentRef.current,
        nodeId,
        prev.renderMode,
      );
      if (
        nextHov.hoveredNodeId === prev.hoveredNodeId &&
        nextHov.interactionMode === prev.interactionMode
      ) {
        return prev;
      }
      return {
        ...prev,
        hoveredNodeId: nextHov.hoveredNodeId,
        interactionMode: nextHov.interactionMode,
      };
    });
  }, []);

  const handleCanvasSelect = useCallback(
    (id: string | null, source?: StudioSelectionSource) =>
      handleSelectNode(id, { source: source ?? "canvas_click" }),
    [handleSelectNode],
  );

  const handleToggleExpandLayer = useCallback((nodeId: string) => {
    setUiState((prev) => {
      const nextSet = new Set(prev.expandedLayerIds);
      if (nextSet.has(nodeId)) {
        nextSet.delete(nodeId);
      } else {
        nextSet.add(nodeId);
      }
      return {
        ...prev,
        expandedLayerIds: nextSet,
      };
    });
  }, []);

  const handleExpandAllLayers = useCallback((layerIds: readonly string[]) => {
    setUiState((prev) => {
      const nextSet = new Set(prev.expandedLayerIds);
      for (const id of layerIds) {
        nextSet.add(id);
      }
      return {
        ...prev,
        expandedLayerIds: nextSet,
      };
    });
  }, []);

  const handleCollapseAllLayers = useCallback(() => {
    setUiState((prev) => ({
      ...prev,
      expandedLayerIds: new Set<string>(),
    }));
  }, []);

  // 8. Unified Authoritative Editing Transaction Pipeline (Prompt 13, Part 3, Section 7)
  const applyCommittedDocumentChange = useCallback(
    (nextWorkingDocument: StudioDocumentState["workingDocument"]) => {
      localGenerationRef.current += 1;
      latestWorkingDocumentRef.current = nextWorkingDocument;

      if (isSavingRef.current) {
        queuedSaveAfterInFlightRef.current = {
          needed: true,
          isManual: queuedSaveAfterInFlightRef.current.isManual,
        };
      }

      setDocumentState((prevDoc) => {
        const next = applyWorkingDocumentUpdate(prevDoc, persistenceState, nextWorkingDocument);
        setPersistenceState({
          ...next.persistenceState,
          localGeneration: localGenerationRef.current,
          retryAttempt: 0,
        });
        return next.documentState;
      });
    },
    [persistenceState],
  );

  const commitPropertyMutationWithHistory = useCallback(
    (
      result: { ok: boolean; document: StudioDocumentState["workingDocument"]; error?: string },
      meta: {
        targetNodeId: string;
        actionType: HistoryActionType;
        propertyPath: string;
        breakpoint?: EditorBreakpoint;
        isReset?: boolean;
        customLabel?: string;
        allowCoalesce?: boolean;
      },
    ) => {
      if (!result.ok) {
        setPersistenceState((prev) => ({
          ...prev,
          validationError: result.error ?? "Invalid property update.",
        }));
        return;
      }

      if (result.document === documentState.workingDocument) {
        return;
      }

      setHistoryState((prevHistory) => {
        const recorded = recordPropertyMutationInHistory(
          prevHistory,
          documentState.workingDocument,
          result,
          {
            ...meta,
            currentSelectedNodeId: uiState.selectedNodeId,
          },
        );
        return recorded.historyState;
      });

      setLastUndoSnapshot(null);
      applyCommittedDocumentChange(result.document);
    },
    [documentState.workingDocument, uiState.selectedNodeId, applyCommittedDocumentChange],
  );

  const handleUpdateNodeName = useCallback(
    (selectedId: string, newName: string) => {
      const res = updateStudioNodeName(documentState.workingDocument, selectedId, newName);
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: "structural.rename",
        propertyPath: "name",
        customLabel: `Rename Layer to "${newName.trim()}"`,
        allowCoalesce: true,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  const handleUpdateNodeVisibility = useCallback(
    (selectedId: string, visible: boolean, bp?: EditorBreakpoint) => {
      const res = updateStudioNodeVisibility(
        documentState.workingDocument,
        selectedId,
        visible,
        bp,
      );
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: "structural.visibility",
        propertyPath: "visible",
        breakpoint: bp,
        customLabel: `${visible ? "Show" : "Hide"} ${bp && bp !== "desktop" ? `${bp === "mobile" ? "Mobile " : "Tablet "}` : ""}Component`,
        allowCoalesce: false,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  const handleUpdateNodeProp = useCallback(
    <K extends keyof SafeComponentProps>(
      selectedId: string,
      propKey: K,
      value: SafeComponentProps[K],
    ) => {
      const res = updateStudioNodeProp(documentState.workingDocument, selectedId, propKey, value);
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: "property.content",
        propertyPath: String(propKey),
        customLabel: `Change ${String(propKey)}`,
        allowCoalesce: true,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  const handleUpdateNodeSpacing = useCallback(
    (
      selectedId: string,
      field: "padding" | "margin",
      box: SpacingBox | undefined,
      bp?: EditorBreakpoint,
    ) => {
      const res = updateStudioNodeSpacing(
        documentState.workingDocument,
        selectedId,
        field,
        box,
        bp,
      );
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: box === undefined ? "property.reset" : "property.spacing",
        propertyPath: `geometry.${field}`,
        breakpoint: bp,
        isReset: box === undefined,
        allowCoalesce: box !== undefined,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  const handleUpdateNodeAppearance = useCallback(
    (selectedId: string, patch: StudioAppearancePatch, bp?: EditorBreakpoint) => {
      const res = updateStudioNodeAppearance(documentState.workingDocument, selectedId, patch, bp);
      const propertyPath =
        "backgroundColor" in patch
          ? "appearance.backgroundColor"
          : "cornerRadiusPx" in patch
            ? "shape.cornerRadius"
            : "appearance.opacity";
      const isReset =
        patch.backgroundColor === null || patch.cornerRadiusPx === null || patch.opacity === null;
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: isReset ? "property.reset" : "property.appearance",
        propertyPath,
        breakpoint: bp,
        isReset,
        allowCoalesce: !isReset,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  const handleUpdateStyleProperty = useCallback(
    (
      selectedId: string,
      path: InspectorStylePath | string,
      value: unknown,
      bp?: EditorBreakpoint,
    ) => {
      const res = updateInspectorStyleProperty(
        documentState.workingDocument,
        selectedId,
        path,
        value,
        bp,
      );
      const isReset = value === null || value === undefined;
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: isReset ? "property.reset" : "property.style",
        propertyPath: String(path),
        breakpoint: bp,
        isReset,
        allowCoalesce: !isReset,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  const handleResetStyleProperty = useCallback(
    (selectedId: string, path: InspectorStylePath | string, bp?: EditorBreakpoint) => {
      const res = resetInspectorStyleProperty(documentState.workingDocument, selectedId, path, bp);
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: "property.reset",
        propertyPath: String(path),
        breakpoint: bp,
        isReset: true,
        allowCoalesce: false,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  const handleResetBreakpointOverrides = useCallback(
    (selectedId: string, bp: EditorBreakpoint) => {
      const res = resetInspectorBreakpointOverrides(documentState.workingDocument, selectedId, bp);
      commitPropertyMutationWithHistory(res, {
        targetNodeId: selectedId,
        actionType: "property.reset_breakpoint",
        propertyPath: `responsive.${bp}`,
        breakpoint: bp,
        isReset: true,
        customLabel: `Reset ${bp === "mobile" ? "Mobile" : "Tablet"} Overrides`,
        allowCoalesce: false,
      });
    },
    [documentState.workingDocument, commitPropertyMutationWithHistory],
  );

  // 8b. Centralized Structural Command Dispatcher Connected to History (Prompt 11 & Prompt 13 Part 18)
  const handleExecuteStructuralCommand = useCallback(
    (command: StructuralCommand): StructuralOperationResult => {
      const { operationResult: res, historyState: nextHistoryState } =
        executeStructuralCommandWithHistory(
          historyState,
          documentState.workingDocument,
          command,
          uiState.selectedNodeId,
        );

      if (!res.ok) {
        setPersistenceState((prev) => ({
          ...prev,
          validationError: res.message ?? "Structural operation rejected.",
        }));
        return res;
      }

      if (res.document === documentState.workingDocument) {
        return res;
      }

      setHistoryState(nextHistoryState);

      if (res.undoSnapshot) {
        setLastUndoSnapshot(res.undoSnapshot);
      } else {
        setLastUndoSnapshot(null);
      }

      applyCommittedDocumentChange(res.document);

      const shouldUpdateSelection =
        res.selectedNodeId !== undefined &&
        (command.type === "DuplicateNode" ||
          command.type === "WrapNodeInContainer" ||
          command.type === "CreateContainer" ||
          command.type === "RemoveNode" ||
          command.type === "UnwrapContainer");

      if ((res.expandLayerIds && res.expandLayerIds.length > 0) || shouldUpdateSelection) {
        const idsToExpand = res.expandLayerIds ?? [];
        setUiState((prev) => {
          const nextExpanded = new Set(prev.expandedLayerIds);
          for (const id of idsToExpand) {
            nextExpanded.add(id);
          }

          if (!shouldUpdateSelection) {
            return {
              ...prev,
              expandedLayerIds: nextExpanded,
            };
          }

          const nextSel = selectStudioTarget(
            {
              selectedNodeId: prev.selectedNodeId,
              hoveredNodeId: prev.hoveredNodeId,
              previousSelectedNodeId: prev.previousSelectedNodeId,
              selectionSource: prev.selectionSource,
              interactionMode: prev.interactionMode,
            },
            res.document,
            res.selectedNodeId ?? null,
            "layer_tree",
            prev.renderMode,
          );

          const ancestorsToExpand = getAncestorLayerIdsForTarget(
            res.document,
            nextSel.selectedNodeId,
          );
          for (const ancId of ancestorsToExpand) {
            nextExpanded.add(ancId);
          }

          return {
            ...prev,
            selectedNodeId: nextSel.selectedNodeId,
            previousSelectedNodeId: nextSel.previousSelectedNodeId,
            selectionSource: nextSel.selectionSource,
            expandedLayerIds: nextExpanded,
          };
        });

        if (shouldUpdateSelection && res.selectedNodeId && command.type === "DuplicateNode") {
          const targetNodeId = res.selectedNodeId;
          setScrollRequestNodeId((prev) => ({
            nodeId: targetNodeId,
            seq: (prev?.seq ?? 0) + 1,
          }));
        }
      }

      return res;
    },
    [
      historyState,
      documentState.workingDocument,
      uiState.selectedNodeId,
      applyCommittedDocumentChange,
    ],
  );

  // 8c. Global Undo & Redo Handlers (Prompt 13, Parts 4, 5, 8 & 9)
  const handleUndo = useCallback(() => {
    const outcome = undoEditingTransaction(
      historyState,
      documentState.workingDocument,
      uiState.selectedNodeId,
    );
    if (!outcome.ok) {
      if (outcome.error && outcome.error.code !== "EMPTY_UNDO_STACK") {
        setPersistenceState((prev) => ({
          ...prev,
          validationError: outcome.error?.message ?? "Unable to undo.",
        }));
      }
      return;
    }

    setHistoryState(outcome.state);
    setLastUndoSnapshot(null);
    applyCommittedDocumentChange(outcome.document);

    setUiState((prev) => {
      const nextExpanded = new Set(prev.expandedLayerIds);
      for (const ancId of outcome.expandLayerIds) {
        nextExpanded.add(ancId);
      }
      const nextSel = selectStudioTarget(
        {
          selectedNodeId: prev.selectedNodeId,
          hoveredNodeId: prev.hoveredNodeId,
          previousSelectedNodeId: prev.previousSelectedNodeId,
          selectionSource: prev.selectionSource,
          interactionMode: prev.interactionMode,
        },
        outcome.document,
        outcome.selectedNodeId,
        "programmatic",
        prev.renderMode,
      );
      return {
        ...prev,
        selectedNodeId: nextSel.selectedNodeId,
        previousSelectedNodeId: nextSel.previousSelectedNodeId,
        selectionSource: nextSel.selectionSource,
        expandedLayerIds: nextExpanded,
      };
    });
  }, [
    historyState,
    documentState.workingDocument,
    uiState.selectedNodeId,
    applyCommittedDocumentChange,
  ]);

  const handleRedo = useCallback(() => {
    const outcome = redoEditingTransaction(
      historyState,
      documentState.workingDocument,
      uiState.selectedNodeId,
    );
    if (!outcome.ok) {
      if (outcome.error && outcome.error.code !== "EMPTY_REDO_STACK") {
        setPersistenceState((prev) => ({
          ...prev,
          validationError: outcome.error?.message ?? "Unable to redo.",
        }));
      }
      return;
    }

    setHistoryState(outcome.state);
    setLastUndoSnapshot(null);
    applyCommittedDocumentChange(outcome.document);

    setUiState((prev) => {
      const nextExpanded = new Set(prev.expandedLayerIds);
      for (const ancId of outcome.expandLayerIds) {
        nextExpanded.add(ancId);
      }
      const nextSel = selectStudioTarget(
        {
          selectedNodeId: prev.selectedNodeId,
          hoveredNodeId: prev.hoveredNodeId,
          previousSelectedNodeId: prev.previousSelectedNodeId,
          selectionSource: prev.selectionSource,
          interactionMode: prev.interactionMode,
        },
        outcome.document,
        outcome.selectedNodeId,
        "programmatic",
        prev.renderMode,
      );
      return {
        ...prev,
        selectedNodeId: nextSel.selectedNodeId,
        previousSelectedNodeId: nextSel.previousSelectedNodeId,
        selectionSource: nextSel.selectionSource,
        expandedLayerIds: nextExpanded,
      };
    });
  }, [
    historyState,
    documentState.workingDocument,
    uiState.selectedNodeId,
    applyCommittedDocumentChange,
  ]);

  const handleUndoLastStructuralRemoval = useCallback(() => {
    setLastUndoSnapshot(null);
    handleUndo();
  }, [handleUndo]);

  // 9. Disciplined Save Draft, Debounced Autosave & Race-Safe Persistence Coordinator
  const executeSaveOperation = useCallback(
    async (options?: { isManual?: boolean; isRetry?: boolean }): Promise<boolean> => {
      clearAutosaveTimers();

      const isManual = Boolean(options?.isManual);
      if (isSavingRef.current) {
        queuedSaveAfterInFlightRef.current = {
          needed: true,
          isManual: queuedSaveAfterInFlightRef.current.isManual || isManual,
        };
        return false;
      }

      if (!isOnlineRef.current && !isManual) {
        setPersistenceState((prev) => ({
          ...prev,
          isOnline: false,
          status: "offline",
        }));
        return false;
      }

      const submittedDoc = latestWorkingDocumentRef.current;
      const submittedGen = localGenerationRef.current;
      const expectedRev = latestDraftRevisionRef.current;

      // Avoid redundant network writes if already saved and not a forced manual initial save
      if (
        !isManual &&
        expectedRev > 0 &&
        areDocumentsContentEqual(submittedDoc, latestPersistedDocumentRef.current)
      ) {
        setPersistenceState((prev) => ({
          ...prev,
          status: "saved",
        }));
        return true;
      }

      isSavingRef.current = true;
      queuedSaveAfterInFlightRef.current = { needed: false, isManual: false };
      lastSubmittedGenerationRef.current = submittedGen;

      setPersistenceState((prev) => ({
        ...prev,
        status: "saving",
        error: null,
        validationError: null,
        lastSubmittedGeneration: submittedGen,
      }));

      try {
        const outcome = await saveStudioWorkspaceDraft(
          {
            workingDocument: submittedDoc,
            expectedDraftRevision: expectedRev,
            pageKey: "home",
            slug: "/",
            title: submittedDoc.name || "Storefront Homepage",
          },
          { adapter: persistenceAdapter, userScope },
        );

        isSavingRef.current = false;

        if (outcome.ok) {
          latestPersistedDocumentRef.current = outcome.persistedDocument;
          latestDraftRevisionRef.current = outcome.draftRevision;
          lastSavedGenerationRef.current = Math.max(lastSavedGenerationRef.current, submittedGen);

          const currentWorkingDoc = latestWorkingDocumentRef.current;
          const stillHasNewerChanges =
            localGenerationRef.current > submittedGen &&
            !areDocumentsContentEqual(currentWorkingDoc, outcome.persistedDocument);

          setDocumentState({
            persistedDocument: outcome.persistedDocument,
            workingDocument: currentWorkingDoc,
            isDirty: stillHasNewerChanges,
          });

          setPersistenceState((prev) => ({
            ...prev,
            status: stillHasNewerChanges ? (isOnlineRef.current ? "unsaved" : "offline") : "saved",
            draftRevision: outcome.draftRevision,
            publishedRevision: outcome.publishedRevision,
            lastSavedAt: outcome.savedAt,
            error: null,
            validationError: null,
            pageRecord: outcome.pageRecord,
            draftRecord: outcome.draftRecord,
            lastSavedGeneration: lastSavedGenerationRef.current,
            retryAttempt: 0,
          }));

          if (stillHasNewerChanges && queuedSaveAfterInFlightRef.current.isManual) {
            queuedSaveAfterInFlightRef.current = { needed: false, isManual: false };
            return executeSaveOperation({ isManual: true });
          }

          return true;
        }

        // Handle failure classification (conflict vs auth vs validation vs transient network)
        const classified = classifySaveFailure(outcome.error, {
          expectedDraftRevision: expectedRev,
          isBrowserOnline: isOnlineRef.current,
        });

        if (classified.category === "conflict") {
          clearAutosaveTimers();
          setPersistenceState((prev) => ({
            ...prev,
            status: "conflict",
            error: classified.error,
            retryAttempt: 0,
          }));
          return false;
        }

        if (classified.isOfflineLikely) {
          isOnlineRef.current = false;
          setPersistenceState((prev) => ({
            ...prev,
            isOnline: false,
            status: "offline",
            error: classified.error,
          }));
          return false;
        }

        setPersistenceState((prev) => {
          const nextAttempt = (prev.retryAttempt ?? 0) + 1;
          const canRetry =
            classified.canAutoRetry &&
            isOnlineRef.current &&
            nextAttempt <= autosaveMaxRetries &&
            !areDocumentsContentEqual(
              latestWorkingDocumentRef.current,
              latestPersistedDocumentRef.current,
            );

          if (canRetry) {
            const backoffMs = computeRetryBackoffDelayMs(nextAttempt, autosaveBaseRetryDelayMs);
            if (retryTimerRef.current !== null) {
              clearTimeout(retryTimerRef.current);
            }
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              void executeSaveOperation({ isManual: false, isRetry: true });
            }, backoffMs);
          }

          return {
            ...prev,
            status: "error",
            error: classified.error,
            retryAttempt: canRetry ? nextAttempt : (prev.retryAttempt ?? 0),
          };
        });

        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [clearAutosaveTimers, persistenceAdapter, autosaveMaxRetries, autosaveBaseRetryDelayMs],
  );

  const handleSaveDraft = useCallback(async () => {
    await executeSaveOperation({ isManual: true });
  }, [executeSaveOperation]);

  // 9b. Trailing Debounce & Max-Wait Autosave Scheduler (Prompt 13, Part 10, Sections 31–34)
  useEffect(() => {
    if (!autosaveEnabled) return;
    if (!documentState.isDirty) {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (maxWaitTimerRef.current !== null) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
      return;
    }

    if (
      persistenceState.status === "loading" ||
      persistenceState.status === "saving" ||
      persistenceState.status === "conflict" ||
      persistenceState.status === "error" ||
      persistenceState.status === "offline" ||
      !isOnlineRef.current
    ) {
      return;
    }

    // Do not persist while an active continuous interaction session is uncommitted
    if (historyState.activeInteraction !== null) {
      return;
    }

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void executeSaveOperation({ isManual: false });
    }, autosaveDebounceMs);

    if (maxWaitTimerRef.current === null && autosaveMaxWaitMs > 0) {
      maxWaitTimerRef.current = setTimeout(() => {
        maxWaitTimerRef.current = null;
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        void executeSaveOperation({ isManual: false });
      }, autosaveMaxWaitMs);
    }

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [
    autosaveEnabled,
    autosaveDebounceMs,
    autosaveMaxWaitMs,
    documentState.isDirty,
    documentState.workingDocument,
    persistenceState.status,
    historyState.activeInteraction,
    executeSaveOperation,
  ]);

  const handleResetWorkingDraft = useCallback(() => {
    clearAutosaveTimers();
    clearLocalDraftRecoverySnapshot("home", { userScope });
    setRecoveryEvaluation(null);
    setShowRecoveryDialog(false);

    const restoredDoc = structuredClone(documentState.persistedDocument);
    if (!isDocumentDirty(documentState.workingDocument, restoredDoc)) {
      return;
    }

    setHistoryState(
      (prevHistory) =>
        recordEditingTransaction(prevHistory, {
          actionType: "document.revert",
          label: "Revert to Saved Draft",
          affectedNodeIds: [],
          origin: "toolbar",
          previousDocument: documentState.workingDocument,
          nextDocument: restoredDoc,
          previousSelectionId: uiState.selectedNodeId,
          nextSelectionId: uiState.selectedNodeId,
          coalesceKey: null,
          allowCoalesce: false,
        }).state,
    );

    localGenerationRef.current += 1;
    latestWorkingDocumentRef.current = restoredDoc;

    setDocumentState((prev) => ({
      ...prev,
      workingDocument: restoredDoc,
      isDirty: false,
    }));
    setPersistenceState((prev) => ({
      ...prev,
      status: "saved",
      error: null,
      validationError: null,
      localGeneration: localGenerationRef.current,
      retryAttempt: 0,
    }));
  }, [
    clearAutosaveTimers,
    documentState.persistedDocument,
    documentState.workingDocument,
    uiState.selectedNodeId,
  ]);

  const handleRestoreRecoveryCheckpoint = useCallback(() => {
    if (
      !recoveryEvaluation ||
      (recoveryEvaluation.status !== "recoverable" &&
        recoveryEvaluation.status !== "stale_against_server")
    ) {
      return;
    }

    const recoveredDoc = structuredClone(recoveryEvaluation.checkpoint.document);
    setShowRecoveryDialog(false);
    setRecoveryEvaluation(null);

    setHistoryState(
      (prevHistory) =>
        recordEditingTransaction(prevHistory, {
          actionType: "document.batch",
          label: "Restore Unsaved Checkpoint",
          affectedNodeIds: [],
          origin: "toolbar",
          previousDocument: documentState.workingDocument,
          nextDocument: recoveredDoc,
          previousSelectionId: uiState.selectedNodeId,
          nextSelectionId: uiState.selectedNodeId,
          coalesceKey: null,
          allowCoalesce: false,
        }).state,
    );

    applyCommittedDocumentChange(recoveredDoc);
  }, [
    recoveryEvaluation,
    documentState.workingDocument,
    uiState.selectedNodeId,
    applyCommittedDocumentChange,
  ]);

  const handleDiscardRecoveryCheckpoint = useCallback(() => {
    clearLocalDraftRecoverySnapshot("home", { userScope });
    setShowRecoveryDialog(false);
    setRecoveryEvaluation(null);
    setPersistenceState((prev) => ({
      ...prev,
      status: documentState.isDirty ? "unsaved" : "saved",
    }));
  }, [documentState.isDirty]);

  const handleRequestReturnToAdmin = useCallback(() => {
    if (documentState.isDirty) {
      setShowUnsavedExitConfirm(true);
      return;
    }
    onNavigateToAdmin?.();
  }, [documentState.isDirty, onNavigateToAdmin]);

  // 10. Global Studio Keyboard Navigation (Selection, Save Draft, Undo, Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (uiState.renderMode !== "editor") return;

      const action = resolveStudioKeyboardSelectionAction(
        e,
        documentState.workingDocument,
        uiState.selectedNodeId,
        categories,
      );

      if (action.type === "none") return;

      if (action.type === "save_draft") {
        e.preventDefault();
        void handleSaveDraft();
        return;
      }

      if (action.type === "undo") {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (action.type === "redo") {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (action.type === "clear_selection") {
        e.preventDefault();
        handleSelectNode(null, { source: "keyboard" });
        return;
      }

      if (action.type === "select_target") {
        e.preventDefault();
        handleSelectNode(action.targetId, {
          scrollIntoView: action.scrollIntoView,
          source: "keyboard",
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    uiState.renderMode,
    uiState.selectedNodeId,
    documentState.workingDocument,
    categories,
    handleSaveDraft,
    handleUndo,
    handleRedo,
    handleSelectNode,
  ]);

  // 11. Authorization & Initial Loading Guards
  if (
    persistenceState.error &&
    (persistenceState.error.code === "UNAUTHORIZED" || persistenceState.error.code === "FORBIDDEN")
  ) {
    return (
      <StudioAccessErrorState
        title="Administrator Authorization Required"
        message={persistenceState.error.publicMessage}
        onReturnToAdmin={onNavigateToAdmin}
        onRetry={() => void loadDraft({ forceOverwriteUnsaved: true })}
      />
    );
  }

  const isCatalogInitializing =
    (settingsQueryResult.isLoading && initialSettings === undefined) ||
    (categoriesQueryResult.isLoading && initialCategories === undefined);

  if (persistenceState.status === "loading" || isCatalogInitializing) {
    return <StudioLoadingState />;
  }

  if (queryClient.getQueryData(settingsQuery.queryKey) === undefined) {
    queryClient.setQueryData(settingsQuery.queryKey, settingsData);
  }
  if (queryClient.getQueryData(categoriesQuery.queryKey) === undefined) {
    queryClient.setQueryData(categoriesQuery.queryKey, categories);
  }

  const conflictDetails = persistenceState.error?.conflict
    ? `Expected Rev ${persistenceState.error.conflict.expectedRevision ?? "?"} · Actual Rev ${persistenceState.error.conflict.actualRevision ?? "?"}`
    : undefined;

  const canUndo = canUndoHistory(historyState);
  const canRedo = canRedoHistory(historyState);
  const nextUndoLabel = getNextUndoLabel(historyState);
  const nextRedoLabel = getNextRedoLabel(historyState);
  const hasRecoveryCandidate = Boolean(
    recoveryEvaluation &&
    (recoveryEvaluation.status === "recoverable" ||
      recoveryEvaluation.status === "stale_against_server"),
  );

  const layersPanelElement = (
    <StudioLayersPanel
      document={documentState.workingDocument}
      categories={categories}
      homeData={homeData}
      selectedNodeId={uiState.selectedNodeId}
      hoveredNodeId={uiState.hoveredNodeId}
      expandedLayerIds={uiState.expandedLayerIds}
      searchQuery={uiState.layerSearchQuery}
      onSelectNode={(id, opts) => {
        handleSelectNode(id, { ...opts, source: "layer_tree" });
        if (uiState.mobileActiveDrawer === "layers") {
          setUiState((prev) => ({ ...prev, mobileActiveDrawer: "none" }));
        }
      }}
      onHoverNode={handleHoverNode}
      onToggleExpandLayer={handleToggleExpandLayer}
      onExpandAllLayers={handleExpandAllLayers}
      onCollapseAllLayers={handleCollapseAllLayers}
      onChangeSearchQuery={(q) => setUiState((prev) => ({ ...prev, layerSearchQuery: q }))}
      onToggleNodeVisibility={(nodeId, currentlyHidden) =>
        handleUpdateNodeVisibility(nodeId, currentlyHidden)
      }
      onExecuteStructuralCommand={handleExecuteStructuralCommand}
      undoBanner={
        lastUndoSnapshot
          ? {
              description: lastUndoSnapshot.description,
              onUndo: handleUndoLastStructuralRemoval,
              onDismiss: () => setLastUndoSnapshot(null),
            }
          : null
      }
    />
  );

  const inspectorElement = (
    <StudioInspector
      selection={selectedContext}
      selectedGeometry={selectedGeometry}
      breakpoint={resolvedViewport.breakpoint}
      activeTab={uiState.activeInspectorTab}
      onChangeTab={(tab: StudioInspectorTab) =>
        setUiState((prev) => ({ ...prev, activeInspectorTab: tab }))
      }
      onSelectNode={(id) => handleSelectNode(id, { scrollIntoView: true, source: "breadcrumb" })}
      onUpdateNodeName={handleUpdateNodeName}
      onUpdateNodeVisibility={handleUpdateNodeVisibility}
      onUpdateNodeProp={handleUpdateNodeProp}
      onUpdateNodeSpacing={handleUpdateNodeSpacing}
      onUpdateNodeAppearance={handleUpdateNodeAppearance}
      onUpdateStyleProperty={handleUpdateStyleProperty}
      onResetStyleProperty={handleResetStyleProperty}
      onResetBreakpointOverrides={handleResetBreakpointOverrides}
      onToggleNodeLock={(nodeId, locked) =>
        handleExecuteStructuralCommand({ type: "SetLock", targetId: nodeId, locked })
      }
    />
  );

  const selectedOverlayLabel = selectedContext
    ? selectedContext.isVirtualProductInstance
      ? (selectedContext.virtualProduct?.name ?? "Product Card")
      : selectedContext.isVirtualCategoryCardInstance && selectedContext.virtualCategory
        ? `${selectedContext.virtualCategory.name} Card`
        : selectedContext.isVirtualCategoryInstance && selectedContext.virtualCategory
          ? `${selectedContext.virtualCategory.name} Sector`
          : (selectedContext.node.name ?? selectedContext.node.type ?? null)
    : null;

  const selectedOverlayType = selectedContext
    ? selectedContext.isVirtualProductInstance
      ? "ProductCard"
      : selectedContext.isVirtualCategoryCardInstance
        ? "CategoryCard"
        : selectedContext.isVirtualCategoryInstance
          ? "CategorySectionInstance"
          : (selectedContext.node.type ?? null)
    : null;

  const hoveredOverlayLabel = hoveredContext
    ? hoveredContext.isVirtualProductInstance
      ? (hoveredContext.virtualProduct?.name ?? "Product Card")
      : hoveredContext.isVirtualCategoryCardInstance && hoveredContext.virtualCategory
        ? `${hoveredContext.virtualCategory.name} Card`
        : hoveredContext.isVirtualCategoryInstance && hoveredContext.virtualCategory
          ? `${hoveredContext.virtualCategory.name} Sector`
          : (hoveredContext.node.name ?? hoveredContext.node.type ?? null)
    : null;

  const canvasElement = (
    <StudioCanvas
      document={documentState.workingDocument}
      home={homeData}
      categories={categories}
      settings={settingsData}
      renderMode={uiState.renderMode}
      breakpoint={resolvedViewport.breakpoint}
      viewportWidthPx={resolvedViewport.viewportWidthPx}
      zoomScale={resolvedViewport.zoomScale}
      selectedNodeId={uiState.selectedNodeId}
      selectedLabel={selectedOverlayLabel}
      selectedType={selectedOverlayType}
      selectedLocked={
        Boolean(selectedContext?.node.locked) ||
        Boolean(selectedContext?.isAncestorLocked) ||
        Boolean(selectedContext?.isGlobalRouteChrome) ||
        Boolean(selectedContext?.isRuntimeInstance)
      }
      selectedIsRuntimeInstance={Boolean(selectedContext?.isRuntimeInstance)}
      hoveredNodeId={uiState.hoveredNodeId}
      hoveredLabel={hoveredOverlayLabel}
      showRulers={uiState.showRulers}
      scrollRequestNodeId={scrollRequestNodeId}
      onSelectNode={handleCanvasSelect}
      onHoverNode={handleHoverNode}
      onSelectedGeometryChange={setSelectedGeometry}
      onAvailableContainerWidthChange={setAvailableCanvasWidthPx}
    />
  );

  return (
    <div
      data-testid="studio-shell"
      className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Top Workspace Toolbar */}
      <StudioToolbar
        pageTitle={documentState.workingDocument.name || "Storefront Homepage"}
        persistenceStatus={persistenceState.status}
        isDirty={documentState.isDirty}
        draftRevision={persistenceState.draftRevision}
        isPublishedLive={persistenceState.isPublishedLive}
        renderMode={uiState.renderMode}
        devicePreset={resolvedViewport.devicePreset}
        viewportWidthPx={resolvedViewport.viewportWidthPx}
        breakpoint={resolvedViewport.breakpoint}
        zoomMode={resolvedViewport.zoomMode}
        zoomPercent={resolvedViewport.zoomPercent}
        leftPanelCollapsed={uiState.leftPanelCollapsed}
        rightPanelCollapsed={uiState.rightPanelCollapsed}
        mobileActiveDrawer={uiState.mobileActiveDrawer}
        canUndo={canUndo}
        canRedo={canRedo}
        nextUndoLabel={nextUndoLabel}
        nextRedoLabel={nextRedoLabel}
        isOnline={persistenceState.isOnline ?? true}
        retryAttempt={persistenceState.retryAttempt ?? 0}
        persistenceError={persistenceState.error}
        validationError={persistenceState.validationError}
        hasRecoveryCheckpoint={hasRecoveryCandidate}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onRetrySave={() => void handleSaveDraft()}
        onOpenRecovery={() => setShowRecoveryDialog(true)}
        onReturnToAdmin={handleRequestReturnToAdmin}
        onSaveDraft={() => void handleSaveDraft()}
        onResetWorkingDraft={handleResetWorkingDraft}
        onChangeRenderMode={(mode) =>
          setUiState((prev) => {
            if (mode === "editor") {
              const restored = restorePreviousStudioSelection(
                {
                  selectedNodeId: prev.selectedNodeId,
                  hoveredNodeId: null,
                  previousSelectedNodeId: prev.previousSelectedNodeId,
                  selectionSource: prev.selectionSource,
                  interactionMode: "idle",
                },
                documentState.workingDocument,
              );
              return {
                ...prev,
                renderMode: mode,
                selectedNodeId: restored.selectedNodeId,
                hoveredNodeId: null,
                selectionSource: restored.selectionSource,
                interactionMode: "idle",
              };
            }
            return {
              ...prev,
              renderMode: mode,
              hoveredNodeId: null,
              interactionMode: "previewing",
            };
          })
        }
        onSelectDevicePreset={(preset: Exclude<StudioDevicePreset, "custom">) =>
          setUiState((prev) => ({
            ...prev,
            devicePreset: preset,
            viewportWidthPx: STUDIO_DEVICE_PRESETS[preset].widthPx,
          }))
        }
        onChangeViewportWidth={(widthPx: number) =>
          setUiState((prev) => ({
            ...prev,
            devicePreset: inferDevicePresetFromWidth(widthPx),
            viewportWidthPx: widthPx,
          }))
        }
        onChangeZoom={(zoomPercent: number, mode: StudioZoomMode = "manual") =>
          setUiState((prev) => ({
            ...prev,
            zoomPercent,
            zoomMode: mode,
          }))
        }
        onToggleLeftPanel={() =>
          setUiState((prev) => ({ ...prev, leftPanelCollapsed: !prev.leftPanelCollapsed }))
        }
        onToggleRightPanel={() =>
          setUiState((prev) => ({ ...prev, rightPanelCollapsed: !prev.rightPanelCollapsed }))
        }
        onChangeMobileDrawer={(drawer: StudioMobileDrawer) =>
          setUiState((prev) => ({ ...prev, mobileActiveDrawer: drawer }))
        }
      />

      {/* Actionable Persistence / Conflict Error Banner */}
      {persistenceState.error && (
        <StudioInlineErrorBanner
          message={persistenceState.error.publicMessage}
          conflictDetails={conflictDetails}
          onReloadDraft={() => void loadDraft({ forceOverwriteUnsaved: true })}
          onDismiss={() =>
            setPersistenceState((prev) => ({
              ...prev,
              error: null,
              status: documentState.isDirty ? "unsaved" : "saved",
            }))
          }
        />
      )}

      {/* Main Workspace Area: Resizable 3-Pane Layout on Desktop/Tablet */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="hidden md:flex h-full w-full">
          <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
            {!uiState.leftPanelCollapsed && (
              <>
                <ResizablePanel
                  id="studio-left-layers-panel"
                  defaultSize="20%"
                  minSize="14%"
                  maxSize="32%"
                  className="h-full overflow-hidden border-r border-border"
                >
                  {layersPanelElement}
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            <ResizablePanel
              id="studio-center-canvas-panel"
              defaultSize="56%"
              minSize="35%"
              className="flex h-full flex-col overflow-hidden"
            >
              {canvasElement}
            </ResizablePanel>

            {!uiState.rightPanelCollapsed && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="studio-right-inspector-panel"
                  defaultSize="24%"
                  minSize="16%"
                  maxSize="36%"
                  className="h-full overflow-hidden border-l border-border"
                >
                  {inspectorElement}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        {/* Mobile Administration Layout: Full-Width Canvas + Slide-Over Drawers */}
        <div className="flex h-full w-full flex-col md:hidden">
          {canvasElement}

          {uiState.mobileActiveDrawer !== "none" && (
            <div
              data-testid={`studio-mobile-drawer-${uiState.mobileActiveDrawer}`}
              className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-sm"
            >
              <div className="mt-auto flex h-[78vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="font-sans text-xs font-semibold">
                    {uiState.mobileActiveDrawer === "layers"
                      ? "Page & Layers"
                      : "Component Inspector"}
                  </span>
                  <button
                    type="button"
                    aria-label="Close drawer"
                    onClick={() => setUiState((prev) => ({ ...prev, mobileActiveDrawer: "none" }))}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {uiState.mobileActiveDrawer === "layers" ? layersPanelElement : inspectorElement}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Workspace Status Bar */}
      <StudioStatusBar
        persistenceStatus={persistenceState.status}
        isDirty={documentState.isDirty}
        draftRevision={persistenceState.draftRevision}
        publishedRevision={persistenceState.publishedRevision}
        lastSavedAt={persistenceState.lastSavedAt}
        renderMode={uiState.renderMode}
        viewportWidthPx={resolvedViewport.viewportWidthPx}
        breakpoint={resolvedViewport.breakpoint}
        zoomPercent={resolvedViewport.zoomPercent}
        selectedBreadcrumb={selectedContext?.breadcrumbNames ?? []}
        selectedBreadcrumbEntries={selectedContext?.breadcrumbEntries}
        onSelectBreadcrumbNode={(nodeId) =>
          handleSelectNode(nodeId, { scrollIntoView: true, source: "breadcrumb" })
        }
        validationError={persistenceState.validationError}
      />

      {/* Local Unsaved Draft Recovery Modal */}
      {showRecoveryDialog &&
        recoveryEvaluation &&
        (recoveryEvaluation.status === "recoverable" ||
          recoveryEvaluation.status === "stale_against_server") && (
          <RecoveryDialog
            evaluation={recoveryEvaluation}
            onRestoreCheckpoint={handleRestoreRecoveryCheckpoint}
            onDiscardCheckpoint={handleDiscardRecoveryCheckpoint}
          />
        )}

      {/* Unsaved Work Protection Confirmation Modal */}
      {showUnsavedExitConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-exit-dialog-title"
          data-testid="studio-unsaved-exit-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2
              id="unsaved-exit-dialog-title"
              className="font-sans text-base font-semibold text-foreground"
            >
              Unsaved Draft Changes
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              You have unsaved edits in your working draft. Would you like to save your draft before
              returning to the Admin Dashboard?
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnsavedExitConfirm(false)}
                data-testid="studio-unsaved-cancel-btn"
                className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  clearLocalDraftRecoverySnapshot("home", { userScope });
                  setShowUnsavedExitConfirm(false);
                  onNavigateToAdmin?.();
                }}
                data-testid="studio-unsaved-discard-btn"
                className="rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25"
              >
                Discard &amp; Leave
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveDraft();
                  setShowUnsavedExitConfirm(false);
                  onNavigateToAdmin?.();
                }}
                data-testid="studio-unsaved-save-leave-btn"
                className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Save &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudioShell;
