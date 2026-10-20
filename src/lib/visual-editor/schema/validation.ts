import { z } from "zod";
import { FORBIDDEN_BUSINESS_DATA_KEYS } from "./bindings";
import {
  LEAF_COMPONENT_TYPES,
  ROOT_ONLY_COMPONENT_TYPES,
  type ComponentType,
  type EditorNode,
} from "./nodes";
import {
  MAX_DOCUMENT_DEPTH,
  MAX_DOCUMENT_NODES,
  MAX_SERIALIZED_DOCUMENT_BYTES,
  PageDocumentBaseSchema,
  type PageDocument,
} from "./page-document";
import { checkSchemaVersionCompatibility } from "./migrations";

export interface ValidationIssueDetail {
  path: string;
  code: string;
  message: string;
}

export type PageDocumentValidationResult =
  | {
      success: true;
      data: PageDocument;
      stats: {
        nodeCount: number;
        maxDepth: number;
      };
    }
  | {
      success: false;
      issues: ValidationIssueDetail[];
    };

const FORBIDDEN_CUSTOM_ATTRIBUTE_PREFIXES = ["on", "__", "dangerously"];

function canParentContainChild(parentType: ComponentType, childType: ComponentType): boolean {
  if (LEAF_COMPONENT_TYPES.has(parentType)) {
    return false;
  }
  if (ROOT_ONLY_COMPONENT_TYPES.has(childType)) {
    return false;
  }
  if (parentType === "Grid" && childType === "Section") {
    return false;
  }
  return true;
}

function inspectObjectSafety(
  value: unknown,
  currentPath: string,
  seenObjects: WeakSet<object>,
  issues: ValidationIssueDetail[],
): boolean {
  if (typeof value === "function" || typeof value === "symbol") {
    issues.push({
      path: currentPath,
      code: "UNSAFE_EXECUTABLE_VALUE",
      message: `Executable or non-serializable type "${typeof value}" is prohibited in PageDocument`,
    });
    return false;
  }

  if (!value || typeof value !== "object") {
    return true;
  }

  if (seenObjects.has(value)) {
    issues.push({
      path: currentPath,
      code: "CIRCULAR_REFERENCE",
      message: "Circular object reference detected in PageDocument",
    });
    return false;
  }

  seenObjects.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (!inspectObjectSafety(value[i], `${currentPath}[${i}]`, seenObjects, issues)) {
        return false;
      }
    }
    seenObjects.delete(value);
    return true;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      issues.push({
        path: `${currentPath}.${key}`,
        code: "PROTOTYPE_POLLUTION_KEY",
        message: `Forbidden object key "${key}" rejected`,
      });
      return false;
    }
    if (!inspectObjectSafety(record[key], `${currentPath}.${key}`, seenObjects, issues)) {
      return false;
    }
  }

  seenObjects.delete(value);
  return true;
}

function validateNodeTreeInvariants(doc: PageDocument): {
  issues: ValidationIssueDetail[];
  nodeCount: number;
  maxDepth: number;
} {
  const issues: ValidationIssueDetail[] = [];
  const seenIds = new Set<string>();
  let nodeCount = 0;
  let maxDepth = 0;

  const visit = (node: EditorNode, depth: number, parentType: ComponentType | null, path: string) => {
    nodeCount += 1;
    if (depth > maxDepth) {
      maxDepth = depth;
    }

    if (nodeCount > MAX_DOCUMENT_NODES) {
      if (issues.every((i) => i.code !== "MAX_NODES_EXCEEDED")) {
        issues.push({
          path,
          code: "MAX_NODES_EXCEEDED",
          message: `Document exceeds maximum allowed node count (${MAX_DOCUMENT_NODES})`,
        });
      }
      return;
    }

    if (depth > MAX_DOCUMENT_DEPTH) {
      issues.push({
        path,
        code: "MAX_DEPTH_EXCEEDED",
        message: `Node "${node.id}" at depth ${depth} exceeds maximum allowed nesting depth (${MAX_DOCUMENT_DEPTH})`,
      });
      return;
    }

    if (seenIds.has(node.id)) {
      issues.push({
        path: `${path}.id`,
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node ID "${node.id}" found in document`,
      });
    } else {
      seenIds.add(node.id);
    }

    if (parentType !== null && !canParentContainChild(parentType, node.type)) {
      issues.push({
        path: `${path}.type`,
        code: "INVALID_PARENT_CHILD_NESTING",
        message: `Component "${parentType}" cannot contain child component of type "${node.type}"`,
      });
    }

    if (LEAF_COMPONENT_TYPES.has(node.type) && node.children.length > 0) {
      issues.push({
        path: `${path}.children`,
        code: "LEAF_NODE_HAS_CHILDREN",
        message: `Leaf component "${node.type}" (id: "${node.id}") cannot have child nodes`,
      });
    }

    if (node.props.customAttributes) {
      for (const attrKey of Object.keys(node.props.customAttributes)) {
        const lowerKey = attrKey.toLowerCase();
        if (FORBIDDEN_BUSINESS_DATA_KEYS.has(lowerKey)) {
          issues.push({
            path: `${path}.props.customAttributes.${attrKey}`,
            code: "FORBIDDEN_BUSINESS_DATA_OVERRIDE",
            message: `Protected business data field "${attrKey}" cannot be stored in presentation props`,
          });
        }
        if (FORBIDDEN_CUSTOM_ATTRIBUTE_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) {
          issues.push({
            path: `${path}.props.customAttributes.${attrKey}`,
            code: "UNSAFE_EVENT_HANDLER_ATTRIBUTE",
            message: `Event handler or unsafe attribute "${attrKey}" is prohibited`,
          });
        }
      }
    }

    for (let i = 0; i < node.children.length; i += 1) {
      visit(node.children[i], depth + 1, node.type, `${path}.children[${i}]`);
    }

    if (node.slots) {
      for (const [slotKey, slotNodes] of Object.entries(node.slots)) {
        for (let i = 0; i < slotNodes.length; i += 1) {
          visit(slotNodes[i], depth + 1, node.type, `${path}.slots.${slotKey}[${i}]`);
        }
      }
    }
  };

  for (let i = 0; i < doc.root.length; i += 1) {
    visit(doc.root[i], 1, null, `root[${i}]`);
  }

  return { issues, nodeCount, maxDepth };
}

export function safeParsePageDocument(input: unknown): PageDocumentValidationResult {
  const preIssues: ValidationIssueDetail[] = [];
  const seenObjects = new WeakSet<object>();

  if (!inspectObjectSafety(input, "document", seenObjects, preIssues)) {
    return { success: false, issues: preIssues };
  }

  const versionCheck = checkSchemaVersionCompatibility(input);
  if (!versionCheck.compatible) {
    return {
      success: false,
      issues: [
        {
          path: "schemaVersion",
          code: "UNSUPPORTED_SCHEMA_VERSION",
          message: versionCheck.reason ?? "Incompatible schema version",
        },
      ],
    };
  }

  const parsed = PageDocumentBaseSchema.safeParse(input);
  if (!parsed.success) {
    const zodIssues: ValidationIssueDetail[] = parsed.error.issues.map((issue: z.ZodIssue) => ({
      path: issue.path.join(".") || "document",
      code: issue.code,
      message: issue.message,
    }));
    return { success: false, issues: zodIssues };
  }

  const { issues: treeIssues, nodeCount, maxDepth } = validateNodeTreeInvariants(parsed.data);
  if (treeIssues.length > 0) {
    return { success: false, issues: treeIssues };
  }

  return {
    success: true,
    data: parsed.data,
    stats: { nodeCount, maxDepth },
  };
}

export function parsePageDocument(input: unknown): PageDocument {
  const result = safeParsePageDocument(input);
  if (!result.success) {
    const summary = result.issues.map((i) => `[${i.code}] ${i.path}: ${i.message}`).join("; ");
    throw new Error(`Invalid PageDocument: ${summary}`);
  }
  return result.data;
}

export function validateSerializedPageDocument(jsonString: string): PageDocumentValidationResult {
  if (typeof jsonString !== "string") {
    return {
      success: false,
      issues: [
        {
          path: "document",
          code: "INVALID_JSON_STRING",
          message: "Input must be a JSON string",
        },
      ],
    };
  }

  const byteLength = new TextEncoder().encode(jsonString).byteLength;
  if (byteLength > MAX_SERIALIZED_DOCUMENT_BYTES) {
    return {
      success: false,
      issues: [
        {
          path: "document",
          code: "MAX_BYTES_EXCEEDED",
          message: `Serialized document size (${byteLength} bytes) exceeds limit (${MAX_SERIALIZED_DOCUMENT_BYTES} bytes)`,
        },
      ],
    };
  }

  try {
    const parsedJson: unknown = JSON.parse(jsonString);
    return safeParsePageDocument(parsedJson);
  } catch (err) {
    return {
      success: false,
      issues: [
        {
          path: "document",
          code: "JSON_PARSE_ERROR",
          message: err instanceof Error ? err.message : "Malformed JSON payload",
        },
      ],
    };
  }
}
