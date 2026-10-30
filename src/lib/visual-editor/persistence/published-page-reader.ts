import { queryOptions } from "@tanstack/react-query";
import { DEFAULT_HOMEPAGE_PAGE_DOCUMENT } from "../homepage/default-homepage-document";
import type { PageDocument } from "../schema/page-document";
import {
  DEFAULT_STORE_SCOPE,
  type PersistenceDatabaseAdapter,
  type PublicPageReadResult,
  type PublishedStorePageSnapshot,
} from "./persistence-types";
import { isPersistenceError } from "./persistence-errors";
import { validateDocumentForPersistence, validateStoreScope } from "./persistence-validation";
import { defaultPersistenceAdapter } from "./independent-persistence-adapter";

export interface PublishedPageReaderOptions {
  adapter?: PersistenceDatabaseAdapter;
  storeScope?: string;
  fallbackDocument?: PageDocument;
}

/**
 * Safely retrieves the active published page configuration for public visitors.
 * - Uses only the narrow public read path (`get_published_store_page` RPC).
 * - Never exposes draft documents, admin email addresses, actor IDs, or private release notes.
 * - Validates the returned PageDocument before rendering.
 * - Automatically falls back to the canonical homepage document if no design is persisted,
 *   no version is published, the database is unreachable, or the stored snapshot is incompatible.
 */
export async function getPublishedPage(
  pageSlug: string = "/",
  options: PublishedPageReaderOptions = {},
): Promise<PublicPageReadResult> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const fallback = options.fallbackDocument ?? DEFAULT_HOMEPAGE_PAGE_DOCUMENT;
  const normalizedSlug = pageSlug.trim() || "/";

  let storeScope: string;
  try {
    storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  } catch {
    return {
      source: "canonical_fallback",
      document: fallback,
      publishedSnapshot: null,
      fallbackReason: "validation_failed",
    };
  }

  let rawPublished: Awaited<ReturnType<PersistenceDatabaseAdapter["getPublishedPageBySlug"]>>;
  try {
    rawPublished = await adapter.getPublishedPageBySlug(normalizedSlug, storeScope);
  } catch {
    return {
      source: "canonical_fallback",
      document: fallback,
      publishedSnapshot: null,
      fallbackReason: "database_unavailable",
    };
  }

  if (!rawPublished) {
    return {
      source: "canonical_fallback",
      document: fallback,
      publishedSnapshot: null,
      fallbackReason: "not_published",
    };
  }

  try {
    const validated = validateDocumentForPersistence(rawPublished.documentSnapshot);
    const snapshot: PublishedStorePageSnapshot = {
      pageId: rawPublished.pageId,
      pageKey: rawPublished.pageKey,
      pageType: rawPublished.pageType,
      slug: rawPublished.slug,
      storeScope: rawPublished.storeScope,
      versionId: rawPublished.versionId,
      versionNumber: rawPublished.versionNumber,
      publishedRevision: rawPublished.publishedRevision,
      schemaVersion: rawPublished.schemaVersion,
      document: validated.document,
      checksum: rawPublished.checksum,
      publishedAt: rawPublished.publishedAt,
    };

    return {
      source: "database_published",
      document: validated.document,
      publishedSnapshot: snapshot,
    };
  } catch (err) {
    const reason =
      isPersistenceError(err) && err.code === "UNSUPPORTED_SCHEMA"
        ? "incompatible_schema"
        : "validation_failed";
    return {
      source: "canonical_fallback",
      document: fallback,
      publishedSnapshot: null,
      fallbackReason: reason,
    };
  }
}

/**
 * Convenience reader returning the active published homepage PageDocument
 * or `DEFAULT_HOMEPAGE_PAGE_DOCUMENT` when no valid published design exists.
 */
export async function getPublishedHomepageDocument(
  options: PublishedPageReaderOptions = {},
): Promise<PageDocument> {
  const result = await getPublishedPage("/", options);
  return result.document;
}

/**
 * TanStack Query options for caching the public published page design.
 */
export const publishedPageQuery = (
  pageSlug: string = "/",
  options: PublishedPageReaderOptions = {},
) =>
  queryOptions({
    queryKey: ["storefront", "published-page", options.storeScope ?? DEFAULT_STORE_SCOPE, pageSlug],
    queryFn: () => getPublishedPage(pageSlug, options),
    staleTime: 1000 * 60 * 5,
  });
