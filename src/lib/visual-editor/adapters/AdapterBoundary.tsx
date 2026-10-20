import React from "react";
import type { EditorNode } from "../schema/nodes";
import type { NodeStyleBundle } from "../schema/responsive";
import { usePageRenderContext } from "../rendering/RenderContext";
import { resolveNodeCssProperties } from "../rendering/style-resolver";

export interface AdapterBoundaryProps {
  node: EditorNode;
  resolvedStyle: NodeStyleBundle;
  templateBaseStyle?: NodeStyleBundle;
  disableWrapperWhenUnstyledInPublic?: boolean;
  children: React.ReactNode;
}

/**
 * Shared adapter boundary that enforces:
 * 1. Zero extra DOM wrapper in `"public"` mode when no explicit style override is set
 *    (`No explicit design override -> exact existing component DOM`).
 * 2. Capture-phase navigation & affiliate click interception in `"editor"`, `"preview"`,
 *    and `"mini_preview"` modes so clicking a ProductCard or BuyButton selects the node
 *    in the editor without navigating away or logging fake outbound clicks.
 * 3. Stable `data-editor-node-id` identity attributes in editor mode.
 */
export function AdapterBoundary({
  node,
  resolvedStyle,
  templateBaseStyle,
  disableWrapperWhenUnstyledInPublic = true,
  children,
}: AdapterBoundaryProps) {
  const { mode, interactionPolicy, selectedNodeId, hoveredNodeId, onSelectNode, onHoverNode } =
    usePageRenderContext();

  const mergedStyleBundle: NodeStyleBundle = templateBaseStyle
    ? {
        ...templateBaseStyle,
        ...resolvedStyle,
        geometry: { ...templateBaseStyle.geometry, ...resolvedStyle.geometry },
        shape: { ...templateBaseStyle.shape, ...resolvedStyle.shape },
        layout: { ...templateBaseStyle.layout, ...resolvedStyle.layout },
        appearance: { ...templateBaseStyle.appearance, ...resolvedStyle.appearance },
      }
    : resolvedStyle;

  const inlineStyle = resolveNodeCssProperties(mergedStyleBundle);

  // Rule 20: In public mode with no style overrides, render the underlying component directly
  if (mode === "public" && !inlineStyle && disableWrapperWhenUnstyledInPublic) {
    return <>{children}</>;
  }

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === "public") return;

    const target = e.target as HTMLElement | null;
    const closestNodeEl = target?.closest?.("[data-editor-node-id]");

    // If a deeper registered EditorNode exists along the event path, let its own capture handler intercept
    if (closestNodeEl && closestNodeEl !== e.currentTarget) {
      return;
    }

    const anchor = target?.closest?.("a");

    if (interactionPolicy.interceptNodeClickForSelection) {
      e.preventDefault();
      e.stopPropagation();
      onSelectNode?.(node.id);
      return;
    }

    // In preview or mini_preview mode, block affiliate redirects and navigation links
    if (
      anchor &&
      (!interactionPolicy.allowNavigation || !interactionPolicy.allowAffiliateRedirect)
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const editorAttrs: Record<string, string | undefined> =
    interactionPolicy.emitEditorTelemetryAttributes
      ? {
          "data-editor-node-id": node.id,
          "data-editor-node-type": node.type,
          "data-editor-selected": selectedNodeId === node.id ? "true" : undefined,
          "data-editor-hovered": hoveredNodeId === node.id ? "true" : undefined,
          "data-editor-locked": node.locked ? "true" : undefined,
        }
      : {};

  return (
    <div
      style={inlineStyle}
      onClickCapture={mode !== "public" ? handleClickCapture : undefined}
      onMouseEnter={
        interactionPolicy.emitEditorTelemetryAttributes ? () => onHoverNode?.(node.id) : undefined
      }
      onMouseLeave={
        interactionPolicy.emitEditorTelemetryAttributes ? () => onHoverNode?.(null) : undefined
      }
      {...editorAttrs}
    >
      {children}
    </div>
  );
}
