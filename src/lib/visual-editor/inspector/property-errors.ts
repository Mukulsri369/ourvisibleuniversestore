import type { PageDocument } from "../schema/page-document";

export type InspectorPropertyErrorCode =
  | "NODE_NOT_FOUND"
  | "GLOBAL_CHROME_LOCKED"
  | "RUNTIME_INSTANCE_READONLY"
  | "NODE_LOCKED"
  | "ANCESTOR_LOCKED"
  | "FORBIDDEN_BUSINESS_PROPERTY"
  | "UNSUPPORTED_COMPONENT_CAPABILITY"
  | "UNSUPPORTED_STYLE_PATH"
  | "UNSUPPORTED_LAYOUT_MODE"
  | "INVALID_PROPERTY_VALUE"
  | "INVALID_DIMENSION_UNIT"
  | "INVALID_COLOR_VALUE"
  | "INVALID_GRADIENT_VALUE"
  | "INVALID_SHAPE_CONFIG"
  | "UNSAFE_VALUE_REJECTED";

export interface InspectorPropertyError {
  readonly code: InspectorPropertyErrorCode;
  readonly message: string;
  readonly propertyPath?: string;
}

export interface InspectorPropertyUpdateResult {
  readonly ok: boolean;
  readonly document: PageDocument;
  readonly code?: InspectorPropertyErrorCode;
  readonly error?: string;
  readonly structuredError?: InspectorPropertyError;
}

export function createInspectorErrorResult(
  document: PageDocument,
  code: InspectorPropertyErrorCode,
  message: string,
  propertyPath?: string,
): InspectorPropertyUpdateResult {
  return {
    ok: false,
    document,
    code,
    error: message,
    structuredError: {
      code,
      message,
      ...(propertyPath ? { propertyPath } : {}),
    },
  };
}
