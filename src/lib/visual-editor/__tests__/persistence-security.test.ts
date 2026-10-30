import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_PAGE_DOCUMENT } from "../homepage/default-homepage-document";
import {
  createInitialHomepageDraft,
  getAdminDraft,
  getAuthorizedPageVersion,
  getPublishedPage,
  InMemoryTransactionalPersistenceAdapter,
  listPagePublishingEvents,
  listPageVersions,
  savePageDraft,
  validateDocumentForPersistence,
} from "../persistence/index";
import { publishPageDraft, restorePublishedVersion } from "../publishing/index";
import { updateNodeById } from "../utils/node-tree";

describe("Prompt 8 — Authorization Boundary Matrix & Business-Data Protection", () => {
  it("revalidates mutable callers and keeps cached normalized snapshots deeply immutable", () => {
    const input = structuredClone(DEFAULT_HOMEPAGE_PAGE_DOCUMENT);
    const validated = validateDocumentForPersistence(input);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(validated.document)).toBe(true);
    expect(Object.isFrozen(validated.document.root[1].props)).toBe(true);
    expect(() => {
      validated.document.root[1].name = "Mutable cache attack";
    }).toThrow();
    input.root[1].props.href = "javascript:alert(1)";
    expect(() => validateDocumentForPersistence(input)).toThrow();
    expect(validateDocumentForPersistence(validated.document).document).toBe(validated.document);
  });
  it("1. enforces strict authorization matrix across anonymous, non-admin authenticated, and admin roles", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    // Seed a draft (rev 1) and published version (v1) as admin
    const created = await createInitialHomepageDraft({ adapter });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pub = await publishPageDraft(
      {
        pageId: created.page.id,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(pub.ok).toBe(true);
    if (!pub.ok) return;

    // --- 1. ANONYMOUS VISITOR ---
    adapter.setActor({ role: "anonymous" });

    // Anonymous CAN read published design via narrow public API
    const anonPublicRead = await getPublishedPage("/", { adapter });
    expect(anonPublicRead.source).toBe("database_published");
    expect(anonPublicRead.publishedSnapshot?.versionId).toBe(pub.publishedVersion.id);

    // Anonymous CANNOT read drafts, save drafts, list versions, publish, or restore
    await expect(getAdminDraft(created.page.id, { adapter })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const anonSave = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Hacked",
        document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(anonSave.ok).toBe(false);
    if (!anonSave.ok) expect(anonSave.error.code).toBe("UNAUTHORIZED");

    await expect(listPageVersions({ pageId: created.page.id, adapter })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await expect(
      getAuthorizedPageVersion(created.page.id, pub.publishedVersion.id, { adapter }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(listPagePublishingEvents(created.page.id, 10, { adapter })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const anonPub = await publishPageDraft(
      { pageId: created.page.id, expectedDraftRevision: 1 },
      { adapter },
    );
    expect(anonPub.ok).toBe(false);
    if (!anonPub.ok) expect(anonPub.error.code).toBe("UNAUTHORIZED");

    const anonRestore = await restorePublishedVersion(
      { pageId: created.page.id, targetVersionId: pub.publishedVersion.id },
      { adapter },
    );
    expect(anonRestore.ok).toBe(false);
    if (!anonRestore.ok) expect(anonRestore.error.code).toBe("UNAUTHORIZED");

    // --- 2. AUTHENTICATED NON-ADMIN ---
    adapter.setActor({
      role: "authenticated_non_admin",
      userId: "customer-99",
      email: "visitor@example.com",
    });

    await expect(getAdminDraft(created.page.id, { adapter })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const nonAdminSave = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Non-admin edit",
        document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        expectedDraftRevision: 1,
      },
      { adapter },
    );
    expect(nonAdminSave.ok).toBe(false);
    if (!nonAdminSave.ok) expect(nonAdminSave.error.code).toBe("FORBIDDEN");

    await expect(listPageVersions({ pageId: created.page.id, adapter })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const nonAdminPub = await publishPageDraft(
      { pageId: created.page.id, expectedDraftRevision: 1 },
      { adapter },
    );
    expect(nonAdminPub.ok).toBe(false);
    if (!nonAdminPub.ok) expect(nonAdminPub.error.code).toBe("FORBIDDEN");

    const nonAdminRestore = await restorePublishedVersion(
      { pageId: created.page.id, targetVersionId: pub.publishedVersion.id },
      { adapter },
    );
    expect(nonAdminRestore.ok).toBe(false);
    if (!nonAdminRestore.ok) expect(nonAdminRestore.error.code).toBe("FORBIDDEN");
  });

  it("2. blocks cross-store scope spoofing and protects authoritative product/affiliate business fields", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    // Reject foreign storeScope
    const crossStoreAttempt = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Other Store",
        document: DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
        expectedDraftRevision: 0,
        storeScope: "other-tenant-store",
      },
      { adapter },
    );
    expect(crossStoreAttempt.ok).toBe(false);
    if (!crossStoreAttempt.ok) {
      expect(crossStoreAttempt.error.code).toBe("FORBIDDEN");
    }

    // Reject PageDocument that attempts to override protected affiliate_url or price in customAttributes
    const docWithBusinessOverride = updateNodeById(
      DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      "home-featured-products",
      (node) => ({
        ...node,
        props: {
          ...node.props,
          customAttributes: {
            affiliate_url: "https://malicious.example.com/override",
            price: 1,
          },
        },
      }),
    );

    expect(() => validateDocumentForPersistence(docWithBusinessOverride)).toThrow(
      /protected business/i,
    );

    const badSave = await savePageDraft(
      {
        pageKey: "home",
        slug: "/",
        title: "Homepage",
        document: docWithBusinessOverride,
        expectedDraftRevision: 0,
      },
      { adapter },
    );
    expect(badSave.ok).toBe(false);
    if (!badSave.ok) {
      expect(badSave.error.code).toBe("VALIDATION_FAILED");
      expect(badSave.error.validationIssues?.[0]?.code).toBe("FORBIDDEN_BUSINESS_DATA_OVERRIDE");
    }
  });
});
