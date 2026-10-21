import React from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Layers,
  Lock,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Unlock,
} from "lucide-react";
import {
  extractConfiguredDesignGeometry,
  type ElementGeometryMeasurement,
} from "@/lib/visual-editor/geometry";
import {
  isInspectorStylePathSupported,
  resolveInspectorPropertyState,
  type InspectorStylePath,
} from "@/lib/visual-editor/inspector";
import { resolveResponsiveNodePresentation } from "@/lib/visual-editor/rendering/responsive-styles";
import type {
  BorderConfig,
  FilterConfig,
  GradientConfig,
  ShadowConfig,
  TypographyConfig,
} from "@/lib/visual-editor/schema/appearance";
import type {
  AspectRatioPreset,
  DimensionValue,
  SpacingBox,
} from "@/lib/visual-editor/schema/geometry";
import type {
  FlexItemConfig,
  FlexLayoutConfig,
  GridItemConfig,
  GridLayoutConfig,
  LayoutMode,
} from "@/lib/visual-editor/schema/layout";
import type { SafeComponentProps } from "@/lib/visual-editor/schema/nodes";
import type { EditorBreakpoint } from "@/lib/visual-editor/schema/responsive";
import type {
  ClipShapePreset,
  CornerRadiusConfig,
  ImageCropConfig,
  ShapeType,
} from "@/lib/visual-editor/schema/shapes";
import type {
  ResolvedStudioSelection,
  StudioAppearancePatch,
  StudioInspectorTab,
} from "@/lib/visual-editor/studio";
import { cn } from "@/lib/utils";
import {
  AppearanceEffectsControl,
  AspectRatioControl,
  ColorControl,
  CornerRadiusControl,
  DimensionControl,
  GapControl,
  GradientControl,
  LayoutControls,
  MediaPresentationControls,
  PropertySection,
  ResponsivePropertyControl,
  ShapeControl,
  SpacingControl,
  TypographyControls,
} from "./inspector";
import { InspectorGeometryComparisonCard } from "./selection/ElementDimensions";
import { SelectionBreadcrumb } from "./selection/SelectionBreadcrumb";

export interface StudioInspectorProps {
  selection: ResolvedStudioSelection | null;
  selectedGeometry?: ElementGeometryMeasurement | null;
  breakpoint: EditorBreakpoint;
  activeTab: StudioInspectorTab;
  onChangeTab: (tab: StudioInspectorTab) => void;
  onSelectNode: (nodeId: string) => void;
  onUpdateNodeName: (selectedId: string, newName: string) => void;
  onUpdateNodeVisibility: (
    selectedId: string,
    visible: boolean,
    breakpoint?: EditorBreakpoint,
  ) => void;
  onUpdateNodeProp: <K extends keyof SafeComponentProps>(
    selectedId: string,
    propKey: K,
    value: SafeComponentProps[K],
  ) => void;
  onUpdateNodeSpacing: (
    selectedId: string,
    field: "padding" | "margin",
    box: SpacingBox | undefined,
    breakpoint?: EditorBreakpoint,
  ) => void;
  onUpdateNodeAppearance: (
    selectedId: string,
    patch: StudioAppearancePatch,
    breakpoint?: EditorBreakpoint,
  ) => void;
  onUpdateStyleProperty?: (
    selectedId: string,
    path: InspectorStylePath | string,
    value: unknown,
    breakpoint?: EditorBreakpoint,
  ) => void;
  onResetStyleProperty?: (
    selectedId: string,
    path: InspectorStylePath | string,
    breakpoint?: EditorBreakpoint,
  ) => void;
  onResetBreakpointOverrides?: (selectedId: string, breakpoint: EditorBreakpoint) => void;
  onToggleNodeLock?: (selectedId: string, locked: boolean) => void;
}

const EDITABLE_TEXT_PROP_META: ReadonlyArray<{
  key: "title" | "eyebrow" | "subtitle" | "description" | "text" | "label" | "viewAllLabel";
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: "eyebrow", label: "Eyebrow Kicker", placeholder: "e.g. Curated Sector" },
  { key: "title", label: "Section / Component Title", placeholder: "Enter heading title…" },
  { key: "subtitle", label: "Subtitle", placeholder: "Enter subtitle…" },
  {
    key: "description",
    label: "Description Copy",
    placeholder: "Enter descriptive text…",
    multiline: true,
  },
  { key: "text", label: "Text Content", placeholder: "Enter text content…", multiline: true },
  { key: "label", label: "Button / CTA Label", placeholder: "e.g. Explore" },
  { key: "viewAllLabel", label: "View All Link Label", placeholder: "e.g. View all" },
];

export function StudioInspector({
  selection,
  selectedGeometry = null,
  breakpoint,
  activeTab,
  onChangeTab,
  onSelectNode,
  onUpdateNodeName,
  onUpdateNodeVisibility,
  onUpdateNodeProp,
  onUpdateNodeSpacing,
  onUpdateNodeAppearance,
  onUpdateStyleProperty,
  onResetStyleProperty,
  onResetBreakpointOverrides,
  onToggleNodeLock,
}: StudioInspectorProps) {
  if (!selection) {
    return (
      <aside
        aria-label="Properties Inspector"
        data-testid="studio-inspector-empty"
        className="flex h-full w-full flex-col bg-card text-foreground"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <SlidersHorizontal className="size-4 text-primary" />
          <h2 className="font-sans text-xs font-semibold tracking-tight">Inspector</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Layers className="size-8 text-muted-foreground/40" />
          <p className="mt-3 font-sans text-xs font-medium text-foreground">
            No Component Selected
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Click any section or component in the canvas or Layer Tree Navigator to inspect its
            properties, responsive state, and bindings.
          </p>
        </div>
      </aside>
    );
  }

  const {
    node,
    capabilities,
    isVirtualCategoryInstance,
    isVirtualProductInstance,
    isVirtualCategoryCardInstance,
    isRuntimeInstance,
    isGlobalRouteChrome,
    isAncestorLocked,
    lockedByAncestorName,
    virtualCategory,
    virtualProduct,
    parentTargetId,
    breadcrumbEntries,
  } = selection;

  const presentation = resolveResponsiveNodePresentation(node, breakpoint);
  const configuredGeometry = extractConfiguredDesignGeometry(node, breakpoint);
  const isDirectlyLocked = Boolean(node.locked);
  const isLocked =
    isDirectlyLocked || Boolean(isAncestorLocked) || isGlobalRouteChrome || isRuntimeInstance;
  const canToggleNodeLock =
    !isGlobalRouteChrome &&
    !isRuntimeInstance &&
    !isAncestorLocked &&
    !capabilities?.isGlobalBackgroundLayer;
  const editablePropsList = capabilities?.editableProps ?? [];

  const supportedTextFields = EDITABLE_TEXT_PROP_META.filter((field) =>
    editablePropsList.includes(field.key),
  );

  const tabs: { id: StudioInspectorTab; label: string; icon: typeof Info }[] = [
    { id: "content", label: "Content", icon: Info },
    { id: "layout", label: "Layout", icon: SlidersHorizontal },
    { id: "appearance", label: "Style", icon: Palette },
    { id: "responsive", label: "More", icon: Smartphone },
  ];

  // Unified dispatch helpers (using central updateInspectorStyleProperty when provided, with fallback)
  const applyStylePath = (path: InspectorStylePath | string, value: unknown) => {
    if (onUpdateStyleProperty) {
      onUpdateStyleProperty(node.id, path, value, breakpoint);
      return;
    }
    if (path === "geometry.padding") {
      onUpdateNodeSpacing(node.id, "padding", value as SpacingBox | undefined, breakpoint);
    } else if (path === "geometry.margin") {
      onUpdateNodeSpacing(node.id, "margin", value as SpacingBox | undefined, breakpoint);
    } else if (path === "appearance.backgroundColor") {
      onUpdateNodeAppearance(
        node.id,
        { backgroundColor: (value as string | null) ?? null },
        breakpoint,
      );
    } else if (path === "appearance.opacity") {
      onUpdateNodeAppearance(
        node.id,
        { opacity: (value as number | null) ?? null },
        breakpoint,
      );
    } else if (path === "shape.cornerRadius") {
      const cr = value as CornerRadiusConfig | null;
      onUpdateNodeAppearance(
        node.id,
        { cornerRadiusPx: cr?.uniform ?? null },
        breakpoint,
      );
    }
  };

  const resetStylePath = (path: InspectorStylePath | string) => {
    if (onResetStyleProperty) {
      onResetStyleProperty(node.id, path, breakpoint);
      return;
    }
    applyStylePath(path, null);
  };

  // Property States resolved for the active breakpoint
  const widthState = resolveInspectorPropertyState<DimensionValue>(
    node,
    "geometry.width",
    breakpoint,
  );
  const heightState = resolveInspectorPropertyState<DimensionValue>(
    node,
    "geometry.height",
    breakpoint,
  );
  const minWidthState = resolveInspectorPropertyState<DimensionValue>(
    node,
    "geometry.minWidth",
    breakpoint,
  );
  const maxWidthState = resolveInspectorPropertyState<DimensionValue>(
    node,
    "geometry.maxWidth",
    breakpoint,
  );
  const minHeightState = resolveInspectorPropertyState<DimensionValue>(
    node,
    "geometry.minHeight",
    breakpoint,
  );
  const maxHeightState = resolveInspectorPropertyState<DimensionValue>(
    node,
    "geometry.maxHeight",
    breakpoint,
  );
  const aspectRatioState = resolveInspectorPropertyState<AspectRatioPreset>(
    node,
    "geometry.aspectRatio",
    breakpoint,
  );
  const paddingState = resolveInspectorPropertyState<SpacingBox>(
    node,
    "geometry.padding",
    breakpoint,
  );
  const marginState = resolveInspectorPropertyState<SpacingBox>(
    node,
    "geometry.margin",
    breakpoint,
  );
  const columnGapState = resolveInspectorPropertyState<number>(
    node,
    "layout.flex.columnGapPx",
    breakpoint,
  );
  const rowGapState = resolveInspectorPropertyState<number>(
    node,
    "layout.flex.rowGapPx",
    breakpoint,
  );
  const layoutModeState = resolveInspectorPropertyState<LayoutMode>(
    node,
    "layout.mode",
    breakpoint,
  );
  const flexState = resolveInspectorPropertyState<FlexLayoutConfig>(
    node,
    "layout.flex",
    breakpoint,
  );
  const gridState = resolveInspectorPropertyState<GridLayoutConfig>(
    node,
    "layout.grid",
    breakpoint,
  );
  const flexItemState = resolveInspectorPropertyState<FlexItemConfig>(
    node,
    "flexItem",
    breakpoint,
  );
  const gridItemState = resolveInspectorPropertyState<GridItemConfig>(
    node,
    "gridItem",
    breakpoint,
  );

  const bgColorState = resolveInspectorPropertyState<string>(
    node,
    "appearance.backgroundColor",
    breakpoint,
  );
  const gradientState = resolveInspectorPropertyState<GradientConfig>(
    node,
    "appearance.backgroundGradient",
    breakpoint,
  );
  const borderState = resolveInspectorPropertyState<BorderConfig>(
    node,
    "appearance.border",
    breakpoint,
  );
  const shadowState = resolveInspectorPropertyState<ShadowConfig>(
    node,
    "appearance.shadow",
    breakpoint,
  );
  const opacityState = resolveInspectorPropertyState<number>(
    node,
    "appearance.opacity",
    breakpoint,
  );
  const filtersState = resolveInspectorPropertyState<FilterConfig>(
    node,
    "appearance.filters",
    breakpoint,
  );
  const typographyState = resolveInspectorPropertyState<TypographyConfig>(
    node,
    "appearance.typography",
    breakpoint,
  );
  const textColorState = resolveInspectorPropertyState<string>(
    node,
    "appearance.typography.color",
    breakpoint,
  );
  const shapeTypeState = resolveInspectorPropertyState<ShapeType>(
    node,
    "shape.shapeType",
    breakpoint,
  );
  const clipPresetState = resolveInspectorPropertyState<ClipShapePreset>(
    node,
    "shape.clipPreset",
    breakpoint,
  );
  const cornerRadiusState = resolveInspectorPropertyState<CornerRadiusConfig>(
    node,
    "shape.cornerRadius",
    breakpoint,
  );
  const imageCropState = resolveInspectorPropertyState<ImageCropConfig>(
    node,
    "shape.imageCrop",
    breakpoint,
  );

  // Trusted Capability Flags
  const supportsWidth = isInspectorStylePathSupported(node.type, "geometry.width", capabilities);
  const supportsHeight = isInspectorStylePathSupported(node.type, "geometry.height", capabilities);
  const supportsMinMax = isInspectorStylePathSupported(
    node.type,
    "geometry.minWidth",
    capabilities,
  );
  const supportsAspectRatio = isInspectorStylePathSupported(
    node.type,
    "geometry.aspectRatio",
    capabilities,
  );
  const supportsPadding = isInspectorStylePathSupported(
    node.type,
    "geometry.padding",
    capabilities,
  );
  const supportsMargin = isInspectorStylePathSupported(node.type, "geometry.margin", capabilities);
  const supportsGap = isInspectorStylePathSupported(
    node.type,
    "layout.flex.columnGapPx",
    capabilities,
  );
  const supportsFlexAlignment = Boolean(capabilities?.layoutSupport.layoutMode);
  const supportsGridColumns = Boolean(capabilities?.layoutSupport.layoutMode);
  const supportsBentoSpan = Boolean(
    capabilities?.layoutSupport.gridPlacement || capabilities?.layoutSupport.flexItem,
  );

  const supportsBgColor = isInspectorStylePathSupported(
    node.type,
    "appearance.backgroundColor",
    capabilities,
  );
  const supportsGradient = isInspectorStylePathSupported(
    node.type,
    "appearance.backgroundGradient",
    capabilities,
  );
  const supportsBorder = isInspectorStylePathSupported(
    node.type,
    "appearance.border",
    capabilities,
  );
  const supportsShadow = isInspectorStylePathSupported(
    node.type,
    "appearance.shadow",
    capabilities,
  );
  const supportsOpacity = isInspectorStylePathSupported(
    node.type,
    "appearance.opacity",
    capabilities,
  );
  const supportsFilters = isInspectorStylePathSupported(
    node.type,
    "appearance.filters",
    capabilities,
  );
  const supportsTypography = isInspectorStylePathSupported(
    node.type,
    "appearance.typography",
    capabilities,
  );
  const supportsCornerRadius = isInspectorStylePathSupported(
    node.type,
    "shape.cornerRadius",
    capabilities,
  );
  const supportsClipShape = isInspectorStylePathSupported(
    node.type,
    "shape.clipPreset",
    capabilities,
  );
  const supportsShapeType = isInspectorStylePathSupported(
    node.type,
    "shape.shapeType",
    capabilities,
  );
  const supportsImageCrop = isInspectorStylePathSupported(
    node.type,
    "shape.imageCrop",
    capabilities,
  );

  const headerTitle = isVirtualProductInstance
    ? virtualProduct
      ? `Product Card (${virtualProduct.name})`
      : "Product Card Instance"
    : isVirtualCategoryCardInstance && virtualCategory
      ? `${virtualCategory.name} Card`
      : isVirtualCategoryInstance && virtualCategory
        ? `${virtualCategory.name} Sector`
        : node.name || capabilities?.displayName || node.type;

  const headerType = isVirtualProductInstance
    ? "ProductCard"
    : isVirtualCategoryCardInstance
      ? "CategoryCard"
      : isVirtualCategoryInstance
        ? "CategorySectionInstance"
        : node.type;

  const primaryMediaUrl =
    node.media?.primary?.url ??
    Object.values(node.media ?? {})[0]?.url ??
    virtualProduct?.image ??
    virtualCategory?.image_url ??
    null;

  return (
    <aside
      aria-label="Properties Inspector"
      data-testid="studio-inspector"
      className="flex h-full w-full flex-col bg-card text-foreground"
    >
      {/* Inspector Header: Selected Node Summary & Interactive Hierarchy Breadcrumb */}
      <div className="border-b border-border px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2
              data-testid="studio-inspector-node-name"
              className="truncate font-sans text-xs font-semibold text-foreground"
            >
              {headerTitle}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span data-testid="studio-inspector-node-type">{headerType}</span>
              <span aria-hidden="true">·</span>
              <span>
                {isRuntimeInstance ? "runtime instance" : (capabilities?.category ?? "section")}
              </span>
              {selectedGeometry && selectedGeometry.isValid && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    data-testid="studio-inspector-rendered-dimensions"
                    className="text-foreground tabular-nums"
                  >
                    {selectedGeometry.renderedWidthPx} × {selectedGeometry.renderedHeightPx}px
                  </span>
                </>
              )}
              {isLocked && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-400">
                    <Lock className="size-2.5" /> Locked
                  </span>
                </>
              )}
            </div>
          </div>
          {parentTargetId && (
            <button
              type="button"
              onClick={() => onSelectNode(parentTargetId)}
              data-testid="studio-inspector-select-parent-btn"
              title="Select parent component ([ or Alt+Up)"
              className="shrink-0 rounded border border-border bg-secondary/50 px-2 py-1 font-mono text-[10px] font-medium text-foreground hover:bg-secondary"
            >
              ↑ Parent
            </button>
          )}
        </div>

        {breadcrumbEntries.length > 1 && (
          <SelectionBreadcrumb
            entries={breadcrumbEntries}
            activeId={selection.selectedId}
            onSelectNode={onSelectNode}
            testId="studio-inspector-breadcrumb"
            className="pt-0.5"
          />
        )}
      </div>

      {/* Virtual Category Section Banner (Part 8, Section 19) */}
      {isVirtualCategoryInstance && virtualCategory && (
        <div
          data-testid="studio-inspector-virtual-category-banner"
          className="border-b border-border bg-secondary/40 px-3 py-2.5 text-xs"
        >
          <p className="font-medium text-foreground">
            Dynamic Category Instance: {virtualCategory.name}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Generated at runtime from category slug{" "}
            <code className="font-mono text-foreground">{virtualCategory.slug}</code> via parent
            template <code className="font-mono text-foreground">{node.id}</code>. Template-level
            edits below apply across repeated category sections; per-category overrides are planned
            for Phase 6.
          </p>
          <button
            type="button"
            onClick={() => onSelectNode(node.id)}
            data-testid="studio-select-parent-template-btn"
            className="mt-2 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
          >
            Select Parent Template ({node.name || node.type})
          </button>
        </div>
      )}

      {/* Product / Category Card Runtime Instance Banner (Prompt 10, Part 6, Section 17) */}
      {(isVirtualProductInstance || isVirtualCategoryCardInstance) && (
        <div
          data-testid="studio-inspector-runtime-instance-banner"
          className="border-b border-border bg-secondary/40 px-3 py-2.5 text-xs"
        >
          <p className="font-medium text-foreground">
            {isVirtualProductInstance
              ? `Rendered Product Card Instance: ${virtualProduct?.name ?? selection.identity.virtualProductId}`
              : `Rendered Category Card Instance: ${virtualCategory?.name ?? selection.identity.virtualCategoryId}`}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Bound to parent collection template{" "}
            <code className="font-mono text-foreground">{node.name || node.id}</code>. Selecting a
            rendered card inspects its visual geometry and shared collection template without
            mutating underlying catalog records (prices, affiliate URLs, and inventory remain
            protected).
          </p>
          <button
            type="button"
            onClick={() => onSelectNode(parentTargetId ?? node.id)}
            data-testid="studio-select-parent-template-btn"
            className="mt-2 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
          >
            Select Parent Collection ({node.name || node.type})
          </button>
        </div>
      )}

      {/* Inspector Section Tabs */}
      <div
        role="tablist"
        aria-label="Inspector sections"
        className="grid grid-cols-4 gap-1 border-b border-border bg-secondary/30 p-1"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`studio-inspector-tab-${t.id}`}
              onClick={() => onChangeTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-3 text-xs">
        {/* TAB 1: CONTENT & COMPONENT INFORMATION */}
        {activeTab === "content" && (
          <div className="space-y-4">
            {/* Component Identity & Visibility */}
            <section className="space-y-2.5">
              <h3 className="font-sans text-xs font-semibold text-foreground">
                Component Identity
              </h3>
              <div className="space-y-1.5">
                <label
                  htmlFor="inspector-node-name-input"
                  className="block text-[11px] text-muted-foreground"
                >
                  Layer Display Name
                </label>
                <input
                  id="inspector-node-name-input"
                  type="text"
                  disabled={isLocked}
                  value={node.name ?? ""}
                  data-testid="inspector-node-name-input"
                  onChange={(e) => onUpdateNodeName(node.id, e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary/60 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                <span>Node ID</span>
                <code className="font-mono text-foreground">{selection.selectedId}</code>
              </div>

              {/* Section / Component Visibility Control */}
              <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                <div>
                  <span className="block font-medium text-foreground">Section Visibility</span>
                  <span className="text-[11px] text-muted-foreground">
                    {presentation.visible ? "Visible on storefront" : "Hidden on storefront"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isLocked}
                  data-testid="inspector-visibility-toggle"
                  onClick={() => onUpdateNodeVisibility(node.id, !presentation.visible)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-50",
                    presentation.visible
                      ? "border-border bg-secondary/60 text-foreground hover:bg-secondary"
                      : "border-amber-500/40 bg-amber-500/15 text-amber-300",
                  )}
                >
                  {presentation.visible ? (
                    <>
                      <Eye className="size-3.5" />
                      <span>Visible</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-3.5" />
                      <span>Hidden</span>
                    </>
                  )}
                </button>
              </div>

              {/* Layer Lock Control */}
              {onToggleNodeLock && (
                <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                  <div>
                    <span className="block font-medium text-foreground">Layer Lock State</span>
                    <span className="text-[11px] text-muted-foreground">
                      {isAncestorLocked
                        ? `Locked by parent (${lockedByAncestorName ?? "Ancestor"})`
                        : isDirectlyLocked
                          ? "Locked against edits and moves"
                          : "Unlocked (Editable)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!canToggleNodeLock}
                    data-testid="inspector-lock-toggle"
                    onClick={() => onToggleNodeLock(node.id, !isDirectlyLocked)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-50",
                      isDirectlyLocked || isAncestorLocked
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                        : "border-border bg-secondary/60 text-foreground hover:bg-secondary",
                    )}
                  >
                    {isDirectlyLocked || isAncestorLocked ? (
                      <>
                        <Lock className="size-3.5" />
                        <span>Locked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="size-3.5" />
                        <span>Unlocked</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>

            {/* Editable Content Properties (Strictly Gated by Registry Capabilities) */}
            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-xs font-semibold text-foreground">
                  Editable Content Properties
                </h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {supportedTextFields.length} supported
                </span>
              </div>

              {isLocked ? (
                <p
                  data-testid="inspector-locked-notice"
                  className="rounded-lg border border-border/70 bg-secondary/30 p-2.5 text-[11px] leading-relaxed text-muted-foreground"
                >
                  {isGlobalRouteChrome
                    ? "Global Store Header and Footer content (logo, navigation, social links, and legal copy) is shared across all storefront routes and managed in Admin → Settings."
                    : isAncestorLocked
                      ? `This component is locked because its parent container "${lockedByAncestorName ?? "Parent"}" is locked. Unlock the parent container to edit.`
                      : "This component is locked. Unlock it to modify content properties."}
                </p>
              ) : supportedTextFields.length > 0 ? (
                <div className="space-y-3">
                  {supportedTextFields.map((field) => {
                    const currentVal = (node.props[field.key] as string | undefined) ?? "";
                    const inputId = `inspector-prop-${field.key}`;
                    return (
                      <div key={field.key} className="space-y-1">
                        <label
                          htmlFor={inputId}
                          className="flex items-center justify-between text-[11px] text-muted-foreground"
                        >
                          <span>{field.label}</span>
                          <code className="font-mono text-[10px]">props.{field.key}</code>
                        </label>
                        {field.multiline ? (
                          <textarea
                            id={inputId}
                            rows={2}
                            value={currentVal}
                            placeholder={field.placeholder}
                            data-testid={`inspector-prop-${field.key}`}
                            onChange={(e) => onUpdateNodeProp(node.id, field.key, e.target.value)}
                            className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
                          />
                        ) : (
                          <input
                            id={inputId}
                            type="text"
                            value={currentVal}
                            placeholder={field.placeholder}
                            data-testid={`inspector-prop-${field.key}`}
                            onChange={(e) => onUpdateNodeProp(node.id, field.key, e.target.value)}
                            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p
                  data-testid="inspector-no-editable-text-props"
                  className="rounded-lg border border-border/70 bg-secondary/25 p-2.5 text-[11px] leading-relaxed text-muted-foreground"
                >
                  Component <code className="font-mono text-foreground">{node.type}</code> is driven
                  by live catalog or media bindings and has no freeform text properties in this
                  phase.
                </p>
              )}
            </section>

            {/* Supported Capabilities Summary */}
            {capabilities && (
              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="font-sans text-xs font-semibold text-foreground">
                  Registry Capabilities
                </h3>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {capabilities.description}
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="size-3 text-primary" />
                    <span>Selectable: {capabilities.selectable ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="size-3 text-primary" />
                    <span>Status: {capabilities.status}</span>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: LAYOUT, DIMENSIONS & SPACING */}
        {activeTab === "layout" && (
          <div className="space-y-3">
            {/* Dimensions & Constraints Section */}
            {(supportsWidth || supportsHeight || supportsMinMax || supportsAspectRatio) && (
              <PropertySection
                id="dimensions"
                title={`Dimensions & Constraints (${breakpoint})`}
                defaultExpanded
              >
                <div className="grid grid-cols-2 gap-2.5">
                  {supportsWidth && (
                    <DimensionControl
                      label="Width"
                      propertyPath="geometry.width"
                      state={widthState}
                      renderedPx={selectedGeometry?.renderedWidthPx}
                      disabled={isLocked}
                      onChange={(val) => applyStylePath("geometry.width", val)}
                      onReset={() => resetStylePath("geometry.width")}
                    />
                  )}
                  {supportsHeight && (
                    <DimensionControl
                      label="Height"
                      propertyPath="geometry.height"
                      state={heightState}
                      renderedPx={selectedGeometry?.renderedHeightPx}
                      disabled={isLocked}
                      onChange={(val) => applyStylePath("geometry.height", val)}
                      onReset={() => resetStylePath("geometry.height")}
                    />
                  )}
                  {supportsMinMax && (
                    <>
                      <DimensionControl
                        label="Min Width"
                        propertyPath="geometry.minWidth"
                        state={minWidthState}
                        disabled={isLocked}
                        onChange={(val) => applyStylePath("geometry.minWidth", val)}
                        onReset={() => resetStylePath("geometry.minWidth")}
                      />
                      <DimensionControl
                        label="Max Width"
                        propertyPath="geometry.maxWidth"
                        state={maxWidthState}
                        disabled={isLocked}
                        onChange={(val) => applyStylePath("geometry.maxWidth", val)}
                        onReset={() => resetStylePath("geometry.maxWidth")}
                      />
                      <DimensionControl
                        label="Min Height"
                        propertyPath="geometry.minHeight"
                        state={minHeightState}
                        disabled={isLocked}
                        onChange={(val) => applyStylePath("geometry.minHeight", val)}
                        onReset={() => resetStylePath("geometry.minHeight")}
                      />
                      <DimensionControl
                        label="Max Height"
                        propertyPath="geometry.maxHeight"
                        state={maxHeightState}
                        disabled={isLocked}
                        onChange={(val) => applyStylePath("geometry.maxHeight", val)}
                        onReset={() => resetStylePath("geometry.maxHeight")}
                      />
                    </>
                  )}
                </div>

                {supportsAspectRatio && (
                  <AspectRatioControl
                    state={aspectRatioState}
                    disabled={isLocked}
                    onChange={(ratio) => applyStylePath("geometry.aspectRatio", ratio)}
                    onReset={() => resetStylePath("geometry.aspectRatio")}
                  />
                )}
              </PropertySection>
            )}

            {/* Spacing Overrides Section */}
            <PropertySection
              id="spacing"
              title={`Spacing Overrides (${breakpoint})`}
              defaultExpanded
            >
              {supportsPadding && !isLocked ? (
                <SpacingControl
                  field="padding"
                  label="Padding"
                  state={paddingState}
                  disabled={isLocked}
                  onChange={(box) => onUpdateNodeSpacing(node.id, "padding", box, breakpoint)}
                  onReset={() => onUpdateNodeSpacing(node.id, "padding", undefined, breakpoint)}
                />
              ) : (
                <p className="rounded-lg border border-border/70 bg-secondary/25 p-2.5 text-[11px] text-muted-foreground">
                  {isLocked ? (
                    "Layer is locked. Unlock to edit spacing."
                  ) : (
                    <>
                      Padding overrides are not supported on{" "}
                      <code className="font-mono text-foreground">{node.type}</code>.
                    </>
                  )}
                </p>
              )}

              {supportsMargin && !isLocked && (
                <div className="border-t border-border/60 pt-3">
                  <SpacingControl
                    field="margin"
                    label="Vertical & Horizontal Margin"
                    state={marginState}
                    disabled={isLocked}
                    onChange={(box) => onUpdateNodeSpacing(node.id, "margin", box, breakpoint)}
                    onReset={() => onUpdateNodeSpacing(node.id, "margin", undefined, breakpoint)}
                  />
                </div>
              )}

              {supportsGap && !isLocked && (
                <GapControl
                  columnGapState={columnGapState}
                  rowGapState={rowGapState}
                  disabled={isLocked}
                  onChangeColumnGap={(gapPx) => {
                    applyStylePath("layout.flex.columnGapPx", gapPx);
                    if (supportsGridColumns) {
                      applyStylePath("layout.grid.columnGapPx", gapPx);
                    }
                  }}
                  onChangeRowGap={(gapPx) => {
                    applyStylePath("layout.flex.rowGapPx", gapPx);
                    if (supportsGridColumns) {
                      applyStylePath("layout.grid.rowGapPx", gapPx);
                    }
                  }}
                  onResetColumnGap={() => {
                    resetStylePath("layout.flex.columnGapPx");
                    if (supportsGridColumns) {
                      resetStylePath("layout.grid.columnGapPx");
                    }
                  }}
                  onResetRowGap={() => {
                    resetStylePath("layout.flex.rowGapPx");
                    if (supportsGridColumns) {
                      resetStylePath("layout.grid.rowGapPx");
                    }
                  }}
                />
              )}
            </PropertySection>

            {/* Flexbox, CSS Grid & Child Placement Controls */}
            {(supportsFlexAlignment || supportsGridColumns || supportsBentoSpan) && (
              <PropertySection
                id="container-layout"
                title={`Layout & Alignment (${breakpoint})`}
                defaultExpanded
              >
                <LayoutControls
                  componentType={node.type}
                  supportsFlexAlignment={supportsFlexAlignment}
                  supportsGridColumns={supportsGridColumns}
                  supportsBentoSpan={supportsBentoSpan}
                  layoutModeState={layoutModeState}
                  flexState={flexState}
                  gridState={gridState}
                  flexItemState={flexItemState}
                  gridItemState={gridItemState}
                  disabled={isLocked}
                  onUpdateStylePath={applyStylePath}
                  onResetStylePath={resetStylePath}
                />
              </PropertySection>
            )}

            {/* Rendered DOM Geometry vs. Configured Design Geometry (Prompt 10, Part 14, Sections 40–42) */}
            <section className="space-y-2 pt-2">
              <InspectorGeometryComparisonCard
                renderedMeasurement={selectedGeometry}
                configuredGeometry={configuredGeometry}
              />
              <p className="mt-2 rounded-lg border border-border/70 bg-secondary/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                Direct canvas resize handles, rotation handles, and interactive grid/bento span
                manipulation are scheduled for Phases 4–6.
              </p>
            </section>
          </div>
        )}

        {/* TAB 3: APPEARANCE, SHAPE, TYPOGRAPHY & MEDIA */}
        {activeTab === "appearance" && (
          <div className="space-y-3">
            {/* Surface & Background */}
            <PropertySection
              id="surface"
              title={`Surface & Background (${breakpoint})`}
              defaultExpanded
            >
              {supportsBgColor && !isLocked ? (
                <ColorControl
                  label="Background Token or Custom Color"
                  propertyPath="appearance.backgroundColor"
                  state={bgColorState}
                  disabled={isLocked}
                  selectTestId="inspector-bg-token-select"
                  inputTestId="inspector-bg-color-input"
                  pickerTestId="inspector-bg-color-picker"
                  onChange={(color) =>
                    onUpdateNodeAppearance(node.id, { backgroundColor: color }, breakpoint)
                  }
                  onReset={() =>
                    onUpdateNodeAppearance(node.id, { backgroundColor: null }, breakpoint)
                  }
                />
              ) : (
                <p className="rounded-lg border border-border/70 bg-secondary/25 p-2.5 text-[11px] text-muted-foreground">
                  {isLocked ? (
                    "Layer is locked. Unlock to customize surface colors."
                  ) : (
                    <>
                      Background color overrides are disabled on{" "}
                      <code className="font-mono text-foreground">{node.type}</code> to preserve
                      cosmic scene transparency.
                    </>
                  )}
                </p>
              )}

              {supportsGradient && !isLocked && (
                <GradientControl
                  state={gradientState}
                  disabled={isLocked}
                  onChange={(grad) => applyStylePath("appearance.backgroundGradient", grad)}
                  onReset={() => resetStylePath("appearance.backgroundGradient")}
                />
              )}
            </PropertySection>

            {/* Shape & Corner Radius */}
            <PropertySection
              id="shape"
              title={`Shape & Corner Radius (${breakpoint})`}
              defaultExpanded
            >
              {supportsShapeType && !isLocked && (
                <ShapeControl
                  supportsShapeType={supportsShapeType}
                  supportsClipShape={supportsClipShape}
                  shapeTypeState={shapeTypeState}
                  clipPresetState={clipPresetState}
                  disabled={isLocked}
                  onChangeShapeType={(st) => applyStylePath("shape.shapeType", st)}
                  onResetShapeType={() => resetStylePath("shape.shapeType")}
                  onChangeClipPreset={(cp) => applyStylePath("shape.clipPreset", cp)}
                  onResetClipPreset={() => resetStylePath("shape.clipPreset")}
                />
              )}

              {supportsCornerRadius && !isLocked ? (
                <CornerRadiusControl
                  state={cornerRadiusState}
                  disabled={isLocked}
                  onChange={(radius) => {
                    if (!radius) {
                      onUpdateNodeAppearance(node.id, { cornerRadiusPx: null }, breakpoint);
                    } else if (
                      radius.mode === "uniform" &&
                      radius.unit === "px" &&
                      radius.uniform !== undefined &&
                      !onUpdateStyleProperty
                    ) {
                      onUpdateNodeAppearance(
                        node.id,
                        { cornerRadiusPx: radius.uniform },
                        breakpoint,
                      );
                    } else {
                      applyStylePath("shape.cornerRadius", radius);
                    }
                  }}
                  onReset={() => resetStylePath("shape.cornerRadius")}
                />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {isLocked
                    ? "Layer is locked."
                    : "Corner radius is controlled by the underlying storefront component."}
                </p>
              )}
            </PropertySection>

            {/* Typography */}
            {supportsTypography && (
              <PropertySection
                id="typography"
                title={`Typography (${breakpoint})`}
                defaultExpanded
              >
                <TypographyControls
                  typographyState={typographyState}
                  textColorState={textColorState}
                  disabled={isLocked}
                  onUpdateStylePath={applyStylePath}
                  onResetStylePath={resetStylePath}
                />
              </PropertySection>
            )}

            {/* Media Presentation */}
            {supportsImageCrop && (
              <PropertySection
                id="media"
                title={`Media Presentation (${breakpoint})`}
                defaultExpanded
              >
                <MediaPresentationControls
                  imageCropState={imageCropState}
                  mediaSourceUrl={primaryMediaUrl}
                  disabled={isLocked}
                  onChange={(crop) => applyStylePath("shape.imageCrop", crop)}
                  onReset={() => resetStylePath("shape.imageCrop")}
                />
              </PropertySection>
            )}

            {/* Borders, Shadows, Opacity & Filters */}
            <PropertySection
              id="effects"
              title={`Borders, Shadows & Opacity (${breakpoint})`}
              defaultExpanded
            >
              {supportsBorder || supportsShadow || supportsOpacity || supportsFilters ? (
                <AppearanceEffectsControl
                  supportsBorder={supportsBorder && !isLocked}
                  supportsShadow={supportsShadow && !isLocked}
                  supportsOpacity={supportsOpacity && !isLocked}
                  supportsFilters={supportsFilters && !isLocked}
                  borderState={borderState}
                  shadowState={shadowState}
                  opacityState={opacityState}
                  filtersState={filtersState}
                  disabled={isLocked}
                  onChangeBorder={(b) => applyStylePath("appearance.border", b)}
                  onResetBorder={() => resetStylePath("appearance.border")}
                  onChangeShadow={(s) => applyStylePath("appearance.shadow", s)}
                  onResetShadow={() => resetStylePath("appearance.shadow")}
                  onChangeOpacity={(op) =>
                    onUpdateNodeAppearance(node.id, { opacity: op }, breakpoint)
                  }
                  onResetOpacity={() =>
                    onUpdateNodeAppearance(node.id, { opacity: null }, breakpoint)
                  }
                  onChangeFilters={(f) => applyStylePath("appearance.filters", f)}
                  onResetFilters={() => resetStylePath("appearance.filters")}
                />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Visual effects overrides are not supported on this layer.
                </p>
              )}
            </PropertySection>
          </div>
        )}

        {/* TAB 4: RESPONSIVE, BINDINGS & ADVANCED */}
        {activeTab === "responsive" && (
          <div className="space-y-4">
            {/* Responsive Inheritance & Per-Property Override Reset */}
            <ResponsivePropertyControl
              node={node}
              breakpoint={breakpoint}
              disabled={isLocked}
              onResetPropertyAtBreakpoint={(path) => resetStylePath(path)}
              onResetAllAtBreakpoint={() => {
                if (onResetBreakpointOverrides) {
                  onResetBreakpointOverrides(node.id, breakpoint);
                }
              }}
            />

            {/* Data Binding Summary */}
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="font-sans text-xs font-semibold text-foreground">
                Data Catalog Binding
              </h3>
              {node.binding ? (
                <div
                  data-testid="inspector-binding-summary"
                  className="space-y-1 rounded-lg border border-border/80 bg-secondary/25 p-2.5 font-mono text-[11px]"
                >
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kind</span>
                    <span className="text-foreground">{node.binding.kind}</span>
                  </div>
                  {"source" in node.binding && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Source</span>
                      <span className="text-foreground">{node.binding.source}</span>
                    </div>
                  )}
                  {"mode" in node.binding && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mode</span>
                      <span className="text-foreground">{node.binding.mode}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Static layout/presentation component (no catalog collection binding).
                </p>
              )}
            </section>

            {/* Protected Business Fields Notice (Part 10, Section 25) */}
            <section
              data-testid="inspector-protected-business-notice"
              className="space-y-2 border-t border-border pt-4"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                <h3 className="font-sans text-xs font-semibold text-foreground">
                  Protected Business Data Boundary
                </h3>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Product prices, currencies, retailer affiliate URLs, and category assignments are
                strictly read-only in the visual editor to protect live commerce integrity. Manage
                catalog records in <strong>Admin → Products</strong>.
              </p>
            </section>

            {/* Unsupported Style Paths Disclosure */}
            {capabilities && capabilities.unsupportedStylePaths.length > 0 && (
              <section className="space-y-1.5 border-t border-border pt-4">
                <h3 className="font-sans text-xs font-semibold text-foreground">
                  Protected Style Paths
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Ignored on <code className="font-mono text-foreground">{node.type}</code> to
                  preserve storefront fidelity:
                </p>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {capabilities.unsupportedStylePaths.join(" · ")}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
