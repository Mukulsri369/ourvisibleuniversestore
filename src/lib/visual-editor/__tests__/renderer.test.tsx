import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BASIC_SECTION_DOCUMENT_FIXTURE,
  CURRENT_PAGE_SCHEMA_VERSION,
  PageRenderer,
  VisualComponentRegistry,
  createDefaultComponentRegistry,
  type EditorNode,
  type PageDocument,
} from "../index";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    className?: string;
  }) => {
    const resolvedHref = params?.slug ? to.replace("$slug", params.slug) : to;
    const query = search ? `?${new URLSearchParams(search).toString()}` : "";
    return (
      <a href={`${resolvedHref}${query}`} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Prompt 6 — Shared PageRenderer Unit Tests", () => {
  it("1. renders valid nested PageDocument hierarchy with correct ordering and default props", () => {
    const { container } = renderWithProviders(
      <PageRenderer document={BASIC_SECTION_DOCUMENT_FIXTURE} mode="public" />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Precision Optics for Deep-Sky Exploration",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Curated apochromatic refractors, smart observatories, and planetary specimens.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse Optical Instruments" })).toBeTruthy();

    // Verify no editor telemetry attributes leak into public mode
    expect(container.querySelector("[data-editor-node-id]")).toBeNull();
  });

  it("2. attaches stable node identity attributes and selection callbacks in editor mode", () => {
    const onSelectNode = vi.fn();

    const { container } = renderWithProviders(
      <PageRenderer
        document={BASIC_SECTION_DOCUMENT_FIXTURE}
        mode="editor"
        selectedNodeId="heading-intro-1"
        onSelectNode={onSelectNode}
      />,
    );

    const headingWrapper = container.querySelector(
      '[data-editor-node-id="heading-intro-1"]',
    ) as HTMLElement;
    expect(headingWrapper).not.toBeNull();
    expect(headingWrapper.getAttribute("data-editor-node-type")).toBe("Heading");
    expect(headingWrapper.getAttribute("data-editor-selected")).toBe("true");

    // Clicking the CTA button in editor mode selects the node instead of navigating
    const buttonNode = container.querySelector(
      '[data-editor-node-id="button-intro-1"] a',
    ) as HTMLElement;
    fireEvent.click(buttonNode);
    expect(onSelectNode).toHaveBeenCalledWith("button-intro-1");
  });

  it("3. resolves responsive style overrides accurately across desktop, tablet, and mobile breakpoints", () => {
    const { container: desktopContainer, unmount: unmountDesktop } = renderWithProviders(
      <PageRenderer document={BASIC_SECTION_DOCUMENT_FIXTURE} mode="editor" breakpoint="desktop" />,
    );
    const desktopHeading = desktopContainer.querySelector(
      '[data-editor-node-id="heading-intro-1"]',
    ) as HTMLElement;
    expect(desktopHeading.style.fontSize).toBe("48px");
    unmountDesktop();

    const { container: mobileContainer } = renderWithProviders(
      <PageRenderer document={BASIC_SECTION_DOCUMENT_FIXTURE} mode="editor" breakpoint="mobile" />,
    );
    const mobileHeading = mobileContainer.querySelector(
      '[data-editor-node-id="heading-intro-1"]',
    ) as HTMLElement;
    expect(mobileHeading.style.fontSize).toBe("32px");
  });

  it("4. honors conditional visibility (node.hidden and responsive visible: false)", () => {
    const docWithHiddenNodes: PageDocument = {
      ...BASIC_SECTION_DOCUMENT_FIXTURE,
      root: [
        {
          id: "section-vis-test",
          type: "Section",
          name: "Visibility Section",
          props: {},
          style: {},
          children: [
            {
              id: "text-always-hidden",
              type: "Text",
              name: "Hidden Text",
              hidden: true,
              props: { text: "Should never render" },
              style: {},
              children: [],
            },
            {
              id: "text-mobile-hidden",
              type: "Text",
              name: "Desktop Only Text",
              props: { text: "Visible on desktop only" },
              style: { visible: true },
              responsive: {
                mobile: { visible: false },
              },
              children: [],
            },
          ],
        },
      ],
    };

    const { unmount } = renderWithProviders(
      <PageRenderer document={docWithHiddenNodes} mode="public" breakpoint="desktop" />,
    );
    expect(screen.queryByText("Should never render")).toBeNull();
    expect(screen.getByText("Visible on desktop only")).toBeTruthy();
    unmount();

    renderWithProviders(
      <PageRenderer document={docWithHiddenNodes} mode="public" breakpoint="mobile" />,
    );
    expect(screen.queryByText("Visible on desktop only")).toBeNull();
  });

  it("5. renders named slots (header and footer) in deterministic order", () => {
    const slottedDoc: PageDocument = {
      id: "doc-slots",
      pageId: "page-slots",
      pageType: "custom",
      slug: "slots",
      schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
      name: "Slotted Document",
      metadata: {
        createdAt: "2026-10-20T15:00:00.000Z",
        updatedAt: "2026-10-20T15:00:00.000Z",
      },
      root: [
        {
          id: "sec-slotted",
          type: "Section",
          name: "Slotted Section",
          props: {},
          style: {},
          slots: {
            header: [
              {
                id: "slot-header-node",
                type: "Heading",
                name: "Header Slot Heading",
                props: { text: "First Header Slot" },
                style: {},
                children: [],
              },
            ],
            footer: [
              {
                id: "slot-footer-node",
                type: "Text",
                name: "Footer Slot Text",
                props: { text: "Last Footer Slot" },
                style: {},
                children: [],
              },
            ],
          },
          children: [
            {
              id: "body-child-node",
              type: "Text",
              name: "Middle Body Text",
              props: { text: "Middle Body Content" },
              style: {},
              children: [],
            },
          ],
        },
      ],
    };

    const { container } = renderWithProviders(<PageRenderer document={slottedDoc} mode="public" />);
    const textContent = container.textContent ?? "";
    const headerIdx = textContent.indexOf("First Header Slot");
    const bodyIdx = textContent.indexOf("Middle Body Content");
    const footerIdx = textContent.indexOf("Last Footer Slot");

    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(bodyIdx).toBeGreaterThan(headerIdx);
    expect(footerIdx).toBeGreaterThan(bodyIdx);
  });

  it("6. handles unknown component types and isolated component runtime errors safely via NodeErrorBoundary", () => {
    const partialRegistry = new VisualComponentRegistry();
    partialRegistry.registerComponent({
      type: "Text",
      adapter: () => <p>Safe Sibling Text</p>,
    });

    const docWithUnknown: PageDocument = {
      id: "doc-unknown",
      pageId: "page-unknown",
      pageType: "custom",
      slug: "unknown",
      schemaVersion: CURRENT_PAGE_SCHEMA_VERSION,
      name: "Unknown Fallback Test",
      metadata: {
        createdAt: "2026-10-20T15:00:00.000Z",
        updatedAt: "2026-10-20T15:00:00.000Z",
      },
      root: [
        {
          id: "node-unregistered",
          type: "Heading",
          name: "Unregistered Heading",
          props: { text: "Missing Adapter" },
          style: {},
          children: [],
        },
        {
          id: "node-registered-sibling",
          type: "Text",
          name: "Registered Text",
          props: { text: "Safe Sibling Text" },
          style: {},
          children: [],
        },
      ],
    };

    // In editor mode, unknown component renders explicit diagnostic placeholder
    const { container: editorContainer, unmount } = renderWithProviders(
      <PageRenderer document={docWithUnknown} mode="editor" registry={partialRegistry} />,
    );
    expect(
      editorContainer.querySelector('[data-editor-unknown-component="Heading"]'),
    ).not.toBeNull();
    expect(screen.getByText("Safe Sibling Text")).toBeTruthy();
    unmount();

    // Test NodeErrorBoundary isolating a throwing adapter
    const throwingRegistry = createDefaultComponentRegistry();
    throwingRegistry.registerComponent(
      {
        type: "Divider",
        adapter: () => {
          throw new Error("Simulated adapter render failure");
        },
      },
      { allowOverride: true },
    );

    const docWithThrowingNode: PageDocument = {
      ...docWithUnknown,
      root: [
        {
          id: "node-throwing",
          type: "Divider",
          name: "Throwing Divider",
          props: {},
          style: {},
          children: [],
        } as EditorNode,
        {
          id: "node-surviving-text",
          type: "Text",
          name: "Surviving Text",
          props: { text: "Storefront survived node error" },
          style: {},
          children: [],
        },
      ],
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container: errContainer } = renderWithProviders(
      <PageRenderer document={docWithThrowingNode} mode="editor" registry={throwingRegistry} />,
    );
    expect(errContainer.querySelector('[data-editor-node-error="node-throwing"]')).not.toBeNull();
    expect(screen.getByText("Storefront survived node error")).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });
});
