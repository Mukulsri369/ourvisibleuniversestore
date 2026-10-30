import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioShell } from "@/components/visual-editor/StudioShell";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import { CANONICAL_HOMEPAGE_NODE_IDS } from "../homepage/default-homepage-document";
import { updateInspectorStyleProperty } from "../inspector/index";
import { getPublishedPage, InMemoryTransactionalPersistenceAdapter } from "../persistence/index";
import { loadStudioWorkspaceDraft, saveStudioWorkspaceDraft } from "../studio/index";
import { findNodeById } from "../utils/node-tree";

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

describe("Prompt 12 — Inspector Real-Time Editing, Draft Persistence & Storefront Isolation", () => {
  const featuredId = CANONICAL_HOMEPAGE_NODE_IDS.featuredRail;

  it("applies inspector style edits in real time, marks draft dirty, persists desktop and mobile overrides via Save Draft, and isolates published storefront", async () => {
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

    // 1. Select Featured Products Rail
    const layerRow = await screen.findByTestId(`studio-layer-select-${featuredId}`);
    fireEvent.click(layerRow);

    // 2. Switch to Layout tab in StudioInspector and edit padding top at desktop
    fireEvent.click(screen.getByTestId("studio-inspector-tab-layout"));
    const padTopInput = await screen.findByTestId("inspector-padding-top");
    fireEvent.change(padTopInput, { target: { value: "36" } });

    // 3. Switch to Appearance (Style) tab and edit background color, corner radius, and shape preset
    fireEvent.click(screen.getByTestId("studio-inspector-tab-appearance"));
    const bgInput = screen.getByTestId("inspector-bg-color-input");
    fireEvent.change(bgInput, { target: { value: "#0f172a" } });

    const radiusInput = screen.getByTestId("inspector-radius-input");
    fireEvent.change(radiusInput, { target: { value: "24" } });

    const roundedPresetBtn = screen.getByTestId("inspector-shape-preset-rounded-rectangle");
    fireEvent.click(roundedPresetBtn);

    // Verify dirty status badge shows Unsaved changes
    expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(/Unsaved changes/i);

    // 4. Switch viewport preset to Mobile and set a mobile-specific padding override
    fireEvent.click(screen.getAllByTestId("studio-preset-mobile")[0]!);
    fireEvent.click(screen.getByTestId("studio-inspector-tab-layout"));
    fireEvent.change(screen.getByTestId("inspector-padding-top"), {
      target: { value: "16" },
    });

    // 5. Switch to Responsive tab and verify active breakpoint and override matrix
    fireEvent.click(screen.getByTestId("studio-inspector-tab-responsive"));
    expect(screen.getByTestId("inspector-responsive-cascade-panel")).toHaveTextContent(/mobile/i);
    expect(screen.getByTestId("inspector-active-breakpoint-override-list")).toBeInTheDocument();

    // 6. Save Draft
    fireEvent.click(screen.getByTestId("studio-save-draft-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(/Draft Saved/i);
    });

    // 7. Verify published storefront remains completely unaffected
    const published = await getPublishedPage("/", { adapter });
    expect(published.source).toBe("canonical_fallback");

    unmount();

    // 8. Reload workspace draft from persistence and verify both desktop and mobile overrides
    const reloaded = await loadStudioWorkspaceDraft({
      adapter,
      pageKey: "home",
      pageSlug: "/",
    });
    const savedNode = findNodeById(reloaded.workingDocument, featuredId)!;
    expect(savedNode.style.geometry?.padding?.top).toBe(36);
    expect(savedNode.style.appearance?.backgroundColor).toBe("#0f172a");
    expect(savedNode.style.shape?.cornerRadius?.uniform).toBe(24);
    expect(savedNode.style.shape?.shapeType).toBe("rounded-rectangle");
    expect(savedNode.responsive?.mobile?.geometry?.padding?.top).toBe(16);
  });

  it("detects optimistic concurrency conflicts when saving inspector property edits with a stale draft revision", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    const sessionA = await loadStudioWorkspaceDraft({
      adapter,
      pageKey: "home",
      pageSlug: "/",
    });
    const sessionB = await loadStudioWorkspaceDraft({
      adapter,
      pageKey: "home",
      pageSlug: "/",
    });

    const editA = updateInspectorStyleProperty(
      sessionA.workingDocument,
      featuredId,
      "appearance.backgroundColor",
      "#1e293b",
      "desktop",
    );
    expect(editA.ok).toBe(true);

    const saveA = await saveStudioWorkspaceDraft(
      {
        workingDocument: editA.document,
        expectedDraftRevision: sessionA.draftRevision,
        pageKey: "home",
        slug: "/",
        title: "Storefront Homepage",
      },
      { adapter },
    );
    expect(saveA.ok).toBe(true);

    // Session B attempts to save with stale revision
    const editB = updateInspectorStyleProperty(
      sessionB.workingDocument,
      featuredId,
      "appearance.backgroundColor",
      "#334155",
      "desktop",
    );
    expect(editB.ok).toBe(true);

    const saveB = await saveStudioWorkspaceDraft(
      {
        workingDocument: editB.document,
        expectedDraftRevision: sessionB.draftRevision,
        pageKey: "home",
        slug: "/",
        title: "Storefront Homepage",
      },
      { adapter },
    );
    expect(saveB.ok).toBe(false);
    expect(saveB.error?.code).toBe("DRAFT_REVISION_CONFLICT");
  });
});
