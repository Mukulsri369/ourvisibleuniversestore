import React from "react";
import { PlanetHero } from "@/components/store/PlanetHero";
import { PLANETS } from "@/lib/planets";
import type { ComponentAdapterRenderProps } from "../registry/component-registry";
import { usePageRenderContext } from "../rendering/RenderContext";
import { AdapterBoundary } from "./AdapterBoundary";

/**
 * Adapter for `src/components/store/PlanetHero.tsx`.
 * - In `public`, `editor`, and `preview` modes: renders the real `<PlanetHero />` component
 *   preserving planet posters, lazy video playback, IntersectionObserver lifecycle, and side slots.
 * - In `mini_preview` mode (when `disableHeavyMediaAndScrollEffects` is true): renders a
 *   lightweight static poster representation so inspector thumbnails never spawn duplicate `<video>` decoders.
 */
export function PlanetHeroAdapter({ node, resolvedStyle }: ComponentAdapterRenderProps) {
  const { interactionPolicy } = usePageRenderContext();

  if (interactionPolicy.disableHeavyMediaAndScrollEffects) {
    const defaultPlanetId = resolvedStyle.animation?.planetHero?.defaultPlanetId ?? "earth";
    const planet = PLANETS.find((p) => p.id === defaultPlanetId) ?? PLANETS[0];

    return (
      <AdapterBoundary
        node={node}
        resolvedStyle={resolvedStyle}
        disableWrapperWhenUnstyledInPublic={false}
      >
        <section
          className="relative overflow-hidden rounded-xl border border-border/60 bg-background p-4 text-center"
          aria-label="Planet Hero Mini Preview"
          data-mini-preview-component="PlanetHero"
        >
          <img
            src={planet.poster}
            alt={planet.name}
            className="mx-auto h-28 w-full rounded-lg object-cover opacity-80"
          />
          <div className="mt-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {node.props.brandTitle ?? "OUR VISIBLE UNIVERSE"}{" "}
              <span className="text-primary">{node.props.brandHighlight ?? "STORE"}</span>
            </p>
            <p className="mt-0.5 font-display text-lg text-foreground">{planet.name}</p>
          </div>
        </section>
      </AdapterBoundary>
    );
  }

  const shouldWrapRelativeZ10 = node.props.customAttributes?.wrapRelativeZ10 === true;

  return (
    <AdapterBoundary node={node} resolvedStyle={resolvedStyle}>
      {shouldWrapRelativeZ10 ? (
        <div className="relative z-10">
          <PlanetHero />
        </div>
      ) : (
        <PlanetHero />
      )}
    </AdapterBoundary>
  );
}
