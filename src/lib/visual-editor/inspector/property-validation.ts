import {
  BorderConfigSchema,
  CssColorValueSchema,
  FilterConfigSchema,
  GradientConfigSchema,
  ShadowConfigSchema,
  THEME_COLOR_TOKENS,
  TypographyConfigSchema,
  type BorderConfig,
  type FilterConfig,
  type GradientConfig,
  type ShadowConfig,
  type TypographyConfig,
} from "../schema/appearance";
import {
  ASPECT_RATIO_PRESETS,
  DIMENSION_UNITS,
  DimensionValueSchema,
  SpacingBoxSchema,
  type AspectRatioPreset,
  type DimensionUnit,
  type DimensionValue,
  type KeywordDimensionUnit,
  type NumericDimensionUnit,
  type SpacingBox,
} from "../schema/geometry";
import {
  FlexItemConfigSchema,
  FlexLayoutConfigSchema,
  GridItemConfigSchema,
  GridLayoutConfigSchema,
  type FlexItemConfig,
  type FlexLayoutConfig,
  type GridItemConfig,
  type GridLayoutConfig,
} from "../schema/layout";
import {
  CLIP_SHAPE_PRESETS,
  CORNER_RADIUS_UNITS,
  CornerRadiusConfigSchema,
  ImageCropConfigSchema,
  SHAPE_TYPES,
  type ClipShapePreset,
  type CornerRadiusConfig,
  type ImageCropConfig,
  type ShapeType,
} from "../schema/shapes";

export interface InspectorValidationOutcome<T> {
  readonly valid: boolean;
  readonly value?: T;
  readonly error?: string;
  readonly code?:
    | "INVALID_PROPERTY_VALUE"
    | "INVALID_DIMENSION_UNIT"
    | "INVALID_COLOR_VALUE"
    | "INVALID_GRADIENT_VALUE"
    | "INVALID_SHAPE_CONFIG"
    | "UNSAFE_VALUE_REJECTED";
}

const UNSAFE_EXPRESSION_PATTERN =
  /(?:<script|javascript:|vbscript:|data:text\/html|expression\s*\(|url\s*\(|@import|behavior\s*:)/i;

export function containsUnsafeCssOrScript(input: string): boolean {
  return UNSAFE_EXPRESSION_PATTERN.test(input);
}

const KEYWORD_DIMENSION_UNITS: ReadonlySet<DimensionUnit> = new Set([
  "auto",
  "min-content",
  "max-content",
  "fit-content",
]);

export function isKeywordDimensionUnit(unit: DimensionUnit): unit is KeywordDimensionUnit {
  return KEYWORD_DIMENSION_UNITS.has(unit);
}

/**
 * Validates a numeric/keyword dimension value and unit against `DimensionValueSchema`.
 */
export function validateDimensionInput(
  rawValue: number | string | undefined,
  unit: string,
  options?: { allowNegative?: boolean; maxPx?: number },
): InspectorValidationOutcome<DimensionValue> {
  if (!DIMENSION_UNITS.includes(unit as DimensionUnit)) {
    return {
      valid: false,
      code: "INVALID_DIMENSION_UNIT",
      error: `Unsupported dimension unit "${unit}". Allowed units: ${DIMENSION_UNITS.join(", ")}.`,
    };
  }

  const typedUnit = unit as DimensionUnit;
  if (isKeywordDimensionUnit(typedUnit)) {
    return {
      valid: true,
      value: { unit: typedUnit },
    };
  }

  if (typeof rawValue === "string" && containsUnsafeCssOrScript(rawValue)) {
    return {
      valid: false,
      code: "UNSAFE_VALUE_REJECTED",
      error: "Dimension value contains unsafe CSS or script expressions.",
    };
  }

  const num = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(num)) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: "Dimension value must be a finite number.",
    };
  }

  const minAllowed = options?.allowNegative ? -10000 : 0;
  const maxAllowed = options?.maxPx ?? 10000;
  if (num < minAllowed || num > maxAllowed) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: `Dimension value must be between ${minAllowed} and ${maxAllowed}.`,
    };
  }

  const candidate: DimensionValue = { value: num, unit: typedUnit };
  const parsed = DimensionValueSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid dimension configuration.",
    };
  }

  return {
    valid: true,
    value: parsed.data,
  };
}

/**
 * Validates an aspect ratio preset against `ASPECT_RATIO_PRESETS`.
 */
export function validateAspectRatioInput(
  ratio: string,
): InspectorValidationOutcome<AspectRatioPreset> {
  if (!ASPECT_RATIO_PRESETS.includes(ratio as AspectRatioPreset)) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: `Unsupported aspect ratio "${ratio}". Allowed presets: ${ASPECT_RATIO_PRESETS.join(", ")}.`,
    };
  }
  return {
    valid: true,
    value: ratio as AspectRatioPreset,
  };
}

/**
 * Validates a `SpacingBox` (`padding` or `margin`).
 * Padding values must be non-negative (`0..2000`); margin values allow `-2000..2000`.
 */
export function validateSpacingBoxInput(
  box: SpacingBox,
  field: "padding" | "margin",
): InspectorValidationOutcome<SpacingBox> {
  const sides = [box.top, box.right, box.bottom, box.left];
  if (sides.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: `${field === "padding" ? "Padding" : "Margin"} sides must be finite numbers.`,
    };
  }

  if (field === "padding" && sides.some((v) => v < 0)) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: "Padding values cannot be negative.",
    };
  }

  const normalized: SpacingBox = {
    top: box.top,
    right: box.right,
    bottom: box.bottom,
    left: box.left,
    unit: box.unit ?? "px",
  };

  const parsed = SpacingBoxSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? `Invalid ${field} configuration.`,
    };
  }

  return {
    valid: true,
    value: parsed.data,
  };
}

/**
 * Validates a CSS color or theme token (`token:*`) against `CssColorValueSchema`.
 */
export function validateColorInput(color: string): InspectorValidationOutcome<string> {
  const trimmed = color.trim();
  if (!trimmed) {
    return {
      valid: false,
      code: "INVALID_COLOR_VALUE",
      error: "Color value cannot be empty.",
    };
  }

  if (containsUnsafeCssOrScript(trimmed)) {
    return {
      valid: false,
      code: "UNSAFE_VALUE_REJECTED",
      error: "Color value contains unsafe CSS or script expressions.",
    };
  }

  const parsed = CssColorValueSchema.safeParse(trimmed);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_COLOR_VALUE",
      error: `Invalid color "${trimmed}". Use hex (#rrggbb), rgb(), hsl(), oklch(), or a theme token (${THEME_COLOR_TOKENS.slice(0, 4).join(", ")}).`,
    };
  }

  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateGradientInput(
  gradient: GradientConfig,
): InspectorValidationOutcome<GradientConfig> {
  const parsed = GradientConfigSchema.safeParse(gradient);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_GRADIENT_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid gradient configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateBorderInput(
  border: BorderConfig,
): InspectorValidationOutcome<BorderConfig> {
  const parsed = BorderConfigSchema.safeParse(border);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid border configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateShadowInput(
  shadow: ShadowConfig,
): InspectorValidationOutcome<ShadowConfig> {
  const parsed = ShadowConfigSchema.safeParse(shadow);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid shadow configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateFiltersInput(
  filters: FilterConfig,
): InspectorValidationOutcome<FilterConfig> {
  const parsed = FilterConfigSchema.safeParse(filters);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid filter configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateShapeTypeInput(shapeType: string): InspectorValidationOutcome<ShapeType> {
  if (!SHAPE_TYPES.includes(shapeType as ShapeType)) {
    return {
      valid: false,
      code: "INVALID_SHAPE_CONFIG",
      error: `Unsupported shape type "${shapeType}". Allowed: ${SHAPE_TYPES.join(", ")}.`,
    };
  }
  return {
    valid: true,
    value: shapeType as ShapeType,
  };
}

export function validateClipPresetInput(
  clipPreset: string,
): InspectorValidationOutcome<ClipShapePreset> {
  if (!CLIP_SHAPE_PRESETS.includes(clipPreset as ClipShapePreset)) {
    return {
      valid: false,
      code: "INVALID_SHAPE_CONFIG",
      error: `Unsupported clip shape preset "${clipPreset}". Allowed: ${CLIP_SHAPE_PRESETS.join(", ")}.`,
    };
  }
  return {
    valid: true,
    value: clipPreset as ClipShapePreset,
  };
}

export function validateCornerRadiusInput(
  cornerRadius: CornerRadiusConfig,
): InspectorValidationOutcome<CornerRadiusConfig> {
  if (!CORNER_RADIUS_UNITS.includes(cornerRadius.unit)) {
    return {
      valid: false,
      code: "INVALID_DIMENSION_UNIT",
      error: `Unsupported corner radius unit "${String(cornerRadius.unit)}".`,
    };
  }
  const parsed = CornerRadiusConfigSchema.safeParse(cornerRadius);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_SHAPE_CONFIG",
      error: parsed.error.issues[0]?.message ?? "Invalid corner radius configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateTypographyInput(
  typography: TypographyConfig,
): InspectorValidationOutcome<TypographyConfig> {
  if (typography.fontFamily && containsUnsafeCssOrScript(typography.fontFamily)) {
    return {
      valid: false,
      code: "UNSAFE_VALUE_REJECTED",
      error: "Font family contains unsafe CSS or URL expressions.",
    };
  }
  const parsed = TypographyConfigSchema.safeParse(typography);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid typography configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateFlexLayoutInput(
  flex: FlexLayoutConfig,
): InspectorValidationOutcome<FlexLayoutConfig> {
  const parsed = FlexLayoutConfigSchema.safeParse(flex);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid Flexbox layout configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateGridLayoutInput(
  grid: GridLayoutConfig,
): InspectorValidationOutcome<GridLayoutConfig> {
  const parsed = GridLayoutConfigSchema.safeParse(grid);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid CSS Grid layout configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateFlexItemInput(
  flexItem: FlexItemConfig,
): InspectorValidationOutcome<FlexItemConfig> {
  const parsed = FlexItemConfigSchema.safeParse(flexItem);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid Flex item configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateGridItemInput(
  gridItem: GridItemConfig,
): InspectorValidationOutcome<GridItemConfig> {
  const parsed = GridItemConfigSchema.safeParse(gridItem);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid Grid item span/placement configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}

export function validateMediaCropInput(
  imageCrop: ImageCropConfig,
): InspectorValidationOutcome<ImageCropConfig> {
  const parsed = ImageCropConfigSchema.safeParse(imageCrop);
  if (!parsed.success) {
    return {
      valid: false,
      code: "INVALID_PROPERTY_VALUE",
      error: parsed.error.issues[0]?.message ?? "Invalid media crop configuration.",
    };
  }
  return {
    valid: true,
    value: parsed.data,
  };
}
