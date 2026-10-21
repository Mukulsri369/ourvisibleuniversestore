import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryTransactionalPersistenceAdapter } from "../persistence/index";
import { calculateFitZoomPercent, resolveStudioViewportState } from "../studio/studio-viewport";
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

describe("Prompt 9 — Viewport Device Presets, Responsive Breakpoints & Canvas Zoom", () => {
  it("resolves breakpoints strictly from page width and never lets zoom corrupt breakpoint inheritance", () => {
    // 390px mobile viewport displayed at 75% zoom must still resolve to 390px and "mobile" breakpoint
    const mobileAt75 = resolveStudioViewportState({
      devicePreset: "mobile",
      zoomMode: "manual",
      zoomPercent: 75,
    });
    expect(mobileAt75.viewportWidthPx).toBe(390);
    expect(mobileAt75.breakpoint).toBe("mobile");
    expect(mobileAt75.zoomPercent).toBe(75);
    expect(mobileAt75.zoomScale).toBe(0.75);

    // 1440px desktop viewport displayed at 50% zoom must still resolve to 1440px and "desktop" breakpoint
    const desktopAt50 = resolveStudioViewportState({
      devicePreset: "desktop",
      zoomMode: "manual",
      zoomPercent: 50,
    });
    expect(desktopAt50.viewportWidthPx).toBe(1440);
    expect(desktopAt50.breakpoint).toBe("desktop");
    expect(desktopAt50.zoomPercent).toBe(50);
    expect(desktopAt50.zoomScale).toBe(0.5);

    // Fit zoom calculation scales down wide viewports without modifying viewportWidthPx
    const fitPercent = calculateFitZoomPercent(1440, 800, 48);
    expect(fitPercent).toBeLessThan(100);
    expect(fitPercent).toBeGreaterThanOrEqual(25);
  });

  it("updates the actual canvas stage width and breakpoint when switching Desktop, Tablet, Mobile, and Zoom controls without marking the draft dirty", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const adapter = new InMemoryTransactionalPersistenceAdapter({
      role: "admin",
      userId: "admin-1",
      email: "admin@ourvisibleuniverse.com",
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

    const getPrimaryStage = () => screen.getAllByTestId("studio-canvas-stage")[0];

    // Default: Desktop 1440px @ 100%
    expect(getPrimaryStage().getAttribute("data-studio-viewport-width")).toBe("1440");
    expect(getPrimaryStage().getAttribute("data-studio-breakpoint")).toBe("desktop");
    expect(getPrimaryStage().getAttribute("data-studio-zoom-scale")).toBe("1");

    // Switch to Tablet (768px)
    fireEvent.click(screen.getAllByTestId("studio-preset-tablet")[0]);
    expect(getPrimaryStage().getAttribute("data-studio-viewport-width")).toBe("768");
    expect(getPrimaryStage().getAttribute("data-studio-breakpoint")).toBe("tablet");

    // Switch to Mobile (390px)
    fireEvent.click(screen.getAllByTestId("studio-preset-mobile")[0]);
    expect(getPrimaryStage().getAttribute("data-studio-viewport-width")).toBe("390");
    expect(getPrimaryStage().getAttribute("data-studio-breakpoint")).toBe("mobile");

    // Change zoom to 75% on Mobile -> viewport width remains 390px and breakpoint remains "mobile"
    const zoomSelect = screen.getAllByTestId("studio-zoom-select")[0];
    fireEvent.change(zoomSelect, { target: { value: "75" } });
    expect(getPrimaryStage().getAttribute("data-studio-viewport-width")).toBe("390");
    expect(getPrimaryStage().getAttribute("data-studio-breakpoint")).toBe("mobile");
    expect(getPrimaryStage().getAttribute("data-studio-zoom-scale")).toBe("0.75");

    // Zoom and viewport changes must NOT mark the working draft as dirty
    expect(screen.getByTestId("studio-persistence-summary")).toHaveTextContent(
      /Canonical Baseline · Unmodified/i,
    );
  });
});
