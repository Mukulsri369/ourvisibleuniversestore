import React from "react";
import { CelestialScrollWorld } from "@/components/store/CelestialScrollWorld";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";

/**
 * Adapter for `src/components/store/CelestialScrollWorld.tsx`.
 * - Preserves the fixed-position (`fixed inset-0 pointer-events-none z-0`) scroll trajectory layer
 *   without wrapping it in any clipping or relative container that could break viewport coordinates.
 * - In `mini_preview` mode (`disableHeavyMediaAndScrollEffects`), renders a lightweight badge
 *   instead of mounting global window scroll listeners.
 */
export function CelestialScrollWorldAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { mode, interactionPolicy } = usePageRenderContext();

  const celestialConfig = resolvedStyle.animation?.celestialScroll;
  if (celestialConfig?.enabled === false) {
    return null;
  }

  if (interactionPolicy.disableHeavyMediaAndScrollEffects) {
    return (
      <div
        data-mini-preview-component="CelestialScrollWorld"
        className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground"
      >
        Celestial Scroll World (Earth · Venus · Mars Orbital Layer)
      </div>
    );
  }

  // Never wrap CelestialScrollWorld in an overflow-clipping or positioned container in public/editor/preview
  if (mode === "editor" && interactionPolicy.emitEditorTelemetryAttributes) {
    return (
      <div
        data-editor-node-id={node.id}
        data-editor-node-type={node.type}
        data-editor-global-layer="celestial-scroll-world"
        className="contents"
      >
        <CelestialScrollWorld />
      </div>
    );
  }

  return <CelestialScrollWorld />;
}
