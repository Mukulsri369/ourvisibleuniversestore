import type { CSSProperties } from "react";
import { formatDimensionValue, type AlignmentMode, type SpacingBox } from "../schema/geometry";
import type { ClipPreset, CornerRadiusConfig, ShapeType } from "../schema/shapes";
import type { JustifyContentMode } from "../schema/layout";
import type { GradientConfig, ShadowConfig } from "../schema/appearance";
import type { NodeStyleBundle } from "../schema/responsive";

const DESIGN_TOKEN_COLOR_MAP: Readonly<Record<string, string>> = Object.freeze({
  "token:background": "var(--color-background)",
  "token:foreground": "var(--color-foreground)",
  "token:card": "var(--color-card)",
  "token:card-foreground": "var(--color-card-foreground)",
  "token:primary": "var(--color-primary)",
  "token:primary-foreground": "var(--color-primary-foreground)",
  "token:secondary": "var(--color-secondary)",
  "token:secondary-foreground": "var(--color-secondary-foreground)",
  "token:muted": "var(--color-muted)",
  "token:muted-foreground": "var(--color-muted-foreground)",
  "token:accent": "var(--color-accent)",
  "token:accent-foreground": "var(--color-accent-foreground)",
  "token:border": "var(--color-border)",
  "token:nebula": "var(--color-nebula)",
});

const SHADOW_PRESET_MAP: Readonly<Record<string, string>> = Object.freeze({
  none: "none",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.25)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.35)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.45)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.55)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
  card: "var(--shadow-card)",
  glow: "var(--shadow-glow)",
  planet: "var(--shadow-planet)",
});

const CLIP_PRESET_CSS_MAP: Readonly<Record<ClipPreset, string | undefined>> = Object.freeze({
  none: undefined,
  circle: "circle(50% at 50% 50%)",
  ellipse: "ellipse(50% 42% at 50% 50%)",
  "inset-rounded": "inset(0% round 16px)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  octagon: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  arch: "inset(0% round 999px 999px 16px 16px)",
});

export function resolveSafeColorToken(color: string | undefined): string | undefined {
  if (!color) return undefined;
  if (color.startsWith("token:")) {
    return DESIGN_TOKEN_COLOR_MAP[color] ?? `var(--color-${color.slice(6)})`;
  }
  return color;
}

export function formatSpacingBoxCss(box: SpacingBox | undefined): string | undefined {
  if (!box) return undefined;
  const u = box.unit ?? "px";
  return `${box.top}${u} ${box.right}${u} ${box.bottom}${u} ${box.left}${u}`;
}

export function formatCornerRadiusCss(
  radius: CornerRadiusConfig | undefined,
  shapeType?: ShapeType,
): string | undefined {
  if (radius) {
    const u = radius.unit;
    if (radius.mode === "uniform" && radius.uniform !== undefined) {
      return `${radius.uniform}${u}`;
    }
    if (radius.mode === "independent") {
      const tl = radius.topLeft ?? 0;
      const tr = radius.topRight ?? 0;
      const br = radius.bottomRight ?? 0;
      const bl = radius.bottomLeft ?? 0;
      return `${tl}${u} ${tr}${u} ${br}${u} ${bl}${u}`;
    }
  }
  if (shapeType === "pill") return "9999px";
  if (shapeType === "circle") return "50%";
  if (shapeType === "square") return "0px";
  if (shapeType === "arch") return "999px 999px 16px 16px";
  return undefined;
}

function mapAlignmentToCss(align: AlignmentMode | undefined): string | undefined {
  if (!align) return undefined;
  if (align === "start") return "flex-start";
  if (align === "end") return "flex-end";
  return align;
}

function mapJustifyContentToCss(justify: JustifyContentMode | undefined): string | undefined {
  if (!justify) return undefined;
  switch (justify) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "between":
      return "space-between";
    case "around":
      return "space-around";
    case "evenly":
      return "space-evenly";
    default:
      return justify;
  }
}

export function formatGradientCss(gradient: GradientConfig | undefined): string | undefined {
  if (!gradient || gradient.stops.length < 2) return undefined;
  const stopsStr = gradient.stops
    .map((s) => `${resolveSafeColorToken(s.color)} ${s.positionPercent}%`)
    .join(", ");
  if (gradient.type === "radial") {
    return `radial-gradient(circle at center, ${stopsStr})`;
  }
  if (gradient.type === "conic") {
    const angle = gradient.angleDeg ?? 0;
    return `conic-gradient(from ${angle}deg at 50% 50%, ${stopsStr})`;
  }
  const angle = gradient.angleDeg ?? 180;
  return `linear-gradient(${angle}deg, ${stopsStr})`;
}

export function formatShadowCss(shadow: ShadowConfig | undefined): string | undefined {
  if (!shadow) return undefined;
  if (shadow.preset !== "custom") {
    return SHADOW_PRESET_MAP[shadow.preset];
  }
  const x = shadow.offsetX ?? 0;
  const y = shadow.offsetY ?? 8;
  const blur = shadow.blurPx ?? 24;
  const spread = shadow.spreadPx ?? 0;
  const color = resolveSafeColorToken(shadow.color) ?? "rgba(0, 0, 0, 0.45)";
  const insetPrefix = shadow.inset ? "inset " : "";
  return `${insetPrefix}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

/**
 * Converts a resolved `NodeStyleBundle` into safe React `CSSProperties`.
 * Returns `undefined` when no style properties are explicitly set, guaranteeing
 * zero default inline style injection on existing storefront components.
 */
export function resolveNodeCssProperties(
  bundle: NodeStyleBundle | undefined,
): CSSProperties | undefined {
  if (!bundle) return undefined;

  const style: CSSProperties = {};
  let hasProperties = false;

  const setProp = <K extends keyof CSSProperties>(key: K, value: CSSProperties[K]) => {
    if (value !== undefined) {
      style[key] = value;
      hasProperties = true;
    }
  };

  // 1. Geometry
  const geo = bundle.geometry;
  if (geo) {
    if (geo.width) setProp("width", formatDimensionValue(geo.width));
    if (geo.height) setProp("height", formatDimensionValue(geo.height));
    if (geo.minWidth) setProp("minWidth", formatDimensionValue(geo.minWidth));
    if (geo.maxWidth) setProp("maxWidth", formatDimensionValue(geo.maxWidth));
    if (geo.minHeight) setProp("minHeight", formatDimensionValue(geo.minHeight));
    if (geo.maxHeight) setProp("maxHeight", formatDimensionValue(geo.maxHeight));
    if (geo.aspectRatio) {
      setProp(
        "aspectRatio",
        geo.aspectRatio === "auto"
          ? "auto"
          : `${geo.aspectRatio.width} / ${geo.aspectRatio.height}`,
      );
    }
    if (geo.padding) setProp("padding", formatSpacingCss(geo.padding));
    if (geo.margin) setProp("margin", formatSpacingCss(geo.margin));
    if (geo.position) setProp("position", geo.position);
    if (geo.offsets) {
      if (geo.offsets.top) setProp("top", formatDimensionValue(geo.offsets.top));
      if (geo.offsets.right) setProp("right", formatDimensionValue(geo.offsets.right));
      if (geo.offsets.bottom) setProp("bottom", formatDimensionValue(geo.offsets.bottom));
      if (geo.offsets.left) setProp("left", formatDimensionValue(geo.offsets.left));
    }
    if (geo.zIndex !== undefined) setProp("zIndex", geo.zIndex);
    if (geo.alignSelf) setProp("alignSelf", mapAlignmentToCss(geo.alignSelf));
    if (geo.justifySelf) setProp("justifySelf", geo.justifySelf);
    if (geo.overflowX) setProp("overflowX", geo.overflowX);
    if (geo.overflowY) setProp("overflowY", geo.overflowY);

    if (geo.transform) {
      const parts: string[] = [];
      if (geo.transform.translateX || geo.transform.translateY) {
        const tx = geo.transform.translateX
          ? formatDimensionValue(geo.transform.translateX)
          : "0px";
        const ty = geo.transform.translateY
          ? formatDimensionValue(geo.transform.translateY)
          : "0px";
        parts.push(`translate(${tx}, ${ty})`);
      }
      if (geo.transform.rotateDeg !== undefined) {
        parts.push(`rotate(${geo.transform.rotateDeg}deg)`);
      }
      if (geo.transform.scaleX !== undefined || geo.transform.scaleY !== undefined) {
        const sx = geo.transform.scaleX ?? 1;
        const sy = geo.transform.scaleY ?? sx;
        parts.push(`scale(${sx}, ${sy})`);
      }
      if (parts.length > 0) {
        setProp("transform", parts.join(" "));
      }
    }
  }

  // 2. Shape
  const shape = bundle.shape;
  if (shape) {
    const borderRadius = formatCornerRadiusCss(shape.cornerRadius, shape.shapeType);
    if (borderRadius) setProp("borderRadius", borderRadius);
    if (shape.clipPreset && shape.clipPreset !== "none") {
      setProp("clipPath", CLIP_PRESET_CSS_MAP[shape.clipPreset]);
    } else if (shape.shapeType && shape.shapeType in CLIP_PRESET_CSS_MAP) {
      const presetClip = CLIP_PRESET_CSS_MAP[shape.shapeType as ClipPreset];
      if (presetClip) setProp("clipPath", presetClip);
    }
    if (shape.clipOverflow) {
      setProp("overflow", "hidden");
    }
  }

  // 3. Layout
  const layout = bundle.layout;
  if (layout) {
    if (layout.mode === "flex" && layout.flex) {
      setProp("display", "flex");
      setProp("flexDirection", layout.flex.direction);
      if (layout.flex.wrap) setProp("flexWrap", layout.flex.wrap);
      if (layout.flex.justifyContent) {
        setProp("justifyContent", mapJustifyContentToCss(layout.flex.justifyContent));
      }
      if (layout.flex.alignItems) {
        setProp("alignItems", mapAlignmentToCss(layout.flex.alignItems));
      }
      if (layout.flex.columnGapPx !== undefined) {
        setProp("columnGap", `${layout.flex.columnGapPx}px`);
      }
      if (layout.flex.rowGapPx !== undefined) {
        setProp("rowGap", `${layout.flex.rowGapPx}px`);
      }
    } else if (layout.mode === "grid" && layout.grid) {
      setProp("display", "grid");
      if (layout.grid.autoFit && layout.grid.minColumnWidthPx) {
        setProp(
          "gridTemplateColumns",
          `repeat(auto-fit, minmax(${layout.grid.minColumnWidthPx}px, 1fr))`,
        );
      } else {
        setProp("gridTemplateColumns", `repeat(${layout.grid.columns}, minmax(0, 1fr))`);
      }
      if (layout.grid.rows) {
        setProp("gridTemplateRows", `repeat(${layout.grid.rows}, minmax(0, auto))`);
      }
      setProp("columnGap", `${layout.grid.columnGapPx}px`);
      setProp("rowGap", `${layout.grid.rowGapPx}px`);
      if (layout.grid.autoFlow) setProp("gridAutoFlow", layout.grid.autoFlow);
      if (layout.grid.alignItems) setProp("alignItems", mapAlignmentToCss(layout.grid.alignItems));
      if (layout.grid.justifyItems) setProp("justifyItems", layout.grid.justifyItems);
    } else if (layout.mode === "bento" && layout.bento) {
      setProp("display", "grid");
      setProp("gridTemplateColumns", `repeat(${layout.bento.columns}, minmax(0, 1fr))`);
      setProp("gridAutoRows", `${layout.bento.rowHeightPx}px`);
      setProp("gap", `${layout.bento.gapPx}px`);
    } else if (layout.mode === "masonry" && layout.masonry) {
      setProp("columnCount", layout.masonry.columns);
      setProp("columnGap", `${layout.masonry.gapPx}px`);
    }
  }

  // 4. Grid Item Placement
  const gridItem = bundle.gridItem;
  if (gridItem) {
    if (gridItem.colStart && gridItem.colSpan) {
      setProp("gridColumn", `${gridItem.colStart} / span ${gridItem.colSpan}`);
    } else if (gridItem.colSpan) {
      setProp("gridColumn", `span ${gridItem.colSpan} / span ${gridItem.colSpan}`);
    }
    if (gridItem.rowStart && gridItem.rowSpan) {
      setProp("gridRow", `${gridItem.rowStart} / span ${gridItem.rowSpan}`);
    } else if (gridItem.rowSpan) {
      setProp("gridRow", `span ${gridItem.rowSpan} / span ${gridItem.rowSpan}`);
    }
    if (gridItem.alignSelf) setProp("alignSelf", mapAlignmentToCss(gridItem.alignSelf));
    if (gridItem.justifySelf) setProp("justifySelf", gridItem.justifySelf);
  }

  // 5. Flex Item
  const flexItem = bundle.flexItem;
  if (flexItem) {
    if (flexItem.grow !== undefined) setProp("flexGrow", flexItem.grow);
    if (flexItem.shrink !== undefined) setProp("flexShrink", flexItem.shrink);
    if (flexItem.basisPx !== undefined) {
      setProp("flexBasis", flexItem.basisPx === "auto" ? "auto" : `${flexItem.basisPx}px`);
    }
    if (flexItem.order !== undefined) setProp("order", flexItem.order);
    if (flexItem.alignSelf) setProp("alignSelf", mapAlignmentToCss(flexItem.alignSelf));
  }

  // 6. Appearance
  const app = bundle.appearance;
  if (app) {
    if (app.backgroundColor) {
      setProp("backgroundColor", resolveSafeColorToken(app.backgroundColor));
    }
    if (app.backgroundGradient) {
      setProp("backgroundImage", formatGradientCss(app.backgroundGradient));
    }
    if (app.border) {
      if (app.border.style === "none" || app.border.widthPx === 0) {
        setProp("border", "none");
      } else {
        setProp(
          "border",
          `${app.border.widthPx}px ${app.border.style} ${resolveSafeColorToken(app.border.color)}`,
        );
      }
    }
    if (app.shadow) {
      setProp("boxShadow", formatShadowCss(app.shadow));
    }
    if (app.opacity !== undefined) {
      setProp("opacity", app.opacity);
    }
    if (app.typography) {
      const typo = app.typography;
      if (typo.fontFamily) setProp("fontFamily", typo.fontFamily);
      if (typo.fontSize) setProp("fontSize", formatDimensionValue(typo.fontSize));
      if (typo.fontWeight !== undefined) setProp("fontWeight", typo.fontWeight);
      if (typo.lineHeight !== undefined) setProp("lineHeight", typo.lineHeight);
      if (typo.letterSpacingEm !== undefined) setProp("letterSpacing", `${typo.letterSpacingEm}em`);
      if (typo.textAlign) setProp("textAlign", typo.textAlign);
      if (typo.color) setProp("color", resolveSafeColorToken(typo.color));
      if (typo.textTransform) setProp("textTransform", typo.textTransform);
      if (typo.textDecoration) setProp("textDecoration", typo.textDecoration);
      if (typo.fontStyle) setProp("fontStyle", typo.fontStyle);
    }
    if (app.filters) {
      const f = app.filters;
      const filterParts: string[] = [];
      if (f.blurPx !== undefined) filterParts.push(`blur(${f.blurPx}px)`);
      if (f.brightnessPercent !== undefined)
        filterParts.push(`brightness(${f.brightnessPercent}%)`);
      if (f.contrastPercent !== undefined) filterParts.push(`contrast(${f.contrastPercent}%)`);
      if (f.saturatePercent !== undefined) filterParts.push(`saturate(${f.saturatePercent}%)`);
      if (f.grayscalePercent !== undefined) filterParts.push(`grayscale(${f.grayscalePercent}%)`);
      if (filterParts.length > 0) setProp("filter", filterParts.join(" "));
      if (f.backdropBlurPx !== undefined) {
        setProp("backdropFilter", `blur(${f.backdropBlurPx}px)`);
      }
    }
  }

  return hasProperties ? style : undefined;
}

function formatSpacingCss(box: SpacingBox): string {
  return formatSpacingBoxCss(box) ?? "0px";
}
