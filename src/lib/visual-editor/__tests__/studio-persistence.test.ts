import fs from "node:fs";
import path from "node:path";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "../homepage/default-homepage-document";
import {
  getPublishedPage,
  InMemoryTransactionalPersistenceAdapter,
  PersistenceError,
} from "../persistence/index";
import {
  loadStudioWorkspaceDraft,
  saveStudioWorkspaceDraft,
  updateStudioNodeAppearance,
  updateStudioNodeProp,
  updateStudioNodeVisibility,
} from "../studio/index";
import { StudioShell } from "@/components/visual-editor/StudioShell";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      activeProps: _activeProps,
      activeOptions: _activeOptions,
      ...rest
    }: {
      children: React.ReactNode;
      to?: string;
      className?: string;
      activeProps?: unknown;
      activeOptions?: unknown;
      [key: string]: unknown;
    }) =>
      React.createElement(
        "a",
        {
          href: typeof to === "string" ? to : "#",
          className,
          ...rest,
        },
        children,
      ),
    useNavigate: () => vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe("Prompt 9 — Studio Draft Editing, Saving, Conflict Handling & Bundle Isolation", () => {
  it("completes the end-to-end property editing and draft-saving vertical slice without modifying the live published page", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    const { unmount } = render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(StudioShell, {
          persistenceAdapter: adapter,
          initialHomeData: { featured: [], newest: [], festival: [], allProducts: [] },
          initialCategories: [],
          initialSettings: null,
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    // 1. Select the Instagram promotional section in the Layer Tree
    fireEvent.click(
      screen.getByTestId(`studio-layer-select-${CANONICAL_HOMEPAGE_NODE_IDS.instagramSection}`),
    );
    expect(screen.getByTestId("studio-inspector-node-name")).toHaveTextContent(
      "Instagram Community Banner",
    );

    // 2. Edit the section title in the Inspector
    const titleInput = screen.getByTestId("inspector-prop-title") as HTMLInputElement;
    expect(titleInput.value).toBe("Follow our journey");

    fireEvent.change(titleInput, {
      target: { value: "Join Our Deep Space Observatory" },
    });

    // 3. Live canvas immediately reflects the updated heading and draft becomes dirty
    const primaryStage = screen.getAllByTestId("studio-canvas-stage")[0];
    expect(primaryStage.textContent).toContain("Join Our Deep Space Observatory");
    expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(/Unsaved changes/i);

    // 4. Click Save Draft -> persists Revision 1 via Prompt 8 persistence
    fireEvent.click(screen.getByTestId("studio-save-draft-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(
        /Draft Saved · Rev 1/i,
      );
    });

    // 5. Verify live published page was NOT modified by saving the draft
    const publicRead = await getPublishedPage("/", { adapter });
    expect(publicRead.source).toBe("canonical_fallback");
    expect(JSON.stringify(publicRead.document)).not.toContain("Join Our Deep Space Observatory");

    // 6. Unmount and remount StudioShell (simulating page refresh) -> restores the saved draft!
    unmount();

    render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(StudioShell, {
          persistenceAdapter: adapter,
          initialHomeData: { featured: [], newest: [], festival: [], allProducts: [] },
          initialCategories: [],
          initialSettings: null,
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(
        /Draft Saved · Rev 1/i,
      );
    });

    const refreshedStage = screen.getAllByTestId("studio-canvas-stage")[0];
    expect(refreshedStage.textContent).toContain("Join Our Deep Space Observatory");
  });

  it("handles concurrent save revision conflicts and preserves unsaved working changes in memory", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    // Initial load (no draft yet -> draftRevision 0)
    const initialLoad = await loadStudioWorkspaceDraft({ adapter });
    expect(initialLoad.draftRevision).toBe(0);

    // Tab A saves Revision 1
    const editA = updateStudioNodeProp(
      initialLoad.workingDocument,
      CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection,
      "title",
      "Why Astronomers Choose Us",
    );
    expect(editA.ok).toBe(true);
    const saveA = await saveStudioWorkspaceDraft(
      {
        workingDocument: editA.document,
        expectedDraftRevision: 0,
      },
      { adapter },
    );
    expect(saveA.ok).toBe(true);
    expect(saveA.draftRevision).toBe(1);

    // Tab B attempts to save with stale expectedDraftRevision: 0
    const editB = updateStudioNodeProp(
      initialLoad.workingDocument,
      CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection,
      "title",
      "Stale Tab B Title",
    );
    const saveB = await saveStudioWorkspaceDraft(
      {
        workingDocument: editB.document,
        expectedDraftRevision: 0,
      },
      { adapter },
    );
    expect(saveB.ok).toBe(false);
    expect(saveB.error).toBeInstanceOf(PersistenceError);
    expect(saveB.error?.code).toBe("DRAFT_REVISION_CONFLICT");
    // Unsaved working document is preserved in outcome
    expect(JSON.stringify(saveB.persistedDocument)).toContain("Stale Tab B Title");
  });

  it("blocks protected business-data fields and unsupported component properties from being edited", () => {
    // 1. Attempt to inject forbidden business field
    const forbiddenAttempt = updateStudioNodeProp(
      DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "price" as never,
      "19.99" as never,
    );
    expect(forbiddenAttempt.ok).toBe(false);
    expect(forbiddenAttempt.error).toMatch(/Protected business property/i);

    // 2. Attempt to edit background color on CelestialScrollWorld (where backgroundColor is unsupported)
    const unsupportedBg = updateStudioNodeAppearance(
      DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground,
      { backgroundColor: "#000000" },
    );
    expect(unsupportedBg.ok).toBe(false);
    expect(unsupportedBg.error).toMatch(/does not support background color/i);

    // 3. Valid visibility toggle on InterestSection succeeds and preserves structural sharing on sibling nodes
    const visibilityEdit = updateStudioNodeVisibility(
      DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      CANONICAL_HOMEPAGE_NODE_IDS.interestSection,
      false,
    );
    expect(visibilityEdit.ok).toBe(true);
    // Unchanged sibling node reference is preserved (no full-document JSON clone)
    expect(visibilityEdit.document.root[0]).toBe(DEFAULT_HOMEPAGE_PAGE_DOCUMENT.root[0]);
  });

  it("verifies public storefront route does not import editor-only studio UI or workspace modules", () => {
    const storeIndexSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/routes/_store.index.tsx"),
      "utf8",
    );
    const homepageRendererSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/visual-editor/homepage/HomepageRenderer.tsx"),
      "utf8",
    );

    expect(storeIndexSource).not.toContain("components/visual-editor");
    expect(storeIndexSource).not.toContain("visual-editor/studio");
    expect(homepageRendererSource).not.toContain("components/visual-editor");
    expect(homepageRendererSource).not.toContain("visual-editor/studio");
  });
});
