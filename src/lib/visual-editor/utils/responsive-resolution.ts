import type { EditorNode } from "../schema/nodes";
import type {
  EditorBreakpoint,
  NodeStyleBundle,
  OverrideBreakpoint,
  ResponsiveOverrides,
} from "../schema/responsive";

/**
 * Deterministic inheritance chain for each breakpoint:
 * - `desktop`: `node.style` (base authoring configuration)
 * - `desktop_xl`: `node.style` -> `node.responsive.desktop_xl`
 * - `tablet`: `node.style` -> `node.responsive.tablet`
 * - `mobile`: `node.style` -> `node.responsive.tablet` -> `node.responsive.mobile`
 * - `mobile_sm`: `node.style` -> `node.responsive.tablet` -> `node.responsive.mobile` -> `node.responsive.mobile_sm`
 */
export const BREAKPOINT_INHERITANCE_CHAIN: Record<EditorBreakpoint, readonly OverrideBreakpoint[]> =
  {
    desktop: [],
    desktop_xl: ["desktop_xl"],
    tablet: ["tablet"],
    mobile: ["tablet", "mobile"],
    mobile_sm: ["tablet", "mobile", "mobile_sm"],
  };

function mergePlainRecords<T extends object>(
  base: T | undefined,
  override: Partial<T> | undefined,
): T | undefined {
  if (!base && !override) return undefined;
  if (!base) return { ...(override as T) };
  if (!override) return { ...base };

  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, val] of Object.entries(override as Record<string, unknown>)) {
    if (val === undefined) continue;
    const prevVal = merged[key];
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      prevVal !== null &&
      typeof prevVal === "object" &&
      !Array.isArray(prevVal) &&
      !("unit" in (val as Record<string, unknown>))
    ) {
      merged[key] = mergePlainRecords(
        prevVal as Record<string, unknown>,
        val as Record<string, unknown>,
      );
    } else {
      merged[key] = val;
    }
  }
  return merged as T;
}

export function mergeStyleBundles(
  base: NodeStyleBundle,
  override?: NodeStyleBundle,
): NodeStyleBundle {
  if (!override) {
    return base;
  }

  return {
    visible: override.visible !== undefined ? override.visible : base.visible,
    geometry: mergePlainRecords(base.geometry, override.geometry),
    shape: mergePlainRecords(base.shape, override.shape),
    layout: mergePlainRecords(base.layout, override.layout),
    gridItem: mergePlainRecords(base.gridItem, override.gridItem),
    flexItem: mergePlainRecords(base.flexItem, override.flexItem),
    appearance: mergePlainRecords(base.appearance, override.appearance),
    animation: mergePlainRecords(base.animation, override.animation),
  };
}

export function resolveResponsiveStyle(
  node: Pick<EditorNode, "style" | "responsive">,
  breakpoint: EditorBreakpoint,
): NodeStyleBundle {
  const chain = BREAKPOINT_INHERITANCE_CHAIN[breakpoint];
  let resolved: NodeStyleBundle = mergeStyleBundles({}, node.style);

  if (!node.responsive || chain.length === 0) {
    return resolved;
  }

  for (const step of chain) {
    const stepOverride = node.responsive[step];
    if (stepOverride) {
      resolved = mergeStyleBundles(resolved, stepOverride);
    }
  }

  return resolved;
}

export function setResponsiveStyleOverride(
  node: EditorNode,
  breakpoint: EditorBreakpoint,
  patch: NodeStyleBundle,
): EditorNode {
  if (breakpoint === "desktop") {
    return {
      ...node,
      style: mergeStyleBundles(node.style, patch),
    };
  }

  const currentOverride = node.responsive?.[breakpoint] ?? {};
  const nextOverride = mergeStyleBundles(currentOverride, patch);

  return {
    ...node,
    responsive: {
      ...(node.responsive ?? {}),
      [breakpoint]: nextOverride,
    },
  };
}

export function clearResponsiveStyleOverride(
  node: EditorNode,
  breakpoint: OverrideBreakpoint,
  category?: keyof NodeStyleBundle,
): EditorNode {
  if (!node.responsive || !node.responsive[breakpoint]) {
    return node;
  }

  if (!category) {
    const nextResponsive: ResponsiveOverrides = { ...node.responsive };
    delete nextResponsive[breakpoint];
    return {
      ...node,
      responsive: Object.keys(nextResponsive).length > 0 ? nextResponsive : undefined,
    };
  }

  const currentBundle = { ...node.responsive[breakpoint] };
  delete currentBundle[category];

  const nextResponsive: ResponsiveOverrides = { ...node.responsive };
  if (Object.keys(currentBundle).length === 0) {
    delete nextResponsive[breakpoint];
  } else {
    nextResponsive[breakpoint] = currentBundle;
  }

  return {
    ...node,
    responsive: Object.keys(nextResponsive).length > 0 ? nextResponsive : undefined,
  };
}
