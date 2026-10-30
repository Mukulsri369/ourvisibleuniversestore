import {
  editorAdminOperation,
  editorPublishedPage,
  type EditorOperation,
} from "@/lib/editor-api.functions";
import type { PersistenceDatabaseAdapter } from "./persistence-types";
import { PersistenceError } from "./persistence-errors";
type Request = EditorOperation;
async function call<T>(data: Request): Promise<T> {
  const response = await editorAdminOperation({ data });
  if (!response.ok)
    throw new PersistenceError({
      code: response.error.code,
      publicMessage: response.error.message,
      retryable: response.error.retryable,
      ...("conflict" in response.error ? { conflict: response.error.conflict } : {}),
    });
  return JSON.parse(response.json) as T;
}
/** Typed browser transport only; session and role decisions are always made on the server. */
export const independentPersistenceAdapter: PersistenceDatabaseAdapter = {
  getPublishedPageBySlug: (slug, scope = "default") =>
    editorPublishedPage({ data: { slug, scope: scope as "default" } }),
  getPageByKey: (key, scope = "default") =>
    call({ op: "getPageByKey", key, scope: scope as "default" }),
  getPageById: (id, scope = "default") =>
    call({ op: "getPageById", id, scope: scope as "default" }),
  getDraftByPageId: (id, scope = "default") =>
    call({ op: "getDraftByPageId", id, scope: scope as "default" }),
  saveDraftAtomic: (input) =>
    call({
      op: "saveDraftAtomic",
      input: input as Extract<Request, { op: "saveDraftAtomic" }>["input"],
    }),
  archiveDraft: (id, expected, scope = "default") =>
    call({ op: "archiveDraft", id, expected, scope: scope as "default" }),
  listVersionMetadata: (input) =>
    call({
      op: "listVersionMetadata",
      input: input as Extract<Request, { op: "listVersionMetadata" }>["input"],
    }),
  getVersionById: (pageId, versionId, scope = "default") =>
    call({ op: "getVersionById", pageId, versionId, scope: scope as "default" }),
  publishDraftAtomic: (input) =>
    call({
      op: "publishDraftAtomic",
      input: input as Extract<Request, { op: "publishDraftAtomic" }>["input"],
    }),
  restoreVersionAtomic: (input) =>
    call({
      op: "restoreVersionAtomic",
      input: input as Extract<Request, { op: "restoreVersionAtomic" }>["input"],
    }),
  listPublishingEvents: (id, limit = 25, scope = "default") =>
    call({ op: "listPublishingEvents", id, limit, scope: scope as "default" }),
};
export const defaultPersistenceAdapter = independentPersistenceAdapter;
