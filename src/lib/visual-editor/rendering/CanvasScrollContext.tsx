import React, { createContext, useContext, type RefObject } from "react";

export interface CanvasScrollContextValue {
  /**
   * Reference to the studio canvas scrollable viewport element when rendered inside
   * the Design Studio. `null` or omitted on the public storefront.
   */
  readonly scrollContainerRef: RefObject<HTMLElement | null>;
  /**
   * True when `PageRenderer` is mounted inside the isolated Design Studio canvas
   * so fixed-position viewport layers (`CelestialScrollWorld`) scope themselves
   * to the canvas stage rather than the outer admin browser window.
   */
  readonly isIsolatedStudioCanvas: boolean;
}

const CanvasScrollContext = createContext<CanvasScrollContextValue | null>(null);

export interface CanvasScrollProviderProps {
  value: CanvasScrollContextValue;
  children: React.ReactNode;
}

export function CanvasScrollProvider({ value, children }: CanvasScrollProviderProps) {
  return <CanvasScrollContext.Provider value={value}>{children}</CanvasScrollContext.Provider>;
}

export function useCanvasScrollContext(): CanvasScrollContextValue | null {
  return useContext(CanvasScrollContext);
}
