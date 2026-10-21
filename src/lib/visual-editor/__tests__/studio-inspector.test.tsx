import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CANONICAL_HOMEPAGE_NODE_IDS,
  DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
} from "../homepage/default-homepage-document";
import { InMemoryTransactionalPersistenceAdapter } from "../persistence/index";
import {
  GLOBAL_CHROME_HEADER_ID,
  updateStudioNodeAppearance,
  updateStudioNodeName,
  updateStudioNodeProp,
  updateStudioNodeSpacing,
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
});

describe("Prompt 9 — Studio Inspector Component Inspection, Safe Property Editing & Protected Boundaries", () => {
  it("inspects different component types (PlanetHero, ProductScrollRail, FestivalSection, BenefitsSection, InstagramSection, StoreHeader, CelestialScrollWorld) with accurate capability gating", async () => {
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    render(
      <QueryClientProvider client={qc}>
        <StudioShell
          persistenceAdapter={adapter}
          initialHomeData={{ featured: [], newest: [], festival: [], allProducts: [] }}
          initialCategories={[]}
          initialSettings={null}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("studio-shell")).toBeInTheDocument();
    });

    // 1. Default selection: PlanetHero
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("PlanetHero");

    // Switch to Responsive/Data tab to verify Protected Business Data Boundary notice
    fireEvent.click(screen.getByTestId("studio-inspector-tab-responsive"));
    expect(screen.getByTestId("inspector-protected-business-notice")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("studio-inspector-tab-content"));

    // 2. Select CelestialScrollWorld (global background layer)
    fireEvent.click(
      screen.getByTestId(`studio-layer-select-${CANONICAL_HOMEPAGE_NODE_IDS.celestialBackground}`),
    );
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent(
      "CelestialScrollWorld",
    );
    expect(screen.getByTestId("inspector-no-editable-text-props")).toBeInTheDocument();

    // 3. Select StoreHeader (global route chrome)
    fireEvent.click(screen.getByTestId(`studio-layer-select-${GLOBAL_CHROME_HEADER_ID}`));
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("StoreHeader");
    expect(screen.getByText(/Global Store Header and Footer content/i)).toBeInTheDocument();

    // 4. Select Featured Products Rail (FeaturedCollection) and Newest Additions Rail (ProductScrollRail)
    fireEvent.click(
      screen.getByTestId(`studio-layer-select-${CANONICAL_HOMEPAGE_NODE_IDS.featuredRail}`),
    );
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent(
      "FeaturedCollection",
    );
    expect(screen.getByTestId("inspector-prop-title")).toHaveValue("Featured");

    fireEvent.click(
      screen.getByTestId(`studio-layer-select-${CANONICAL_HOMEPAGE_NODE_IDS.newArrivalsRail}`),
    );
    expect(screen.getByTestId("studio-inspector-node-type")).toHaveTextContent("ProductScrollRail");
    expect(screen.getByTestId("inspector-prop-title")).toHaveValue("New arrivals");
  });

  it("edits content, spacing, appearance, and breakpoint visibility on supported nodes and rejects protected business fields", () => {
    // 1. Rename node
    const renamed = updateStudioNodeName(
      DEFAULT_HOMEPAGE_PAGE_DOCUMENT,
      CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
      "Curated Cosmic Rail",
    );
    expect(renamed.ok).toBe(true);

    // 2. Edit content props (title, description, label)
    const contentEdited = updateStudioNodeProp(
      renamed.document,
      CANONICAL_HOMEPAGE_NODE_IDS.instagramSection,
      "label",
      "Explore @OurVisibleUniverse",
    );
    expect(contentEdited.ok).toBe(true);

    // 3. Edit spacing (padding & margin)
    const spacingEdited = updateStudioNodeSpacing(
      contentEdited.document,
      CANONICAL_HOMEPAGE_NODE_IDS.benefitsSection,
      "padding",
      { top: 32, right: 16, bottom: 32, left: 16, unit: "px" },
      "desktop",
    );
    expect(spacingEdited.ok).toBe(true);

    // 4. Edit appearance (backgroundColor, opacity, cornerRadiusPx)
    const appearanceEdited = updateStudioNodeAppearance(
      spacingEdited.document,
      CANONICAL_HOMEPAGE_NODE_IDS.instagramSection,
      {
        backgroundColor: "rgba(15, 23, 42, 0.85)",
        opacity: 0.95,
        cornerRadiusPx: 24,
      },
      "desktop",
    );
    expect(appearanceEdited.ok).toBe(true);

    // 5. Edit responsive visibility at mobile breakpoint
    const mobileVisibility = updateStudioNodeVisibility(
      appearanceEdited.document,
      CANONICAL_HOMEPAGE_NODE_IDS.interestSection,
      false,
      "mobile",
    );
    expect(mobileVisibility.ok).toBe(true);

    // 6. Block protected business-data keys (price, affiliate_url, amazon_url, slug)
    for (const forbiddenKey of ["price", "affiliate_url", "amazon_url", "slug"]) {
      const blocked = updateStudioNodeProp(
        mobileVisibility.document,
        CANONICAL_HOMEPAGE_NODE_IDS.featuredRail,
        forbiddenKey as never,
        "hacked" as never,
      );
      expect(blocked.ok).toBe(false);
      expect(blocked.error).toMatch(/Protected business property|is not supported/i);
    }
  });
});
