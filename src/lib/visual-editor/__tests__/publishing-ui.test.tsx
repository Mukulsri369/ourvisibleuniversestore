import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioPublishing } from "@/components/visual-editor/StudioPublishing";
import { createDefaultHomepageDocument } from "../homepage/default-homepage-document";
import {
  getPublishedPage,
  getAdminDraft,
  InMemoryTransactionalPersistenceAdapter,
  savePageDraft,
  type StorePageRecord,
} from "../persistence";
import { publishPageDraft } from "../publishing";
afterEach(() => cleanup());
async function seed() {
  const adapter = new InMemoryTransactionalPersistenceAdapter({
    role: "admin",
    userId: "synthetic-admin",
    email: "synthetic@example.test",
  });
  const document = createDefaultHomepageDocument();
  const result = await savePageDraft(
    {
      pageKey: "home",
      slug: "/",
      title: "Synthetic publishing fixture",
      document,
      expectedDraftRevision: 0,
    },
    { adapter },
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  return { adapter, document, page: result.page };
}
function harness(
  adapter: InMemoryTransactionalPersistenceAdapter,
  page: StorePageRecord,
  draftRevision = 1,
  dirty = false,
) {
  const onPublished = vi.fn(),
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Example() {
    const [current, setCurrent] = useState(page);
    return (
      <QueryClientProvider client={client}>
        <StudioPublishing
          page={current}
          draftRevision={draftRevision}
          isDirty={dirty}
          adapter={adapter}
          onPublished={(next, action) => {
            onPublished(next, action);
            setCurrent(next);
          }}
        />
      </QueryClientProvider>
    );
  }
  return { ...render(<Example />), onPublished };
}
describe("independent editor publishing controls", () => {
  it("publishes the saved draft and refreshes public revision and history", async () => {
    const { adapter, page } = await seed();
    const { onPublished } = harness(adapter, page);
    fireEvent.click(screen.getByRole("button", { name: "Publish & history" }));
    await screen.findByText("No design has been published yet.");
    fireEvent.change(screen.getByLabelText("Release notes (optional)"), {
      target: { value: "Synthetic release note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish saved draft" }));
    await screen.findByText("Your saved draft is now published.");
    await screen.findByText("Version 1 · Currently published");
    expect(onPublished).toHaveBeenCalledTimes(1);
    expect(onPublished.mock.calls[0][1]).toBe("publish");
    const published = await getPublishedPage("/", { adapter });
    expect(published.source).toBe("database_published");
    expect(published.publishedSnapshot?.publishedRevision).toBe(1);
    expect(screen.getByText("Synthetic release note")).toBeInTheDocument();
  });
  it("requires current edits to be saved before publishing", async () => {
    const { adapter, page } = await seed();
    const { onPublished } = harness(adapter, page, 1, true);
    fireEvent.click(screen.getByRole("button", { name: "Publish & history" }));
    expect(screen.getByRole("button", { name: "Publish saved draft" })).toBeDisabled();
    expect(screen.getByText("Save your current edits before publishing.")).toBeInTheDocument();
    expect(onPublished).not.toHaveBeenCalled();
    expect((await getPublishedPage("/", { adapter })).source).toBe("canonical_fallback");
  });
  it("does not publish when administrator permission is revoked after opening the dialog", async () => {
    const { adapter, page } = await seed();
    const { onPublished } = harness(adapter, page);
    fireEvent.click(screen.getByRole("button", { name: "Publish & history" }));
    await screen.findByText("No design has been published yet.");
    adapter.setActor({ role: "authenticated_non_admin", userId: "synthetic-admin" });
    fireEvent.click(screen.getByRole("button", { name: "Publish saved draft" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/administrator/i));
    expect(onPublished).not.toHaveBeenCalled();
    expect((await getPublishedPage("/", { adapter })).source).toBe("canonical_fallback");
  });
  it("confirms rollback, appends a new published version and preserves the saved draft", async () => {
    const { adapter, page, document } = await seed();
    const first = await publishPageDraft(
      { pageId: page.id, expectedDraftRevision: 1, expectedPublishedRevision: 0 },
      { adapter },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw first.error;
    const edited = { ...document, name: "Synthetic second saved design" };
    const saved = await savePageDraft(
      { pageKey: "home", slug: "/", title: page.title, document: edited, expectedDraftRevision: 1 },
      { adapter },
    );
    expect(saved.ok).toBe(true);
    const second = await publishPageDraft(
      { pageId: page.id, expectedDraftRevision: 2, expectedPublishedRevision: 1 },
      { adapter },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) throw second.error;
    const { onPublished } = harness(adapter, second.page, 2, true);
    fireEvent.click(screen.getByRole("button", { name: "Publish & history" }));
    await screen.findByText("Version 2 · Currently published");
    fireEvent.click(screen.getByRole("button", { name: "Restore version 1" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Your saved draft and unsaved edits stay unchanged.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));
    await screen.findByText(
      "The selected version is now published. Your saved draft is unchanged.",
    );
    await screen.findByText("Version 3 · Currently published");
    expect(onPublished).toHaveBeenCalledTimes(1);
    expect(onPublished.mock.calls[0][1]).toBe("restore");
    expect((await getPublishedPage("/", { adapter })).document.name).toBe(document.name);
    expect((await getAdminDraft(page.id, { adapter }))?.draftDocument.name).toBe(edited.name);
    expect(
      (
        await adapter.listVersionMetadata({
          pageId: page.id,
          storeScope: "default",
          offset: 0,
          limit: 20,
        })
      ).total,
    ).toBe(3);
  });
});
