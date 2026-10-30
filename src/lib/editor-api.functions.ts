import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { storeAdminMiddleware } from "./store-api.functions";
import { PersistenceError } from "./visual-editor/persistence/persistence-errors";
const scope = z.literal("default").default("default"),
  id = z.string().uuid(),
  rev = z.number().int().nonnegative(),
  notes = z.string().max(1000).nullable();
const operation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("getPageByKey"), key: z.string().max(120), scope }),
  z.object({ op: z.literal("getPageById"), id, scope }),
  z.object({ op: z.literal("getDraftByPageId"), id, scope }),
  z.object({
    op: z.literal("saveDraftAtomic"),
    input: z.object({
      pageKey: z.string().max(120),
      pageType: z.enum(["home", "category", "landing", "custom"]),
      slug: z.string().max(200),
      title: z.string().max(200),
      schemaVersion: z.string().max(32),
      draftDocument: z.unknown(),
      checksum: z.string().max(128),
      expectedDraftRevision: rev.nullable(),
      storeScope: scope,
    }),
  }),
  z.object({ op: z.literal("archiveDraft"), id, expected: rev, scope }),
  z.object({
    op: z.literal("listVersionMetadata"),
    input: z.object({
      pageId: id,
      limit: z.number().int().min(1).max(100),
      offset: z.number().int().nonnegative().max(100000),
      storeScope: scope,
    }),
  }),
  z.object({ op: z.literal("getVersionById"), pageId: id, versionId: id, scope }),
  z.object({
    op: z.literal("publishDraftAtomic"),
    input: z.object({
      pageId: id,
      expectedDraftRevision: rev,
      expectedPublishedRevision: rev.nullable(),
      releaseNotes: notes,
      storeScope: scope,
    }),
  }),
  z.object({
    op: z.literal("restoreVersionAtomic"),
    input: z.object({
      pageId: id,
      targetVersionId: id,
      expectedPublishedRevision: rev.nullable(),
      syncDraft: z.boolean(),
      releaseNotes: notes,
      storeScope: scope,
    }),
  }),
  z.object({
    op: z.literal("listPublishingEvents"),
    id,
    limit: z.number().int().min(1).max(100),
    scope,
  }),
]);
export type EditorOperation = z.input<typeof operation>;
export const editorAdminOperation = createServerFn({ method: "POST" })
  .middleware([storeAdminMiddleware])
  .inputValidator((input: unknown) => operation.parse(input))
  .handler(async ({ data, context }) => {
    const { MariaDbPageAdapter } = await import("@/backend/pages.server");
    const adapter = new MariaDbPageAdapter(context.principal);
    try {
      let result: unknown;
      switch (data.op) {
        case "getPageByKey":
          result = await adapter.getPageByKey(data.key, data.scope);
          break;
        case "getPageById":
          result = await adapter.getPageById(data.id, data.scope);
          break;
        case "getDraftByPageId":
          result = await adapter.getDraftByPageId(data.id, data.scope);
          break;
        case "saveDraftAtomic":
          result = await adapter.saveDraftAtomic(
            data.input as Parameters<typeof adapter.saveDraftAtomic>[0],
          );
          break;
        case "archiveDraft":
          result = await adapter.archiveDraft(data.id, data.expected, data.scope);
          break;
        case "listVersionMetadata":
          result = await adapter.listVersionMetadata(data.input);
          break;
        case "getVersionById":
          result = await adapter.getVersionById(data.pageId, data.versionId, data.scope);
          break;
        case "publishDraftAtomic":
          result = await adapter.publishDraftAtomic(data.input);
          break;
        case "restoreVersionAtomic":
          result = await adapter.restoreVersionAtomic(data.input);
          break;
        case "listPublishingEvents":
          result = await adapter.listPublishingEvents(data.id, data.limit, data.scope);
          break;
      }
      return { ok: true as const, json: JSON.stringify(result) };
    } catch (error) {
      if (error instanceof PersistenceError)
        return { ok: false as const, error: error.toPublicJSON() };
      // Never expose database statements, parameters, paths or driver diagnostics.
      return {
        ok: false as const,
        error: {
          code: "DATABASE_UNAVAILABLE" as const,
          message: "Design storage is temporarily unavailable.",
          retryable: true,
        },
      };
    }
  });
export const editorPublishedPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().max(200), scope }).parse(input))
  .handler(async ({ data }) => {
    const { MariaDbPageAdapter } = await import("@/backend/pages.server");
    return new MariaDbPageAdapter().getPublishedPageBySlug(data.slug, data.scope);
  });
