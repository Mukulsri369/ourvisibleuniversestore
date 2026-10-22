import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, HomeData, ProductCardData, Settings } from "@/lib/store";
import { createDefaultHomepageDocument } from "../homepage";
import { updateNodeById } from "../tree";
import { InMemoryTransactionalPersistenceAdapter } from "../persistence/index";
import {
  clearLocalDraftRecoverySnapshot,
  writeLocalDraftRecoverySnapshot,
} from "../recovery/index";
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
    }) => (
      <a href={typeof to === "string" ? to : "#"} className={className} {...rest}>
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
  };
});

const SAMPLE_CATEGORIES: Category[] = [
  {
    id: "cat-telescopes",
    name: "Telescopes & Optics",
    slug: "telescopes-optics",
    description: "Deep-sky optical instruments",
    image_url: "/img/telescopes.jpg",
    display_order: 1,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const SAMPLE_PRODUCTS: ProductCardData[] = [
  {
    id: "prod-1",
    name: "Orion Nebula Smart Telescope",
    slug: "orion-nebula-smart-telescope",
    short_description: "App-guided apochromatic refractor",
    price: 499,
    currency: "USD",
    affiliate_url: "https://example.com/affiliate/orion-telescope",
    featured: true,
    category_id: "cat-telescopes",
    category_ids: ["cat-telescopes"],
    category: { name: "Telescopes & Optics", slug: "telescopes-optics" },
    image: "/img/orion.jpg",
    imageAlt: "Orion Nebula Smart Telescope",
    images: [{ image_url: "/img/orion.jpg", alt_text: "Orion Nebula Smart Telescope" }],
  },
];

const SAMPLE_HOME_DATA: HomeData = {
  featured: SAMPLE_PRODUCTS,
  newest: SAMPLE_PRODUCTS,
  festival: SAMPLE_PRODUCTS,
  allProducts: SAMPLE_PRODUCTS,
};

const SAMPLE_SETTINGS: Settings = {
  id: 1,
  store_name: "Our Visible Universe",
  tagline: "Explore the cosmos",
  logo_url: null,
  hero_title: null,
  hero_subtitle: null,
  hero_cta_label: null,
  hero_image_url: null,
  footer_text: "Explore the universe.",
  affiliate_disclosure: "We may earn a commission.",
  instagram_url: "https://instagram.com/ourvisibleuniverse",
  contact_email: null,
  social_links: {},
  updated_at: "2026-01-01T00:00:00Z",
};

function renderStudio(adapter: InMemoryTransactionalPersistenceAdapter) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StudioShell
        persistenceAdapter={adapter}
        actorEmail="admin@example.com"
        initialHomeData={SAMPLE_HOME_DATA}
        initialCategories={SAMPLE_CATEGORIES}
        initialSettings={SAMPLE_SETTINGS}
      />
    </QueryClientProvider>,
  );
}

describe("history-persistence.test.tsx — StudioShell Undo/Redo, Shortcuts & Recovery Integration", () => {
  beforeEach(() => {
    clearLocalDraftRecoverySnapshot("home");
  });

  afterEach(() => {
    cleanup();
    clearLocalDraftRecoverySnapshot("home");
  });

  it("enables toolbar Undo/Redo buttons on Inspector edits, restores saved status on Undo to baseline, and respects keyboard shortcuts", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      adminAllowlistEmails: ["admin@example.com"],
    });

    renderStudio(adapter);

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeTruthy();
    });

    const undoBtn = screen.getByTestId("studio-undo-btn") as HTMLButtonElement;
    const redoBtn = screen.getByTestId("studio-redo-btn") as HTMLButtonElement;
    const saveDraftBtn = screen.getByTestId("studio-save-draft-btn") as HTMLButtonElement;

    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
    expect(saveDraftBtn.disabled).toBe(true);

    // Select the Story Intro section in the layer tree
    const storyLayer = screen.getByTestId("studio-layer-row-home-story-intro");
    fireEvent.click(storyLayer);

    // Toggle visibility of home-story-intro via layer tree visibility button
    const toggleVisBtn = screen.getByTestId("studio-layer-visibility-home-story-intro");
    fireEvent.click(toggleVisBtn);

    await waitFor(() => {
      expect(undoBtn.disabled).toBe(false);
      expect(saveDraftBtn.disabled).toBe(false);
    });

    // Click toolbar Undo button -> returns to baseline saved document!
    fireEvent.click(undoBtn);

    await waitFor(() => {
      expect(undoBtn.disabled).toBe(true);
      expect(redoBtn.disabled).toBe(false);
      // Because we undid back to the initial saved state, isDirty is false and Save Draft is disabled!
      expect(saveDraftBtn.disabled).toBe(true);
    });

    // Press Ctrl+Y (Redo) on window -> re-applies the visibility toggle!
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });

    await waitFor(() => {
      expect(undoBtn.disabled).toBe(false);
      expect(redoBtn.disabled).toBe(true);
      expect(saveDraftBtn.disabled).toBe(false);
    });

    // Press Ctrl+Z while focused inside the Layer Search <input> -> must NOT trigger Studio document Undo!
    const layerSearchInput = screen.getByTestId("studio-layer-search-input");
    layerSearchInput.focus();
    fireEvent.keyDown(layerSearchInput, { key: "z", ctrlKey: true });

    // Undo stack is still available because input focus guarded against global undo
    expect(undoBtn.disabled).toBe(false);

    // Blur input and press Ctrl+Z on window -> triggers Studio document Undo!
    layerSearchInput.blur();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    await waitFor(() => {
      expect(undoBtn.disabled).toBe(true);
      expect(redoBtn.disabled).toBe(false);
    });
  });

  it("detects a recoverable local unsaved checkpoint on load and allows restoring or discarding it", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      adminAllowlistEmails: ["admin@example.com"],
    });

    // Seed a local recovery checkpoint with a custom document name
    const baseDoc = createDefaultHomepageDocument();
    const unsavedDoc = {
      ...updateNodeById(baseDoc, "home-hero-planet", (n) => ({
        ...n,
        name: "Recovered Planetary Hero",
      })),
      name: "Recovered Cosmic Draft",
    };

    writeLocalDraftRecoverySnapshot({
      pageKey: "home",
      document: unsavedDoc,
      baseDraftRevision: null,
      localEditGeneration: 3,
      savedAt: new Date().toISOString(),
    });

    renderStudio(adapter);

    // Recovery modal should appear automatically
    await waitFor(() => {
      expect(screen.getByTestId("studio-recovery-dialog")).toBeTruthy();
    });

    // Click Restore Unsaved Checkpoint
    const restoreBtn = screen.getByTestId("studio-recovery-restore-btn");
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("studio-recovery-dialog")).toBeNull();
      expect(screen.getByTestId("studio-page-title").textContent).toBe("Recovered Cosmic Draft");
    });

    // Restoring is itself an undoable transaction!
    const undoBtn = screen.getByTestId("studio-undo-btn") as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);
  });
});
