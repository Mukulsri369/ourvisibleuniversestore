import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { useState } from "react";
import { z } from "zod";
import type { Category, ProductCardData } from "@/lib/store";
import { ProductCard } from "@/components/store/ProductCard";
import { CategoryCard } from "@/components/store/CategoryCard";

interface MockLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  children?: React.ReactNode;
  to?: string;
  params?: Record<string, string>;
}

// Mock @tanstack/react-router Link for isolated test harness
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, className, onClick, ...props }: MockLinkProps) => {
    const href = typeof to === "string" ? to.replace("$slug", params?.["slug"] ?? "") : "#";
    return (
      <a
        href={href}
        className={className}
        onClick={(e) => {
          onClick?.(e);
          // Prevent JSDOM unimplemented top-level navigation warning after handlers run
          e.preventDefault();
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
}));

// Mock outbound click tracker
const outboundTrackerMock = vi.fn();
vi.mock("@/lib/store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/store")>("@/lib/store");
  return {
    ...actual,
    logOutboundClick: (id: string) => outboundTrackerMock(id),
  };
});

const FIXTURE_PRODUCT: ProductCardData = {
  id: "prod-cosmic-123",
  name: "Celestial Moon Lamp",
  slug: "celestial-moon-lamp",
  short_description: "3D printed lunar globe with 16 RGB color modes.",
  description: "Detailed 3D topography based on NASA lunar orbiter imagery.",
  price: 49.99,
  currency: "USD",
  featured: true,
  affiliate_url: "https://www.amazon.com/dp/B08XYZ123?tag=ovu-store-20",
  created_at: new Date().toISOString(),
  category: { name: "Cosmic Lighting", slug: "cosmic-lighting" },
  category_id: "cat-lighting",
  category_ids: ["cat-lighting"],
  image: "https://images.unsplash.com/photo-1532767153582-b1a0e5145009",
  imageAlt: "Glow in the dark moon lamp",
};

const FIXTURE_CATEGORY: Category = {
  id: "cat-lighting",
  name: "Cosmic Lighting",
  slug: "cosmic-lighting",
  description: "Galaxy projectors, lunar lamps, and ambient nebula lighting.",
  image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23",
  sort_order: 1,
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Visual Editor Interaction Engine — Isolated Proof-of-Concept Suite", () => {
  // Prototype 1: Real Component Rendering (ProductCard & CategoryCard)
  it("Prototype 1: Renders genuine storefront ProductCard and CategoryCard using fixtures without markup duplication", () => {
    const { container } = render(
      <div>
        <ProductCard p={FIXTURE_PRODUCT} />
        <CategoryCard c={FIXTURE_CATEGORY} index={0} />
      </div>,
    );
    expect(screen.getByText("Celestial Moon Lamp")).toBeInTheDocument();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
    expect(screen.getByText("Buy")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cosmic Lighting" })).toBeInTheDocument();
    expect(screen.getByText(/Galaxy projectors, lunar lamps/i)).toBeInTheDocument();
    expect(container.querySelector("article")).not.toBeNull();
  });

  // Prototype 2: Element Selection without DOM Reflow
  it("Prototype 2: Selects element and renders sibling bounding-box overlay without altering component DOM tree", () => {
    function SelectionCanvas() {
      const [selectedId, setSelectedId] = useState<string | null>(null);

      return (
        <div className="relative" data-testid="canvas-stage">
          {/* Layer 1: Storefront Component Renderer */}
          <div
            data-studio-id="card-1"
            data-testid="component-slot"
            onClick={() => setSelectedId("card-1")}
          >
            <ProductCard p={FIXTURE_PRODUCT} />
          </div>

          {/* Layer 3: Decoupled Glass Overlay Layer (sibling, pointer-events-none) */}
          {selectedId === "card-1" && (
            <div
              data-testid="selection-overlay"
              className="pointer-events-none absolute inset-0 border-2 border-primary"
              style={{ zIndex: 50 }}
            >
              <div data-testid="selection-pill" className="bg-primary text-black text-xs px-1">
                ProductCard · {FIXTURE_PRODUCT.name}
              </div>
            </div>
          )}
        </div>
      );
    }

    render(<SelectionCanvas />);
    const slotBefore = screen.getByTestId("component-slot").innerHTML;
    expect(screen.queryByTestId("selection-overlay")).toBeNull();

    // Select component
    fireEvent.click(screen.getByText("Celestial Moon Lamp"));

    const overlay = screen.getByTestId("selection-overlay");
    expect(overlay).toBeInTheDocument();
    expect(screen.getByTestId("selection-pill")).toHaveTextContent("Celestial Moon Lamp");

    // Verify zero DOM mutation inside the component slot itself
    const slotAfter = screen.getByTestId("component-slot").innerHTML;
    expect(slotAfter).toBe(slotBefore);
  });

  // Prototype 3: Drag and Resize with Transient vs Committed State & Undo/Redo Restoration
  it("Prototype 3: Distinguishes transient drag dimensions from committed design config, enforces constraints, and restores original value", () => {
    function ResizableCardHarness() {
      const [committedWidth, setCommittedWidth] = useState(300);
      const [history, setHistory] = useState<number[]>([300]);
      const [transientWidth, setTransientWidth] = useState<number | null>(null);

      const clampWidth = (val: number) => Math.max(160, Math.min(600, val));

      const startAndDrag = (deltaX: number) => {
        const base = transientWidth ?? committedWidth;
        setTransientWidth(clampWidth(base + deltaX));
      };

      const commitDrag = () => {
        if (transientWidth !== null) {
          setCommittedWidth(transientWidth);
          setHistory((prev) => [...prev, transientWidth]);
          setTransientWidth(null);
        }
      };

      const undo = () => {
        if (history.length > 1) {
          const nextHistory = history.slice(0, -1);
          setHistory(nextHistory);
          setCommittedWidth(nextHistory[nextHistory.length - 1]!);
          setTransientWidth(null);
        }
      };

      const activeWidth = transientWidth ?? committedWidth;

      return (
        <div style={{ width: `${activeWidth}px` }} data-testid="resizable-container">
          <ProductCard p={FIXTURE_PRODUCT} />
          <button data-testid="drag-expand-transient" onClick={() => startAndDrag(80)}>
            Drag +80px
          </button>
          <button data-testid="drag-shrink-extreme" onClick={() => startAndDrag(-500)}>
            Drag -500px
          </button>
          <button data-testid="commit-resize" onClick={commitDrag}>
            Commit
          </button>
          <button data-testid="undo-resize" onClick={undo}>
            Undo
          </button>
          <span data-testid="transient-status">
            {transientWidth !== null ? "dragging" : "committed"}
          </span>
          <span data-testid="committed-display">{committedWidth}px</span>
          <span data-testid="active-display">{activeWidth}px</span>
        </div>
      );
    }

    render(<ResizableCardHarness />);
    expect(screen.getByTestId("committed-display")).toHaveTextContent("300px");
    expect(screen.getByTestId("transient-status")).toHaveTextContent("committed");

    // 1. Transient drag (+80px -> 380px active, but committed is still 300px)
    fireEvent.click(screen.getByTestId("drag-expand-transient"));
    expect(screen.getByTestId("active-display")).toHaveTextContent("380px");
    expect(screen.getByTestId("committed-display")).toHaveTextContent("300px");
    expect(screen.getByTestId("transient-status")).toHaveTextContent("dragging");

    // 2. Commit resize (committed becomes 380px)
    fireEvent.click(screen.getByTestId("commit-resize"));
    expect(screen.getByTestId("committed-display")).toHaveTextContent("380px");
    expect(screen.getByTestId("transient-status")).toHaveTextContent("committed");

    // 3. Drag below minimum bound (-500px -> clamped to 160px) and commit
    fireEvent.click(screen.getByTestId("drag-shrink-extreme"));
    expect(screen.getByTestId("active-display")).toHaveTextContent("160px");
    fireEvent.click(screen.getByTestId("commit-resize"));
    expect(screen.getByTestId("committed-display")).toHaveTextContent("160px");

    // 4. Undo restores 380px, second Undo restores original 300px
    fireEvent.click(screen.getByTestId("undo-resize"));
    expect(screen.getByTestId("committed-display")).toHaveTextContent("380px");
    fireEvent.click(screen.getByTestId("undo-resize"));
    expect(screen.getByTestId("committed-display")).toHaveTextContent("300px");
  });

  // Prototype 4: Shape Editing & Validation
  it("Prototype 4: Translates corner-radius handle drag into validated CSS radius tokens and rejects invalid input", () => {
    const radiusTokenSchema = z.enum([
      "rounded-none",
      "rounded-md",
      "rounded-xl",
      "rounded-2xl",
      "rounded-3xl",
      "rounded-full",
    ]);

    function pxToRadiusToken(px: number): z.infer<typeof radiusTokenSchema> {
      if (px <= 0) return "rounded-none";
      if (px <= 6) return "rounded-md";
      if (px <= 12) return "rounded-xl";
      if (px <= 16) return "rounded-2xl";
      if (px <= 24) return "rounded-3xl";
      return "rounded-full";
    }

    function ShapeEditorHarness() {
      const [radiusToken, setRadiusToken] =
        useState<z.infer<typeof radiusTokenSchema>>("rounded-2xl");

      const handleRoundChange = (rawPx: number) => {
        const candidate = pxToRadiusToken(rawPx);
        const parsed = radiusTokenSchema.safeParse(candidate);
        if (parsed.success) {
          setRadiusToken(parsed.data);
        }
      };

      return (
        <div>
          <ProductCard p={FIXTURE_PRODUCT} className={radiusToken} />
          <button data-testid="round-0" onClick={() => handleRoundChange(0)}>
            0px
          </button>
          <button data-testid="round-10" onClick={() => handleRoundChange(10)}>
            10px
          </button>
          <button data-testid="round-999" onClick={() => handleRoundChange(999)}>
            999px
          </button>
        </div>
      );
    }

    const { container } = render(<ShapeEditorHarness />);
    const article = container.querySelector("article")!;
    expect(article).toHaveClass("rounded-2xl");

    fireEvent.click(screen.getByTestId("round-10"));
    expect(article).toHaveClass("rounded-xl");

    fireEvent.click(screen.getByTestId("round-999"));
    expect(article).toHaveClass("rounded-full");

    fireEvent.click(screen.getByTestId("round-0"));
    expect(article).toHaveClass("rounded-none");

    // Verify Zod schema explicitly rejects arbitrary unsafe CSS injection
    expect(radiusTokenSchema.safeParse("rounded-[99px];background:url(evil)").success).toBe(false);
  });

  // Prototype 5: Structural Reordering with Pointer State Mutex
  it("Prototype 5: Reorders registered sections and enforces mutual exclusion between resizing and reordering", () => {
    type Section = { id: string; name: string };
    type InteractionState = "idle" | "reordering" | "resizing";

    function MutexSectionHarness() {
      const [sections, setSections] = useState<Section[]>([
        { id: "sec-hero", name: "Planet Hero" },
        { id: "sec-festival", name: "Festival Special" },
        { id: "sec-featured", name: "Featured Rail" },
      ]);
      const [mode, setMode] = useState<InteractionState>("idle");
      const [cardWidth, setCardWidth] = useState(300);

      const attemptReorder = (from: number, to: number) => {
        // Cannot reorder while resizing is active
        if (mode === "resizing") return;
        setMode("reordering");
        const next = [...sections];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        setSections(next);
        setMode("idle");
      };

      const attemptResize = (delta: number) => {
        // Cannot resize while reordering is active
        if (mode === "reordering") return;
        setCardWidth((w) => w + delta);
      };

      return (
        <div>
          <span data-testid="mode">{mode}</span>
          <span data-testid="width">{cardWidth}</span>
          <button data-testid="lock-resizing" onClick={() => setMode("resizing")}>
            Start Resize
          </button>
          <button data-testid="lock-reordering" onClick={() => setMode("reordering")}>
            Start Reorder
          </button>
          <button data-testid="try-resize" onClick={() => attemptResize(50)}>
            Try Resize
          </button>
          <button data-testid="reorder-festival-first" onClick={() => attemptReorder(1, 0)}>
            Move Festival Up
          </button>
          <ul data-testid="sections-list">
            {sections.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </div>
      );
    }

    render(<MutexSectionHarness />);
    const list = screen.getByTestId("sections-list");
    expect(list.children[0]).toHaveTextContent("Planet Hero");

    // 1. Lock in resizing mode -> section reorder must be ignored
    fireEvent.click(screen.getByTestId("lock-resizing"));
    fireEvent.click(screen.getByTestId("reorder-festival-first"));
    expect(list.children[0]).toHaveTextContent("Planet Hero");

    // 2. Lock in reordering mode -> resize must be ignored
    fireEvent.click(screen.getByTestId("lock-reordering"));
    fireEvent.click(screen.getByTestId("try-resize"));
    expect(screen.getByTestId("width")).toHaveTextContent("300");

    // 3. Normal reorder succeeds when unlocked
    cleanup();
    render(<MutexSectionHarness />);
    fireEvent.click(screen.getByTestId("reorder-festival-first"));
    expect(screen.getByTestId("sections-list").children[0]).toHaveTextContent("Festival Special");
    expect(screen.getByTestId("sections-list").children[1]).toHaveTextContent("Planet Hero");
  });

  // Prototype 6: Mini-Preview Renderer Synchronization
  it("Prototype 6: Renders identical ProductCard component in main canvas and mini-preview with isolated dimensions", () => {
    function SynchronizedInspectorHarness() {
      const [cardRadius, setCardRadius] = useState("rounded-2xl");
      const [glowEnabled, setGlowEnabled] = useState(false);

      const sharedClasses =
        `${cardRadius} ${glowEnabled ? "shadow-glow border-primary" : ""}`.trim();

      return (
        <div>
          {/* Main Canvas (Desktop 320px card) */}
          <div data-testid="main-canvas-slot" style={{ width: "320px" }}>
            <ProductCard p={FIXTURE_PRODUCT} className={sharedClasses} />
          </div>

          {/* Inspector Mini-Preview (Scaled container, does not alter stored width) */}
          <div
            data-testid="inspector-mini-preview"
            style={{ width: "180px", transform: "scale(0.75)" }}
            onClickCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <ProductCard p={FIXTURE_PRODUCT} compact={true} className={sharedClasses} />
          </div>

          <button
            data-testid="update-style"
            onClick={() => {
              setCardRadius("rounded-3xl");
              setGlowEnabled(true);
            }}
          >
            Apply Cosmic Style
          </button>
        </div>
      );
    }

    render(<SynchronizedInspectorHarness />);
    const mainArticle = screen.getByTestId("main-canvas-slot").querySelector("article")!;
    const miniArticle = screen.getByTestId("inspector-mini-preview").querySelector("article")!;

    expect(mainArticle).toHaveClass("rounded-2xl");
    expect(miniArticle).toHaveClass("rounded-2xl");

    fireEvent.click(screen.getByTestId("update-style"));

    expect(mainArticle).toHaveClass("rounded-3xl", "shadow-glow");
    expect(miniArticle).toHaveClass("rounded-3xl", "shadow-glow");
    // Main canvas width remains untouched by mini-preview container
    expect(screen.getByTestId("main-canvas-slot")).toHaveStyle({ width: "320px" });
  });

  // Prototype 7: Responsive Breakpoint Isolation
  it("Prototype 7: Persists responsive overrides per breakpoint without mobile edits corrupting desktop layout", () => {
    type Breakpoint = "desktop" | "tablet" | "mobile";
    type ResponsiveConfig = {
      desktop: { span: number; compact: boolean };
      tablet?: { span?: number; compact?: boolean };
      mobile?: { span?: number; compact?: boolean };
    };

    function resolveResponsive(config: ResponsiveConfig, bp: Breakpoint) {
      if (bp === "desktop") return config.desktop;
      if (bp === "tablet") return { ...config.desktop, ...config.tablet };
      return { ...config.desktop, ...config.tablet, ...config.mobile };
    }

    function ResponsiveEditorHarness() {
      const [bp, setBp] = useState<Breakpoint>("desktop");
      const [config, setConfig] = useState<ResponsiveConfig>({
        desktop: { span: 4, compact: false },
      });

      const resolved = resolveResponsive(config, bp);

      return (
        <div>
          <div
            data-testid="grid-item"
            data-span={resolved.span}
            className={`col-span-${resolved.span}`}
          >
            <ProductCard p={FIXTURE_PRODUCT} compact={resolved.compact} />
          </div>
          <button data-testid="switch-mobile" onClick={() => setBp("mobile")}>
            Mobile
          </button>
          <button data-testid="switch-desktop" onClick={() => setBp("desktop")}>
            Desktop
          </button>
          <button
            data-testid="resize-mobile-span"
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                mobile: { span: 12, compact: true },
              }))
            }
          >
            Set Mobile Full Width
          </button>
        </div>
      );
    }

    render(<ResponsiveEditorHarness />);
    expect(screen.getByTestId("grid-item")).toHaveAttribute("data-span", "4");

    // Switch to mobile and set span=12
    fireEvent.click(screen.getByTestId("switch-mobile"));
    fireEvent.click(screen.getByTestId("resize-mobile-span"));
    expect(screen.getByTestId("grid-item")).toHaveAttribute("data-span", "12");

    // Switch back to desktop -> desktop span=4 is completely preserved!
    fireEvent.click(screen.getByTestId("switch-desktop"));
    expect(screen.getByTestId("grid-item")).toHaveAttribute("data-span", "4");
  });

  // Prototype 8: Protected Interaction & Affiliate Destination Safety
  it("Prototype 8: Blocks affiliate redirects and click tracking in Edit Mode while preserving exact URL in Preview Mode", () => {
    function ProtectedInteractionHarness({ mode }: { mode: "edit" | "preview" }) {
      return (
        <div
          data-testid="canvas-guard"
          onClickCapture={(e) => {
            if (mode === "edit") {
              e.preventDefault();
              e.stopPropagation();
            } else {
              // In preview test environment, prevent JSDOM window navigation after click handler runs
              e.preventDefault();
            }
          }}
        >
          <ProductCard p={FIXTURE_PRODUCT} />
        </div>
      );
    }

    const { rerender } = render(<ProtectedInteractionHarness mode="edit" />);
    const buyButton = screen.getByText("Buy").closest("a")!;

    // Verify affiliate URL is never mutated or stripped
    expect(buyButton).toHaveAttribute(
      "href",
      "https://www.amazon.com/dp/B08XYZ123?tag=ovu-store-20",
    );
    expect(buyButton).toHaveAttribute("rel", "nofollow sponsored noopener noreferrer");

    // Click in Edit Mode -> intercepted at capture phase, 0 outbound clicks logged
    fireEvent.click(buyButton);
    expect(outboundTrackerMock).not.toHaveBeenCalled();

    // Switch to Preview Mode -> click reaches BuyButton handler and logs outbound click
    rerender(<ProtectedInteractionHarness mode="preview" />);
    fireEvent.click(screen.getByText("Buy").closest("a")!);
    expect(outboundTrackerMock).toHaveBeenCalledTimes(1);
    expect(outboundTrackerMock).toHaveBeenCalledWith("prod-cosmic-123");
  });
});
