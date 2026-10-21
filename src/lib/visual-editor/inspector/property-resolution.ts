import type { EditorNode } from "../schema/nodes";
import type {
  EditorBreakpoint,
  NodeStyleBundle,
  OverrideBreakpoint,
} from "../schema/responsive";
import {
  BREAKPOINT_INHERITANCE_CHAIN,
  resolveResponsiveStyle,
} from "../utils/responsive-resolution";
import type { InspectorStylePath } from "./property-capabilities";

export type InspectorValueOrigin =
  | "component_default"
  | "theme_token"
  | "base_desktop"
  | "inherited_breakpoint"
  | "explicit_breakpoint_override";

export interface ResolvedInspectorPropertyState<T = unknown> {
  readonly path: InspectorStylePath | string;
  readonly breakpoint: EditorBreakpoint;
  readonly value: T | undefined;
  readonly explicitValueAtBreakpoint: T | undefined;
  readonly baseDesktopValue: T | undefined;
  readonly inheritedValue: T | undefined;
  readonly origin: InspectorValueOrigin;
  readonly sourceBreakpoint: EditorBreakpoint | null;
  readonly isThemeToken: boolean;
  readonly hasExplicitOverrideAtBreakpoint: boolean;
  readonly canResetAtBreakpoint: boolean;
}

const ATOMIC_VALUE_PATHS: ReadonlySet<string> = new Set([
  "geometry.width",
  "geometry.height",
  "geometry.minWidth",
  "geometry.maxWidth",
  "geometry.minHeight",
  "geometry.maxHeight",
  "geometry.padding",
  "geometry.margin",
  "shape.cornerRadius",
  "appearance.typography.fontSize",
]);

function isNonEmptyPlainObject(val: unknown): val is Record<string, unknown> {
  if (val === null || typeof val !== "object" || Array.isArray(val)) {
    return false;
  }
  return Object.keys(val as Record<string, unknown>).some(
    (k) => (val as Record<string, unknown>)[k] !== undefined,
  );
}

/**
 * Reads a value at a dot-separated path inside a `NodeStyleBundle`.
 */
export function getNestedPropertyAtPath<T = unknown>(
  bundle: NodeStyleBundle | undefined,
  path: InspectorStylePath | string,
): T | undefined {
  if (!bundle) return undefined;
  const segments = path.split(".");
  let current: unknown = bundle;

  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }

  if (
    current !== undefined &&
    !ATOMIC_VALUE_PATHS.has(path) &&
    typeof current === "object" &&
    current !== null &&
    !Array.isArray(current) &&
    !("unit" in (current as Record<string, unknown>))
  ) {
    return isNonEmptyPlainObject(current) ? (current as T) : undefined;
  }

  return current as T | undefined;
}

/**
 * Checks whether a `NodeStyleBundle` has an explicit value (or non-empty nested object) at `path`.
 */
export function hasExplicitPropertyInBundle(
  bundle: NodeStyleBundle | undefined,
  path: InspectorStylePath | string,
): boolean {
  const val = getNestedPropertyAtPath(bundle, path);
  if (val === undefined) return false;
  if (
    typeof val === "object" &&
    val !== null &&
    !Array.isArray(val) &&
    !ATOMIC_VALUE_PATHS.has(path) &&
    !("unit" in (val as Record<string, unknown>))
  ) {
    return isNonEmptyPlainObject(val);
  }
  return true;
}

/**
 * Resolves the effective value, inheritance source, and reset eligibility for a style path
 * on `node` at `breakpoint`.
 */
export function resolveInspectorPropertyState<T = unknown>(
  node: Pick<EditorNode, "style" | "responsive" | "hidden">,
  path: InspectorStylePath | string,
  breakpoint: EditorBreakpoint,
): ResolvedInspectorPropertyState<T> {
  if (path === "visible") {
    const baseVisible = !node.hidden;
    const chain = BREAKPOINT_INHERITANCE_CHAIN[breakpoint];
    let effectiveVisible = baseVisible;
    let sourceBp: EditorBreakpoint = "desktop";
    let inheritedVis = baseVisible;

    for (const step of chain) {
      const stepVis = node.responsive?.[step]?.visible;
      if (stepVis !== undefined) {
        if (step !== breakpoint) {
          inheritedVis = stepVis;
        }
        effectiveVisible = stepVis;
        sourceBp = step;
      }
    }

    const explicitAtBp =
      breakpoint === "desktop"
        ? node.hidden !== undefined
          ? !node.hidden
          : undefined
        : node.responsive?.[breakpoint]?.visible;

    const hasExplicit = explicitAtBp !== undefined;
    const origin: InspectorValueOrigin =
      breakpoint === "desktop"
        ? node.hidden
          ? "base_desktop"
          : "component_default"
        : hasExplicit
          ? "explicit_breakpoint_override"
          : sourceBp !== "desktop" || node.hidden
            ? "inherited_breakpoint"
            : "component_default";

    return {
      path,
      breakpoint,
      value: effectiveVisible as unknown as T,
      explicitValueAtBreakpoint: explicitAtBp as unknown as T | undefined,
      baseDesktopValue: baseVisible as unknown as T,
      inheritedValue: (breakpoint === "desktop" ? true : inheritedVis) as unknown as T,
      origin,
      sourceBreakpoint: origin === "component_default" ? null : sourceBp,
      isThemeToken: false,
      hasExplicitOverrideAtBreakpoint: hasExplicit,
      canResetAtBreakpoint:
        breakpoint === "desktop" ? Boolean(node.hidden) : explicitAtBp !== undefined,
    };
  }

  const resolvedBundle = resolveResponsiveStyle(node, breakpoint);
  const value = getNestedPropertyAtPath<T>(resolvedBundle, path);
  const baseDesktopValue = getNestedPropertyAtPath<T>(node.style, path);

  const targetBundle =
    breakpoint === "desktop" ? node.style : node.responsive?.[breakpoint];
  const explicitValueAtBreakpoint = getNestedPropertyAtPath<T>(targetBundle, path);
  const hasExplicit = hasExplicitPropertyInBundle(targetBundle, path);

  // Compute the value inherited from earlier steps in the chain (before `breakpoint`)
  const chain = BREAKPOINT_INHERITANCE_CHAIN[breakpoint];
  let sourceBreakpoint: EditorBreakpoint | null =
    hasExplicitPropertyInBundle(node.style, path) ? "desktop" : null;

  let inheritedBundle: NodeStyleBundle = node.style ? { ...node.style } : {};
  for (const step of chain) {
    if (step === breakpoint) {
      if (hasExplicitPropertyInBundle(node.responsive?.[step], path)) {
        sourceBreakpoint = step;
      }
      break;
    }
    const stepBundle = node.responsive?.[step];
    if (stepBundle && hasExplicitPropertyInBundle(stepBundle, path)) {
      sourceBreakpoint = step;
    }
    if (stepBundle) {
      inheritedBundle = resolveResponsiveStyle(
        {
          style: node.style,
          responsive: Object.fromEntries(
            chain
              .slice(0, chain.indexOf(step) + 1)
              .map((s) => [s, node.responsive?.[s]])
              .filter(([, b]) => Boolean(b)),
          ),
        },
        step,
      );
    }
  }

  const inheritedValue =
    breakpoint === "desktop"
      ? undefined
      : getNestedPropertyAtPath<T>(inheritedBundle, path);

  const isThemeToken = typeof value === "string" && value.startsWith("token:");

  let origin: InspectorValueOrigin = "component_default";
  if (value === undefined) {
    origin = "component_default";
  } else if (breakpoint !== "desktop" && hasExplicit) {
    origin = "explicit_breakpoint_override";
  } else if (breakpoint !== "desktop" && sourceBreakpoint !== null) {
    origin = "inherited_breakpoint";
  } else if (isThemeToken) {
    origin = "theme_token";
  } else if (hasExplicit) {
    origin = "base_desktop";
  }

  return {
    path,
    breakpoint,
    value,
    explicitValueAtBreakpoint,
    baseDesktopValue,
    inheritedValue,
    origin,
    sourceBreakpoint,
    isThemeToken,
    hasExplicitOverrideAtBreakpoint: hasExplicit,
    canResetAtBreakpoint: hasExplicit,
  };
}

const INSPECTABLE_LEAF_PATHS: readonly InspectorStylePath[] = [
  "visible",
  "geometry.width",
  "geometry.height",
  "geometry.minWidth",
  "geometry.maxWidth",
  "geometry.minHeight",
  "geometry.maxHeight",
  "geometry.aspectRatio",
  "geometry.padding",
  "geometry.margin",
  "geometry.overflowX",
  "geometry.overflowY",
  "geometry.position",
  "geometry.zIndex",
  "layout.mode",
  "layout.flex.direction",
  "layout.flex.wrap",
  "layout.flex.justifyContent",
  "layout.flex.alignItems",
  "layout.flex.columnGapPx",
  "layout.flex.rowGapPx",
  "layout.grid.columns",
  "layout.grid.rows",
  "layout.grid.columnGapPx",
  "layout.grid.rowGapPx",
  "layout.grid.autoFlow",
  "layout.grid.alignItems",
  "layout.grid.justifyItems",
  "flexItem.grow",
  "flexItem.shrink",
  "flexItem.basisPx",
  "flexItem.alignSelf",
  "gridItem.colSpan",
  "gridItem.rowSpan",
  "gridItem.colStart",
  "gridItem.rowStart",
  "gridItem.alignSelf",
  "gridItem.justifySelf",
  "appearance.backgroundColor",
  "appearance.backgroundGradient",
  "appearance.border",
  "appearance.shadow",
  "appearance.opacity",
  "appearance.filters",
  "appearance.typography.fontFamily",
  "appearance.typography.fontSize",
  "appearance.typography.fontWeight",
  "appearance.typography.lineHeight",
  "appearance.typography.letterSpacingEm",
  "appearance.typography.textAlign",
  "appearance.typography.color",
  "appearance.typography.textTransform",
  "appearance.typography.textDecoration",
  "appearance.typography.fontStyle",
  "shape.shapeType",
  "shape.cornerRadius",
  "shape.clipPreset",
  "shape.clipOverflow",
  "shape.imageCrop",
];

/**
 * Lists all leaf style property paths explicitly configured in `bundle`.
 */
export function listExplicitPathsInBundle(
  bundle: NodeStyleBundle | undefined,
): InspectorStylePath[] {
  if (!bundle) return [];
  return INSPECTABLE_LEAF_PATHS.filter((p) => hasExplicitPropertyInBundle(bundle, p));
}

/**
 * Lists all explicit overrides on a node grouped by breakpoint.
 */
export function listNodeOverridesByBreakpoint(
  node: Pick<EditorNode, "style" | "responsive">,
): Record<EditorBreakpoint, InspectorStylePath[]> {
  const overrideBreakpoints: readonly OverrideBreakpoint[] = [
    "desktop_xl",
    "tablet",
    "mobile",
    "mobile_sm",
  ];
  const map: Record<EditorBreakpoint, InspectorStylePath[]> = {
    desktop: listExplicitPathsInBundle(node.style),
    desktop_xl: [],
    tablet: [],
    mobile: [],
    mobile_sm: [],
  };

  for (const bp of overrideBreakpoints) {
    map[bp] = listExplicitPathsInBundle(node.responsive?.[bp]);
  }

  return map;
}
