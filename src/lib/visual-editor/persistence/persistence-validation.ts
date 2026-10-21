import {
  CURRENT_PAGE_SCHEMA_VERSION,
  MAX_SERIALIZED_DOCUMENT_BYTES,
  type PageDocument,
} from "../schema/page-document";
import { safeParsePageDocument, type ValidationIssueDetail } from "../schema/validation";
import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import { traverseNodes } from "../utils/node-tree";
import { DEFAULT_STORE_SCOPE } from "./persistence-types";
import { PersistenceError } from "./persistence-errors";

/**
 * Authoritative product/catalog business fields that must NEVER be stored or overridden
 * inside a PageDocument presentation node's customAttributes.
 */
const PROTECTED_BUSINESS_DATA_KEYS = new Set([
  "price",
  "currency",
  "affiliate_url",
  "amazon_url",
  "amazon_asin",
  "amazon_marketplace",
  "retailer",
  "retailer_product_id",
  "contact_email",
  "product_price_override",
  "affiliate_link_override",
]);

interface CachedValidationEntry {
  document: PageDocument;
  checksum: string;
  byteLength: number;
}

const VALIDATED_OBJECT_CACHE = new WeakMap<object, CachedValidationEntry>();
const VALIDATED_CHECKSUM_CACHE = new Map<string, CachedValidationEntry>();
const MAX_CHECKSUM_CACHE_ENTRIES = 64;

/**
 * Deterministic 64-bit FNV-1a hex checksum for PageDocument integrity verification.
 */
export function computePageDocumentChecksum(serializedJson: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < serializedJson.length; i++) {
    const ch = serializedJson.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch ^ (i & 0xff);
    h2 = Math.imul(h2, 0x811c9dc5);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `fnv1a64:${part1}${part2}:${serializedJson.length}`;
}

export function validateStoreScope(storeScope: string | undefined): string {
  const resolved = storeScope ?? DEFAULT_STORE_SCOPE;
  if (resolved !== DEFAULT_STORE_SCOPE) {
    throw new PersistenceError({
      code: "FORBIDDEN",
      publicMessage: "Cross-store scope access is not permitted.",
      diagnosticMessage: `Rejected non-default store_scope "${resolved}".`,
      retryable: false,
    });
  }
  return resolved;
}

export function validatePageKeyAndSlug(
  pageKey: string,
  slug: string,
): {
  pageKey: string;
  slug: string;
} {
  const normalizedKey = pageKey.trim();
  const normalizedSlug = slug.trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(normalizedKey)) {
    throw new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: "Invalid page key format.",
      diagnosticMessage: `Invalid pageKey "${pageKey}"`,
    });
  }
  if (!normalizedSlug.startsWith("/") || normalizedSlug.length > 200 || /\s/.test(normalizedSlug)) {
    throw new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: "Invalid page slug format. Slugs must start with '/'.",
      diagnosticMessage: `Invalid slug "${slug}"`,
    });
  }
  return { pageKey: normalizedKey, slug: normalizedSlug };
}

export interface ValidatedPersistenceDocument {
  document: PageDocument;
  checksum: string;
  byteLength: number;
}

/**
 * Validates a candidate PageDocument at the persistence or publishing trust boundary.
 * Enforces:
 * 1. Payload byte size limit (MAX_SERIALIZED_DOCUMENT_BYTES = 1 MiB).
 * 2. Supported schema version ("1.0.0").
 * 3. Full Prompt 5 Zod structural & security validation (node IDs, hierarchy, media URLs, bindings).
 * 4. Prompt 6 Component Registry membership for every node in the tree.
 * 5. Business-data separation (rejects protected product/affiliate override fields).
 */
export function validateDocumentForPersistence(
  candidate: unknown,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): ValidatedPersistenceDocument {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: "Page design document must be a JSON object.",
    });
  }

  // 1. Fast-path if this exact immutable object reference was already validated
  const cachedByRef = VALIDATED_OBJECT_CACHE.get(candidate);
  if (cachedByRef && registry === defaultComponentRegistry) {
    return {
      document: cachedByRef.document,
      checksum: cachedByRef.checksum,
      byteLength: cachedByRef.byteLength,
    };
  }

  const rawRecord = candidate as Record<string, unknown>;
  if (
    typeof rawRecord.schemaVersion === "string" &&
    rawRecord.schemaVersion !== CURRENT_PAGE_SCHEMA_VERSION
  ) {
    throw new PersistenceError({
      code: "UNSUPPORTED_SCHEMA",
      publicMessage: `Unsupported PageDocument schema version "${rawRecord.schemaVersion}". Expected "${CURRENT_PAGE_SCHEMA_VERSION}".`,
    });
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(candidate);
  } catch {
    throw new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: "Page design document could not be serialized to JSON.",
    });
  }

  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > MAX_SERIALIZED_DOCUMENT_BYTES) {
    throw new PersistenceError({
      code: "DOCUMENT_TOO_LARGE",
      publicMessage: `Page design document size (${byteLength} bytes) exceeds maximum limit (${MAX_SERIALIZED_DOCUMENT_BYTES} bytes).`,
    });
  }

  // 2. Fast-path if the exact serialized JSON content hash was already validated with the default registry
  const inputChecksum = computePageDocumentChecksum(serialized);
  if (registry === defaultComponentRegistry) {
    const cachedByHash = VALIDATED_CHECKSUM_CACHE.get(inputChecksum);
    if (cachedByHash) {
      VALIDATED_OBJECT_CACHE.set(candidate, cachedByHash);
      return {
        document: cachedByHash.document,
        checksum: cachedByHash.checksum,
        byteLength: cachedByHash.byteLength,
      };
    }
  }

  const parseResult = safeParsePageDocument(candidate);
  if (!parseResult.success) {
    const hasSizeIssue = parseResult.issues.some((i) => i.code === "MAX_BYTES_EXCEEDED");
    const hasVersionIssue = parseResult.issues.some((i) => i.code === "UNSUPPORTED_SCHEMA_VERSION");
    throw new PersistenceError({
      code: hasSizeIssue
        ? "DOCUMENT_TOO_LARGE"
        : hasVersionIssue
          ? "UNSUPPORTED_SCHEMA"
          : "VALIDATION_FAILED",
      publicMessage:
        parseResult.issues[0]?.message ?? "Page design document failed schema validation.",
      validationIssues: parseResult.issues,
    });
  }

  const doc = parseResult.data;
  const businessIssues: ValidationIssueDetail[] = [];

  traverseNodes(doc.root, (node) => {
    if (!registry.hasComponent(node.type)) {
      businessIssues.push({
        path: `nodes.${node.id}.type`,
        code: "UNREGISTERED_COMPONENT",
        message: `Node "${node.id}" references unregistered component type "${node.type}".`,
      });
    }

    const customAttrs = node.props.customAttributes;
    if (customAttrs) {
      for (const attrKey of Object.keys(customAttrs)) {
        if (PROTECTED_BUSINESS_DATA_KEYS.has(attrKey.toLowerCase())) {
          businessIssues.push({
            path: `nodes.${node.id}.props.customAttributes.${attrKey}`,
            code: "FORBIDDEN_BUSINESS_DATA_OVERRIDE",
            message: `Protected business data field "${attrKey}" cannot be stored in presentation props`,
          });
        }
      }
    }
  });

  if (businessIssues.length > 0) {
    throw new PersistenceError({
      code: "VALIDATION_FAILED",
      publicMessage: businessIssues[0].message,
      validationIssues: businessIssues,
    });
  }

  const canonicalSerialized = JSON.stringify(doc);
  const checksum = computePageDocumentChecksum(canonicalSerialized);
  const entry: CachedValidationEntry = { document: doc, checksum, byteLength };
  VALIDATED_OBJECT_CACHE.set(doc, entry);
  VALIDATED_OBJECT_CACHE.set(candidate, entry);

  if (registry === defaultComponentRegistry) {
    if (VALIDATED_CHECKSUM_CACHE.size >= MAX_CHECKSUM_CACHE_ENTRIES) {
      const oldestKey = VALIDATED_CHECKSUM_CACHE.keys().next().value;
      if (oldestKey) VALIDATED_CHECKSUM_CACHE.delete(oldestKey);
    }
    VALIDATED_CHECKSUM_CACHE.set(inputChecksum, entry);
    VALIDATED_CHECKSUM_CACHE.set(checksum, entry);
  }

  return {
    document: doc,
    checksum,
    byteLength,
  };
}
