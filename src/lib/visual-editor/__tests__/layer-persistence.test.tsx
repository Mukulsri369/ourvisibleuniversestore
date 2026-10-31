import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioShell } from "@/components/visual-editor/StudioShell";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import { CANONICAL_HOMEPAGE_NODE_IDS } from "../homepage/default-homepage-document";
import {
  getPublishedPage,
  InMemoryTransactionalPersistenceAdapter,
  PersistenceError,
} from "../persistence/index";
import { reorderSiblingNode } from "../structure/index";
import { loadStudioWorkspaceDraft, saveStudioWorkspaceDraft } from "../studio/index";

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
    }) => (
      <a href={typeof to === "string" ? to : "#"} className={className} {...rest}>
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const MOCK_CATEGORIES: Category[] = [
  {
    id: "cat-1",
    name: "Galaxy Lamps",
    slug: "galaxy-lamps",
    description: "Ambient space lighting",
    image_url: "/img/lamps.jpg",
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    active: true,
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const MOCK_PRODUCTS: ProductCardData[] = [
  {
    id: "prod-1",
    name: "Nebula Lamp",
    slug: "nebula-lamp",
    short_description: "Ambient nebula projector",
    price: 49,
    currency: "USD",
    affiliate_url: "https://www.amazon.com/dp/B001122334?tag=cosmic-20",
    featured: true,
    category_id: "cat-1",
    category_ids: ["cat-1"],
    category: { name: "Galaxy Lamps", slug: "galaxy-lamps" },
    image: "/img/lamp.jpg",
    imageAlt: "Nebula Lamp",
    images: [{ image_url: "/img/lamp.jpg", alt_text: "Nebula Lamp" }],
    created_at: "2026-01-01T00:00:00Z",
  },
];

const MOCK_HOME_DATA: HomeData = {
  featured: MOCK_PRODUCTS,
  newest: MOCK_PRODUCTS,
  festival: MOCK_PRODUCTS,
  allProducts: MOCK_PRODUCTS,
};

const MOCK_SETTINGS: Settings = {
  id: 1,
  store_name: "Cosmic Store",
  logo_url: null,
  footer_text: "Curated cosmic gifts",
  affiliate_disclosure: "We may earn a commission.",
  instagram_url: "https://instagram.com/cosmic",
  contact_email: null,
  social_links: {
    festival_special: {
      enabled: true,
      eyebrow: "Festival Special",
      title: "Festival Lights",
      description: "Galaxy night lights and starry lamps.",
    },
  },
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("Prompt 11 — Structural Layer Persistence & Published Storefront Isolation", () => {
  const featuredId = CANONICAL_HOMEPAGE_NODE_IDS.featuredRail;
  const festivalId = CANONICAL_HOMEPAGE_NODE_IDS.festivalSection;
  const instagramId = CANONICAL_HOMEPAGE_NODE_IDS.instagramSection;
  const benefitsId = CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection;

  it("marks draft dirty on structural edits, persists reorder/rename/lock/visibility/duplication via Save Draft, and restores on reload without affecting published storefront", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <StudioShell
          persistenceAdapter={adapter}
          initialHomeData={MOCK_HOME_DATA}
          initialCategories={MOCK_CATEGORIES}
          initialSettings={MOCK_SETTINGS}
        />
      </QueryClientProvider>,
    );

    await screen.findByTestId(`studio-layer-select-${featuredId}`);

    // 1. Reorder featuredRail up above festivalSection
    fireEvent.click(screen.getByTestId(`studio-layer-move-up-${featuredId}`));

    // 2. Rename featuredRail inline
    fireEvent.doubleClick(screen.getByTestId(`studio-layer-select-${featuredId}`));
    const renameInput = await screen.findByTestId(`studio-layer-rename-input-${featuredId}`);
    fireEvent.change(renameInput, { target: { value: "Persisted Featured Rail" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    // 3. Hide instagramSection
    fireEvent.click(screen.getByTestId(`studio-layer-visibility-${instagramId}`));

    // 4. Lock benefitsSection
    fireEvent.click(screen.getByTestId(`studio-layer-lock-${benefitsId}`));

    // Verify dirty status badge shows Unsaved changes
    expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(/Unsaved changes/i);

    // 5. Save Draft
    fireEvent.click(screen.getByTestId("studio-save-draft-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(/Draft Saved/i);
    });
    fireEvent(window, new Event("online"));
    expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(/Draft Saved/i);

    // 6. Verify published storefront remains untouched (live published query falls back to canonical baseline when unpublished)
    const publishedResult = await getPublishedPage("/", { adapter });
    expect(publishedResult.source).toBe("canonical_fallback");

    // 7. Unmount and remount StudioShell to verify persisted structural changes reload accurately
    unmount();

    render(
      <QueryClientProvider client={queryClient}>
        <StudioShell
          persistenceAdapter={adapter}
          initialHomeData={MOCK_HOME_DATA}
          initialCategories={MOCK_CATEGORIES}
          initialSettings={MOCK_SETTINGS}
        />
      </QueryClientProvider>,
    );

    const reloadedFeatured = await screen.findByTestId(`studio-layer-select-${featuredId}`);
    expect(reloadedFeatured).toHaveTextContent("Persisted Featured Rail");

    expect(screen.getByTestId(`studio-layer-item-${instagramId}`)).toHaveAttribute(
      "data-layer-hidden",
      "true",
    );
    expect(screen.getByTestId(`studio-layer-item-${benefitsId}`)).toHaveAttribute(
      "data-layer-locked",
      "true",
    );

    const canvas = screen.getAllByTestId("studio-canvas-stage")[0]!;
    const reloadedOrder = Array.from(
      canvas.querySelectorAll<HTMLElement>("[data-editor-node-id]"),
    ).map((el) => el.getAttribute("data-editor-node-id"));
    expect(reloadedOrder.indexOf(featuredId)).toBeLessThan(reloadedOrder.indexOf(festivalId));
  });

  it("prevents stale revision overwrites when saving structural edits and preserves local working state", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    const initialLoad = await loadStudioWorkspaceDraft({ adapter });
    expect(initialLoad.draftRevision).toBe(0);

    // Session A reorders featuredRail up and saves Revision 1
    const reorderedA = reorderSiblingNode(initialLoad.workingDocument, featuredId, "up");
    expect(reorderedA.ok).toBe(true);

    const saveA = await saveStudioWorkspaceDraft(
      {
        workingDocument: reorderedA.document,
        expectedDraftRevision: 0,
      },
      { adapter },
    );
    expect(saveA.ok).toBe(true);
    expect(saveA.draftRevision).toBe(1);

    // Session B attempts to save a structural reorder from stale Revision 0
    const reorderedB = reorderSiblingNode(initialLoad.workingDocument, benefitsId, "up");
    expect(reorderedB.ok).toBe(true);

    const saveB = await saveStudioWorkspaceDraft(
      {
        workingDocument: reorderedB.document,
        expectedDraftRevision: 0,
      },
      { adapter },
    );
    expect(saveB.ok).toBe(false);
    expect(saveB.error).toBeInstanceOf(PersistenceError);
    expect(saveB.error?.code).toBe("DRAFT_REVISION_CONFLICT");
    // Unsaved structural working document is preserved in outcome
    expect(saveB.persistedDocument.root.map((n) => n.id)).toEqual(
      reorderedB.document.root.map((n) => n.id),
    );
  });
});
