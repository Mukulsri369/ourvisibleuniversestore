import type { RenderMode } from "../rendering/RenderContext";

/**
 * Explicit pointer interaction states for the Design Studio (Prompt 10, Part 11, Section 31).
 * - Active in Prompt 10: `"idle"`, `"hovering"`, `"selecting"`, `"navigating_hierarchy"`, `"editing_text"`, `"canvas_panning"`, `"previewing"`
 * - Reserved for later prompts (Prompts 11–18): `"dragging"`, `"resizing"`, `"reshaping"`
 */
export const STUDIO_INTERACTION_MODES = [
  "idle",
  "hovering",
  "selecting",
  "navigating_hierarchy",
  "editing_text",
  "canvas_panning",
  "previewing",
  "dragging",
  "resizing",
  "reshaping",
] as const;

export type StudioPointerInteractionMode = (typeof STUDIO_INTERACTION_MODES)[number];

/**
 * Reserved transform modes that take exclusive ownership of pointer events when active in future prompts,
 * preventing selection or hover updates from competing with active drag/resize/reshape gestures.
 */
export function isReservedTransformInteractionMode(mode: StudioPointerInteractionMode): boolean {
  return mode === "dragging" || mode === "resizing" || mode === "reshaping";
}

export function canSelectInInteractionMode(
  interactionMode: StudioPointerInteractionMode,
  renderMode: RenderMode,
): boolean {
  if (renderMode !== "editor") return false;
  if (interactionMode === "previewing" || interactionMode === "canvas_panning") return false;
  if (isReservedTransformInteractionMode(interactionMode)) return false;
  return true;
}

export function canHoverInInteractionMode(
  interactionMode: StudioPointerInteractionMode,
  renderMode: RenderMode,
): boolean {
  if (renderMode !== "editor") return false;
  if (
    interactionMode === "previewing" ||
    interactionMode === "canvas_panning" ||
    interactionMode === "editing_text"
  ) {
    return false;
  }
  if (isReservedTransformInteractionMode(interactionMode)) return false;
  return true;
}

export function resolveInteractionModeForRenderMode(
  renderMode: Extract<RenderMode, "editor" | "preview">,
  hoveredNodeId: string | null,
): StudioPointerInteractionMode {
  if (renderMode === "preview") return "previewing";
  return hoveredNodeId ? "hovering" : "idle";
}
