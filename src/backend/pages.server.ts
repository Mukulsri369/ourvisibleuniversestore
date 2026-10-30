import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { z } from "zod";
import { database, transaction } from "./db.server";
import { requireAdmin } from "./authorization.server";
import { validateDocumentForPublishing } from "@/lib/visual-editor/publishing/publish-validation";
import type {
  PersistenceDatabaseAdapter,
  StorePageRecord,
  StorePageDraftRecord,
  StorePageVersionRecord,
  StorePagePublishingEventRecord,
} from "@/lib/visual-editor/persistence/persistence-types";
import {
  PersistenceError,
  type PersistenceErrorCode,
} from "@/lib/visual-editor/persistence/persistence-errors";
import {
  validateDocumentForPersistence,
  validateStoreScope,
  validatePageKeyAndSlug,
} from "@/lib/visual-editor/persistence/persistence-validation";

type Actor = Parameters<typeof requireAdmin>[0];
type Sql = PoolConnection | ReturnType<typeof database>;
type Row = Record<string, any>;
const uuid = (value: string) => z.string().uuid().parse(value);
const revision = (value: number | null) => z.number().int().nonnegative().nullable().parse(value);
const date = (value: any): string | null => (value == null ? null : new Date(value).toISOString());
const json = (value: any) => (typeof value === "string" ? JSON.parse(value) : value);
function fail(code: PersistenceErrorCode, message: string): never {
  throw new PersistenceError({ code, publicMessage: message, retryable: false });
}
async function rows(sql: Sql, statement: string, values: any[] = []): Promise<Row[]> {
  const [result] = await sql.execute(statement, values);
  return result as Row[];
}
function page(r: Row): StorePageRecord {
  return {
    id: r.id,
    storeScope: r.store_scope,
    pageKey: r.page_key,
    pageType: r.page_type,
    slug: r.slug,
    title: r.title,
    publishedVersionId: r.published_version_id,
    publishedRevision: r.published_revision,
    publishedAt: date(r.published_at),
    createdAt: date(r.created_at)!,
    updatedAt: date(r.updated_at)!,
  };
}
function draft(r: Row): StorePageDraftRecord {
  return {
    id: r.id,
    pageId: r.page_id,
    storeScope: r.store_scope,
    schemaVersion: r.schema_version,
    draftDocument: json(r.draft_document),
    draftRevision: r.draft_revision,
    basePublishedVersionId: r.base_published_version_id,
    basePublishedRevision: r.base_published_revision,
    state: r.state,
    checksum: r.checksum,
    createdBy: r.created_by,
    lastEditedBy: r.last_edited_by,
    createdAt: date(r.created_at)!,
    updatedAt: date(r.updated_at)!,
  };
}
function version(r: Row, current: string | null): StorePageVersionRecord {
  return {
    id: r.id,
    pageId: r.page_id,
    storeScope: r.store_scope,
    versionNumber: r.version_number,
    schemaVersion: r.schema_version,
    documentSnapshot: json(r.document_snapshot),
    checksum: r.checksum,
    sourceDraftRevision: r.source_draft_revision,
    restoredFromVersionId: r.restored_from_version_id,
    releaseNotes: r.release_notes,
    createdBy: r.created_by,
    createdAt: date(r.created_at)!,
    isCurrentPublished: r.id === current,
  };
}
function event(r: Row): StorePagePublishingEventRecord {
  return {
    id: r.id,
    pageId: r.page_id,
    storeScope: r.store_scope,
    actionType: r.action_type,
    publishedVersionId: r.published_version_id,
    previousVersionId: r.previous_version_id,
    publishedRevision: r.published_revision,
    draftRevision: r.draft_revision,
    notes: r.notes,
    actorId: r.actor_id,
    createdAt: date(r.created_at)!,
  };
}

/** Server-only implementation. No actor, checksum or publication authority comes from the browser. */
export class MariaDbPageAdapter implements PersistenceDatabaseAdapter {
  constructor(private actor: Actor = null) {}
  private async admin(sql?: PoolConnection) {
    return requireAdmin(this.actor, sql);
  }
  private async locked(sql: PoolConnection, pageId: string, scope: string) {
    validateStoreScope(scope);
    uuid(pageId);
    const [record] = await rows(
      sql,
      "SELECT * FROM store_pages WHERE id=? AND store_scope=? FOR UPDATE",
      [pageId, scope],
    );
    return record ?? fail("NOT_FOUND", "Page not found.");
  }
  async getPublishedPageBySlug(slug: string, scope = "default") {
    validateStoreScope(scope);
    z.string().max(200).parse(slug);
    const [r] = await rows(
      database(),
      "SELECT p.id AS page_id,p.page_key,p.page_type,p.slug,p.store_scope,p.published_revision,p.published_at,v.* FROM store_pages p JOIN store_page_versions v ON v.id=p.published_version_id AND v.page_id=p.id WHERE p.slug=? AND p.store_scope=?",
      [slug, scope],
    );
    if (!r) return null;
    const validated = validateDocumentForPersistence(json(r.document_snapshot));
    if (validated.checksum !== r.checksum)
      fail("VALIDATION_FAILED", "Published design integrity check failed.");
    // Authorship belongs in the private version record, not the visitor projection.
    const publicDocument = { ...validated.document, metadata: { ...validated.document.metadata } };
    delete publicDocument.metadata.authorEmail;
    const publicSnapshot = validateDocumentForPersistence(publicDocument);
    return {
      pageId: r.page_id,
      pageKey: r.page_key,
      pageType: r.page_type,
      slug: r.slug,
      storeScope: r.store_scope,
      versionId: r.id,
      versionNumber: r.version_number,
      publishedRevision: r.published_revision,
      schemaVersion: r.schema_version,
      documentSnapshot: publicSnapshot.document,
      checksum: publicSnapshot.checksum,
      publishedAt: date(r.published_at),
    };
  }
  async getPageByKey(key: string, scope = "default") {
    await this.admin();
    validateStoreScope(scope);
    z.string().max(120).parse(key);
    const [r] = await rows(
      database(),
      "SELECT * FROM store_pages WHERE page_key=? AND store_scope=?",
      [key, scope],
    );
    return r ? page(r) : null;
  }
  async getPageById(id: string, scope = "default") {
    await this.admin();
    validateStoreScope(scope);
    uuid(id);
    const [r] = await rows(database(), "SELECT * FROM store_pages WHERE id=? AND store_scope=?", [
      id,
      scope,
    ]);
    return r ? page(r) : null;
  }
  async getDraftByPageId(id: string, scope = "default") {
    await this.admin();
    validateStoreScope(scope);
    uuid(id);
    const [r] = await rows(
      database(),
      "SELECT * FROM store_page_drafts WHERE page_id=? AND store_scope=? AND state='active'",
      [id, scope],
    );
    return r ? draft(r) : null;
  }
  async saveDraftAtomic(p: Parameters<PersistenceDatabaseAdapter["saveDraftAtomic"]>[0]) {
    validateStoreScope(p.storeScope);
    const identity = validatePageKeyAndSlug(p.pageKey, p.slug);
    const title = z.string().trim().min(1).max(200).parse(p.title);
    const type = z.enum(["home", "category", "landing", "custom"]).parse(p.pageType);
    revision(p.expectedDraftRevision);
    const valid = validateDocumentForPersistence(p.draftDocument);
    return transaction(async (sql) => {
      const actor = await this.admin(sql);
      // The unique page key serializes simultaneous first saves as well as updates.
      await sql.execute(
        "INSERT INTO store_pages(id,store_scope,page_key,page_type,slug,title) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
        [randomUUID(), p.storeScope, identity.pageKey, type, identity.slug, title],
      );
      const [record] = await rows(
        sql,
        "SELECT * FROM store_pages WHERE store_scope=? AND page_key=? FOR UPDATE",
        [p.storeScope, identity.pageKey],
      );
      if (!record) fail("VALIDATION_FAILED", "Page slug belongs to another page.");
      const [old] = await rows(sql, "SELECT * FROM store_page_drafts WHERE page_id=? FOR UPDATE", [
        record.id,
      ]);
      const actual = old?.draft_revision ?? 0;
      if ((p.expectedDraftRevision ?? 0) !== actual)
        fail("DRAFT_REVISION_CONFLICT", "This draft changed. Reload before saving.");
      await sql.execute(
        "UPDATE store_pages SET title=?,slug=?,page_type=?,updated_at=CURRENT_TIMESTAMP(6) WHERE id=?",
        [title, identity.slug, type, record.id],
      );
      await sql.execute(
        "INSERT INTO store_page_drafts(id,page_id,store_scope,schema_version,draft_document,draft_revision,base_published_version_id,base_published_revision,state,checksum,created_by,last_edited_by) VALUES(?,?,?,?,?,?,?,?, 'active',?,?,?) ON DUPLICATE KEY UPDATE schema_version=VALUES(schema_version),draft_document=VALUES(draft_document),draft_revision=VALUES(draft_revision),state='active',checksum=VALUES(checksum),last_edited_by=VALUES(last_edited_by),updated_at=CURRENT_TIMESTAMP(6)",
        [
          randomUUID(),
          record.id,
          p.storeScope,
          valid.document.schemaVersion,
          JSON.stringify(valid.document),
          actual + 1,
          record.published_version_id,
          record.published_revision,
          valid.checksum,
          actor.id,
          actor.id,
        ],
      );
      const [saved] = await rows(sql, "SELECT * FROM store_page_drafts WHERE page_id=?", [
        record.id,
      ]);
      const [savedPage] = await rows(sql, "SELECT * FROM store_pages WHERE id=?", [record.id]);
      return { draft: draft(saved), page: page(savedPage) };
    });
  }
  async archiveDraft(id: string, expected: number, scope = "default") {
    revision(expected);
    return transaction(async (sql) => {
      await this.admin(sql);
      const p = await this.locked(sql, id, scope);
      const [r] = await rows(sql, "SELECT * FROM store_page_drafts WHERE page_id=? FOR UPDATE", [
        id,
      ]);
      if (!r) fail("NOT_FOUND", "Draft not found.");
      if (r.draft_revision !== expected)
        fail("DRAFT_REVISION_CONFLICT", "Draft changed. Reload before archiving.");
      await sql.execute(
        "UPDATE store_page_drafts SET state='archived',draft_revision=draft_revision+1,updated_at=CURRENT_TIMESTAMP(6) WHERE page_id=?",
        [id],
      );
      const [saved] = await rows(sql, "SELECT * FROM store_page_drafts WHERE page_id=?", [id]);
      const { draftDocument: _, ...metadata } = draft(saved);
      return {
        ...metadata,
        isBasedOnOutdatedPublishedVersion: saved.base_published_revision !== p.published_revision,
        currentPublishedRevision: p.published_revision,
      };
    });
  }
  async listVersionMetadata(p: Parameters<PersistenceDatabaseAdapter["listVersionMetadata"]>[0]) {
    await this.admin();
    validateStoreScope(p.storeScope);
    uuid(p.pageId);
    const limit = z.number().int().min(1).max(100).parse(p.limit),
      offset = z.number().int().nonnegative().max(100000).parse(p.offset);
    const record = await this.getPageById(p.pageId, p.storeScope);
    if (!record) fail("NOT_FOUND", "Page not found.");
    const list = await rows(
      database(),
      "SELECT * FROM store_page_versions WHERE page_id=? AND store_scope=? ORDER BY version_number DESC LIMIT ? OFFSET ?",
      [p.pageId, p.storeScope, limit, offset],
    );
    const [count] = await rows(
      database(),
      "SELECT COUNT(*) AS total FROM store_page_versions WHERE page_id=? AND store_scope=?",
      [p.pageId, p.storeScope],
    );
    return {
      items: list.map((r) => {
        const { documentSnapshot: _, ...metadata } = version(r, record.publishedVersionId);
        return metadata;
      }),
      total: Number(count.total),
      currentPublishedVersionId: record.publishedVersionId,
      currentPublishedRevision: record.publishedRevision,
    };
  }
  async getVersionById(pageId: string, versionId: string, scope = "default") {
    await this.admin();
    validateStoreScope(scope);
    uuid(pageId);
    uuid(versionId);
    const p = await this.getPageById(pageId, scope);
    const [r] = await rows(
      database(),
      "SELECT * FROM store_page_versions WHERE id=? AND page_id=? AND store_scope=?",
      [versionId, pageId, scope],
    );
    return r ? version(r, p?.publishedVersionId ?? null) : null;
  }
  private async release(
    sql: PoolConnection,
    p: Row,
    document: unknown,
    source: number | null,
    restored: string | null,
    notes: string | null,
    actorId: string,
  ) {
    const valid = validateDocumentForPublishing(document, p.page_type),
      id = randomUUID(),
      next = p.published_revision + 1;
    z.string().max(1000).nullable().parse(notes);
    const [maximum] = await rows(
      sql,
      "SELECT COALESCE(MAX(version_number),0) AS n FROM store_page_versions WHERE page_id=?",
      [p.id],
    );
    await sql.execute(
      "INSERT INTO store_page_versions(id,page_id,store_scope,version_number,schema_version,document_snapshot,checksum,source_draft_revision,restored_from_version_id,release_notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        p.id,
        p.store_scope,
        Number(maximum.n) + 1,
        valid.document.schemaVersion,
        JSON.stringify(valid.document),
        valid.checksum,
        source,
        restored,
        notes,
        actorId,
      ],
    );
    await sql.execute(
      "UPDATE store_pages SET published_version_id=?,published_revision=?,published_at=CURRENT_TIMESTAMP(6),updated_at=CURRENT_TIMESTAMP(6) WHERE id=?",
      [id, next, p.id],
    );
    const eventId = randomUUID();
    await sql.execute(
      "INSERT INTO store_page_publishing_events(id,page_id,store_scope,action_type,published_version_id,previous_version_id,published_revision,draft_revision,notes,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        eventId,
        p.id,
        p.store_scope,
        restored ? "rollback" : "publish",
        id,
        p.published_version_id,
        next,
        source,
        notes,
        actorId,
      ],
    );
    const [savedPage] = await rows(sql, "SELECT * FROM store_pages WHERE id=?", [p.id]);
    const [savedVersion] = await rows(sql, "SELECT * FROM store_page_versions WHERE id=?", [id]);
    const [savedEvent] = await rows(sql, "SELECT * FROM store_page_publishing_events WHERE id=?", [
      eventId,
    ]);
    return {
      page: page(savedPage),
      publishedVersion: version(savedVersion, id),
      previousVersionId: p.published_version_id as string | null,
      event: event(savedEvent),
    };
  }
  async publishDraftAtomic(input: Parameters<PersistenceDatabaseAdapter["publishDraftAtomic"]>[0]) {
    revision(input.expectedDraftRevision);
    revision(input.expectedPublishedRevision);
    return transaction(async (sql) => {
      const actor = await this.admin(sql),
        p = await this.locked(sql, input.pageId, input.storeScope);
      if (
        input.expectedPublishedRevision !== null &&
        input.expectedPublishedRevision !== p.published_revision
      )
        fail("PUBLISHED_REVISION_CONFLICT", "Published page changed. Reload before publishing.");
      const [d] = await rows(
        sql,
        "SELECT * FROM store_page_drafts WHERE page_id=? AND state='active' FOR UPDATE",
        [p.id],
      );
      if (!d) fail("NOT_FOUND", "Active draft not found.");
      if (d.draft_revision !== input.expectedDraftRevision)
        fail("DRAFT_REVISION_CONFLICT", "Draft changed. Reload before publishing.");
      const valid = validateDocumentForPersistence(json(d.draft_document));
      if (valid.checksum !== d.checksum) fail("VALIDATION_FAILED", "Draft integrity check failed.");
      const result = await this.release(
        sql,
        p,
        valid.document,
        d.draft_revision,
        null,
        input.releaseNotes,
        actor.id,
      );
      await sql.execute(
        "UPDATE store_page_drafts SET base_published_version_id=?,base_published_revision=?,updated_at=CURRENT_TIMESTAMP(6) WHERE page_id=?",
        [result.publishedVersion.id, result.page.publishedRevision, p.id],
      );
      return result;
    });
  }
  async restoreVersionAtomic(
    input: Parameters<PersistenceDatabaseAdapter["restoreVersionAtomic"]>[0],
  ) {
    uuid(input.targetVersionId);
    revision(input.expectedPublishedRevision);
    z.boolean().parse(input.syncDraft);
    return transaction(async (sql) => {
      const actor = await this.admin(sql),
        p = await this.locked(sql, input.pageId, input.storeScope);
      if (
        input.expectedPublishedRevision !== null &&
        input.expectedPublishedRevision !== p.published_revision
      )
        fail("PUBLISHED_REVISION_CONFLICT", "Published page changed. Reload before restoring.");
      const [target] = await rows(
        sql,
        "SELECT * FROM store_page_versions WHERE id=? AND page_id=? AND store_scope=?",
        [input.targetVersionId, p.id, input.storeScope],
      );
      if (!target)
        fail("INVALID_PAGE_VERSION_RELATIONSHIP", "Version does not belong to this page.");
      const valid = validateDocumentForPersistence(json(target.document_snapshot));
      if (valid.checksum !== target.checksum)
        fail("VALIDATION_FAILED", "Version integrity check failed.");
      const result = await this.release(
        sql,
        p,
        valid.document,
        null,
        target.id,
        input.releaseNotes,
        actor.id,
      );
      if (input.syncDraft)
        await sql.execute(
          "INSERT INTO store_page_drafts(id,page_id,store_scope,schema_version,draft_document,draft_revision,base_published_version_id,base_published_revision,state,checksum,created_by,last_edited_by) VALUES(?,?,?,?,?,1,?,?,'active',?,?,?) ON DUPLICATE KEY UPDATE schema_version=VALUES(schema_version),draft_document=VALUES(draft_document),draft_revision=draft_revision+1,base_published_version_id=VALUES(base_published_version_id),base_published_revision=VALUES(base_published_revision),state='active',checksum=VALUES(checksum),last_edited_by=VALUES(last_edited_by),updated_at=CURRENT_TIMESTAMP(6)",
          [
            randomUUID(),
            p.id,
            p.store_scope,
            valid.document.schemaVersion,
            JSON.stringify(valid.document),
            result.publishedVersion.id,
            result.page.publishedRevision,
            valid.checksum,
            actor.id,
            actor.id,
          ],
        );
      return { ...result, restoredFromVersionId: target.id as string };
    });
  }
  async listPublishingEvents(pageId: string, limit = 25, scope = "default") {
    await this.admin();
    validateStoreScope(scope);
    uuid(pageId);
    z.number().int().min(1).max(100).parse(limit);
    return (
      await rows(
        database(),
        "SELECT * FROM store_page_publishing_events WHERE page_id=? AND store_scope=? ORDER BY published_revision DESC LIMIT ?",
        [pageId, scope, limit],
      )
    ).map(event);
  }
}
