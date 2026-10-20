import type { CSSProperties } from "react";
import type { EditorNode } from "../schema/nodes";
import type { EditorBreakpoint, NodeStyleBundle } from "../schema/responsive";
import { mergeStyleBundles, resolveResponsiveStyle } from "../utils/responsive-resolution";
import { resolveNodeCssProperties } from "./style-resolver";

export interface ResolvedNodePresentation {
  readonly visible: boolean;
  readonly resolvedStyleBundle: NodeStyleBundle;
  readonly inlineStyle: CSSProperties | undefined;
}

/**
 * Resolves the responsive `NodeStyleBundle` and safe `CSSProperties` for a node at a given breakpoint.
 * Supports optional template inheritance (e.g. reusable ProductCard or CategoryCard templates).
 */
export function resolveResponsiveNodePresentation(
  node: Pick<EditorNode, "hidden" | "style" | "responsive">,
  breakpoint: EditorBreakpoint,
  templateBaseStyle?: NodeStyleBundle,
): ResolvedNodePresentation {
  const nodeResolved = resolveResponsiveStyle(node, breakpoint);
  const combinedBundle = templateBaseStyle
    ? mergeStyleBundles(templateBaseStyle, nodeResolved)
    : nodeResolved;

  const isVisible = !node.hidden && combinedBundle.visible !== false;
  const inlineStyle = resolveNodeCssProperties(combinedBundle);

  return {
    visible: isVisible,
    resolvedStyleBundle: combinedBundle,
    inlineStyle,
  };
}

/**
 * Maps a viewport width in pixels to the corresponding `EditorBreakpoint`.
 */
export function resolveBreakpointFromWidth(widthPx: number): EditorBreakpoint {
  if (widthPx >= 1536) return "desktop_xl";
  if (widthPx >= 1024) return "desktop";
  if (widthPx >= 640) return "tablet";
  if (widthPx >= 380) return "mobile";
  return "mobile_sm";
}
