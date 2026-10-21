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
  clearLocalDraftRecoverySnapshot,
  createInitialStudioDocumentState,
  createInitialStudioPersistenceState,
  createInitialStudioUIState,
  executeStructuralCommand,
  getAncestorLayerIdsForTarget,
  inferDevicePresetFromWidth,
  loadStudioWorkspaceDraft,
  resetInspectorBreakpointOverrides,
  resetInspectorStyleProperty,
  resolveSelectedNodeContext,
  resolveStudioViewportState,
  saveLocalDraftRecoverySnapshot,
  saveStudioWorkspaceDraft,
  STUDIO_DEVICE_PRESETS,
  updateInspectorStyleProperty,
  updateStudioNodeAppearance,
  updateStudioNodeName,
  updateStudioNodeProp,
  updateStudioNodeSpacing,
  updateStudioNodeVisibility,
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
  /**
   * Optional persistence adapter override (used in integration tests; defaults to real Supabase adapter).
   */
  persistenceAdapter?: PersistenceDatabaseAdapter;
  /**
   * Optional pre-resolved catalog data (used in deterministic tests; defaults to live TanStack Query hooks).
   */
  initialHomeData?: HomeData;
  initialCategories?: Category[];
  initialSettings?: Settings | null;
  onNavigateToAdmin?: () => void;
}

const EMPTY_HOME_DATA: HomeData = {
  featured: [],
  newest: [],
  festival: [],
  allProducts: [],
};

export function StudioShell({
  persistenceAdapter,
  initialHomeData,
  initialCategories,
  initialSettings,
  onNavigateToAdmin,
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

  // 1. Separated State Slices (Part 11, Section 27 & Prompt 10 Part 3, Section 7)
  const [documentState, setDocumentState] = useState<StudioDocumentState>(() =>
    createInitialStudioDocumentState(),
  );
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

  const isSavingRef = useRef(false);

  // 2. Load Authorized Draft on Mount (Part 12, Section 29)
  const loadDraft = useCallback(async () => {
    setPersistenceState((prev) => ({
      ...prev,
      status: "loading",
      error: null,
      validationError: null,
    }));

    const outcome = await loadStudioWorkspaceDraft({
      adapter: persistenceAdapter,
      pageKey: "home",
      pageSlug: "/",
    });

    setDocumentState({
      persistedDocument: outcome.persistedDocument,
      workingDocument: outcome.workingDocument,
      isDirty: false,
    });

    setPersistenceState({
      status: outcome.error ? "error" : "saved",
      initializationSource: outcome.source,
      draftRevision: outcome.draftRevision,
      publishedRevision: outcome.publishedRevision,
      isPublishedLive: outcome.isPublishedLive,
      lastSavedAt: outcome.draftRecord?.updatedAt ?? null,
      error: outcome.error,
      validationError: null,
      pageRecord: outcome.pageRecord,
      draftRecord: outcome.draftRecord,
    });
  }, [persistenceAdapter]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  // 3. Browser beforeunload protection when working draft has unsaved changes
  useEffect(() => {
    if (!documentState.isDirty) return;

    saveLocalDraftRecoverySnapshot("home", documentState.workingDocument);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [documentState.isDirty, documentState.workingDocument]);

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

  // 7. Centralized Selection & Hover Controller Handlers (Prompt 10, Part 3, Sections 7–8)
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
          documentState.workingDocument,
          nodeId,
          source,
          prev.renderMode,
        );

        // Automatically expand ancestors in the Layer Tree when a nested node or runtime instance is selected
        const ancestorsToExpand = getAncestorLayerIdsForTarget(
          documentState.workingDocument,
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
    [documentState.workingDocument],
  );

  const handleHoverNode = useCallback(
    (nodeId: string | null) => {
      setUiState((prev) => {
        const nextHov = hoverStudioTarget(
          {
            selectedNodeId: prev.selectedNodeId,
            hoveredNodeId: prev.hoveredNodeId,
            previousSelectedNodeId: prev.previousSelectedNodeId,
            selectionSource: prev.selectionSource,
            interactionMode: prev.interactionMode,
          },
          documentState.workingDocument,
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
    },
    [documentState.workingDocument],
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

  // 8. Localized Validated Property & Style Edit Handlers
  const commitDocumentResult = useCallback(
    (result: { ok: boolean; document: StudioDocumentState["workingDocument"]; error?: string }) => {
      if (!result.ok) {
        setPersistenceState((prev) => ({
          ...prev,
          validationError: result.error ?? "Invalid property update.",
        }));
        return;
      }
      setDocumentState((prevDoc) => {
        const next = applyWorkingDocumentUpdate(prevDoc, persistenceState, result.document);
        setPersistenceState(next.persistenceState);
        return next.documentState;
      });
    },
    [persistenceState],
  );

  const handleUpdateNodeName = useCallback(
    (selectedId: string, newName: string) => {
      const res = updateStudioNodeName(documentState.workingDocument, selectedId, newName);
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
  );

  const handleUpdateNodeVisibility = useCallback(
    (selectedId: string, visible: boolean, bp?: EditorBreakpoint) => {
      const res = updateStudioNodeVisibility(
        documentState.workingDocument,
        selectedId,
        visible,
        bp,
      );
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
  );

  const handleUpdateNodeProp = useCallback(
    <K extends keyof SafeComponentProps>(
      selectedId: string,
      propKey: K,
      value: SafeComponentProps[K],
    ) => {
      const res = updateStudioNodeProp(documentState.workingDocument, selectedId, propKey, value);
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
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
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
  );

  const handleUpdateNodeAppearance = useCallback(
    (selectedId: string, patch: StudioAppearancePatch, bp?: EditorBreakpoint) => {
      const res = updateStudioNodeAppearance(documentState.workingDocument, selectedId, patch, bp);
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
  );

  const handleUpdateStyleProperty = useCallback(
    (selectedId: string, path: InspectorStylePath, value: unknown, bp?: EditorBreakpoint) => {
      const res = updateInspectorStyleProperty(
        documentState.workingDocument,
        selectedId,
        path,
        value,
        bp,
      );
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
  );

  const handleResetStyleProperty = useCallback(
    (selectedId: string, path: InspectorStylePath, bp?: EditorBreakpoint) => {
      const res = resetInspectorStyleProperty(documentState.workingDocument, selectedId, path, bp);
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
  );

  const handleResetBreakpointOverrides = useCallback(
    (selectedId: string, bp: EditorBreakpoint) => {
      const res = resetInspectorBreakpointOverrides(documentState.workingDocument, selectedId, bp);
      commitDocumentResult(res);
    },
    [documentState.workingDocument, commitDocumentResult],
  );

  // 8b. Centralized Structural Command Dispatcher (Prompt 11)
  const handleExecuteStructuralCommand = useCallback(
    (command: StructuralCommand): StructuralOperationResult => {
      const res = executeStructuralCommand(
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

      if (res.undoSnapshot) {
        setLastUndoSnapshot(res.undoSnapshot);
      } else {
        setLastUndoSnapshot(null);
      }

      setDocumentState((prevDoc) => {
        const next = applyWorkingDocumentUpdate(prevDoc, persistenceState, res.document);
        setPersistenceState(next.persistenceState);
        return next.documentState;
      });

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
    [documentState.workingDocument, uiState.selectedNodeId, persistenceState],
  );

  const handleUndoLastStructuralRemoval = useCallback(() => {
    if (!lastUndoSnapshot) return;
    const { previousDocument, previousSelectedNodeId } = lastUndoSnapshot;
    setLastUndoSnapshot(null);
    setDocumentState((prevDoc) => {
      const next = applyWorkingDocumentUpdate(prevDoc, persistenceState, previousDocument);
      setPersistenceState(next.persistenceState);
      return next.documentState;
    });
    if (previousSelectedNodeId) {
      setUiState((prev) => {
        const nextSel = selectStudioTarget(
          {
            selectedNodeId: prev.selectedNodeId,
            hoveredNodeId: prev.hoveredNodeId,
            previousSelectedNodeId: prev.previousSelectedNodeId,
            selectionSource: prev.selectionSource,
            interactionMode: prev.interactionMode,
          },
          previousDocument,
          previousSelectedNodeId,
          "programmatic",
          prev.renderMode,
        );
        const nextExpanded = new Set(prev.expandedLayerIds);
        for (const ancId of getAncestorLayerIdsForTarget(
          previousDocument,
          nextSel.selectedNodeId,
        )) {
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
    }
  }, [lastUndoSnapshot, persistenceState]);

  // 9. Save Draft & Revert Handlers
  const handleSaveDraft = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    const intendedWorkingDoc = documentState.workingDocument;
    setPersistenceState((prev) => ({
      ...prev,
      status: "saving",
      error: null,
      validationError: null,
    }));

    try {
      const outcome = await saveStudioWorkspaceDraft(
        {
          workingDocument: intendedWorkingDoc,
          expectedDraftRevision: persistenceState.draftRevision,
          pageKey: "home",
          slug: "/",
          title: intendedWorkingDoc.name || "Storefront Homepage",
        },
        { adapter: persistenceAdapter },
      );

      if (outcome.ok) {
        setDocumentState((prevDoc) => {
          const stillMatchesSaved = prevDoc.workingDocument === intendedWorkingDoc;
          return {
            persistedDocument: outcome.persistedDocument,
            workingDocument: prevDoc.workingDocument,
            isDirty: !stillMatchesSaved,
          };
        });
        setPersistenceState((prev) => ({
          ...prev,
          status: "saved",
          draftRevision: outcome.draftRevision,
          publishedRevision: outcome.publishedRevision,
          lastSavedAt: outcome.savedAt,
          error: null,
          validationError: null,
          pageRecord: outcome.pageRecord,
          draftRecord: outcome.draftRecord,
        }));
      } else {
        const isConflict = outcome.error?.code === "DRAFT_REVISION_CONFLICT";
        setPersistenceState((prev) => ({
          ...prev,
          status: isConflict ? "conflict" : "error",
          error: outcome.error,
        }));
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [documentState.workingDocument, persistenceState.draftRevision, persistenceAdapter]);

  const handleResetWorkingDraft = useCallback(() => {
    clearLocalDraftRecoverySnapshot("home");
    setDocumentState((prev) => ({
      ...prev,
      workingDocument: structuredClone(prev.persistedDocument),
      isDirty: false,
    }));
    setPersistenceState((prev) => ({
      ...prev,
      status: "saved",
      error: null,
      validationError: null,
    }));
  }, []);

  const handleRequestReturnToAdmin = useCallback(() => {
    if (documentState.isDirty) {
      setShowUnsavedExitConfirm(true);
      return;
    }
    onNavigateToAdmin?.();
  }, [documentState.isDirty, onNavigateToAdmin]);

  // 10. Global Studio Keyboard Navigation (Prompt 10, Part 5, Section 13 & Part 15, Section 43)
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
        onRetry={() => void loadDraft()}
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

  const conflictDetails = persistenceState.error?.conflictInfo
    ? `Expected Rev ${persistenceState.error.conflictInfo.expectedRevision ?? "?"} · Actual Rev ${persistenceState.error.conflictInfo.actualRevision ?? "?"}`
    : undefined;

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
      onSelectNode={(id, source) => handleSelectNode(id, { source: source ?? "canvas_click" })}
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
          onReloadDraft={() => void loadDraft()}
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
                  clearLocalDraftRecoverySnapshot("home");
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
