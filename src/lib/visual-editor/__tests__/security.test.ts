import { describe, expect, it } from "vitest";
import {
  BASIC_SECTION_DOCUMENT_FIXTURE,
  MAX_DOCUMENT_DEPTH,
  MAX_DOCUMENT_NODES,
  safeParsePageDocument,
  validateSerializedPageDocument,
  type EditorNode,
} from "../index";

describe("Schema Security, Nesting Boundaries & Malicious Payload Rejection", () => {
  it("rejects duplicate node IDs anywhere in the document tree", () => {
    const dupDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    dupDoc.root[0].children[0].children[1].id = "heading-intro-1"; // collides with sibling

    const res = safeParsePageDocument(dupDoc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.issues.some((i) => i.code === "DUPLICATE_NODE_ID")).toBe(true);
    }
  });

  it("rejects invalid parent-child nesting (e.g., children inside a leaf ProductCard or StoreHeader inside a Container)", () => {
    const leafViolationDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    const headingNode = leafViolationDoc.root[0].children[0].children[0];
    headingNode.children = [
      {
        id: "illegal-nested-text",
        type: "Text",
        name: "Illegal Nested Text",
        props: { text: "Should fail" },
        style: {},
        children: [],
      },
    ];

    const res1 = safeParsePageDocument(leafViolationDoc);
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(
        res1.issues.some(
          (i) => i.code === "INVALID_PARENT_CHILD_NESTING" || i.code === "LEAF_NODE_HAS_CHILDREN",
        ),
      ).toBe(true);
    }

    const rootOnlyViolationDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    rootOnlyViolationDoc.root[0].children.push({
      id: "nested-header-illegal",
      type: "StoreHeader",
      name: "Illegal Nested Header",
      props: {},
      style: {},
      children: [],
    });

    const res2 = safeParsePageDocument(rootOnlyViolationDoc);
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.issues.some((i) => i.code === "INVALID_PARENT_CHILD_NESTING")).toBe(true);
    }
  });

  it("rejects javascript: URLs, data: URLs, script tags, CSS injection, and inline event handlers", () => {
    const xssHrefDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    xssHrefDoc.root[0].children[0].children[3].props.href = "javascript:alert(document.cookie)";
    expect(safeParsePageDocument(xssHrefDoc).success).toBe(false);

    const xssMediaDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    xssMediaDoc.root[0].children[0].children[2].media = {
      primary: {
        mediaType: "image",
        url: "data:text/html,<script>alert(1)</script>",
        altText: "Bad media",
      },
    };
    expect(safeParsePageDocument(xssMediaDoc).success).toBe(false);

    const cssInjectionDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    cssInjectionDoc.root[0].style.appearance = {
      backgroundColor: "red; background-image: url(javascript:alert(1))",
    };
    expect(safeParsePageDocument(cssInjectionDoc).success).toBe(false);

    const eventHandlerAttrDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    eventHandlerAttrDoc.root[0].props.customAttributes = {
      onClick: "alert(1)",
    };
    const eventRes = safeParsePageDocument(eventHandlerAttrDoc);
    expect(eventRes.success).toBe(false);
    if (!eventRes.success) {
      expect(eventRes.issues.some((i) => i.code === "UNSAFE_EVENT_HANDLER_ATTRIBUTE")).toBe(true);
    }
  });

  it("rejects attempts to embed protected business data (affiliate_url, amazon_url, price) inside presentation props", () => {
    const businessLeakDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    businessLeakDoc.root[0].props.customAttributes = {
      affiliate_url: "https://evil.example.com/hijack",
      price: 1,
    };

    const res = safeParsePageDocument(businessLeakDoc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.issues.some((i) => i.code === "FORBIDDEN_BUSINESS_DATA_OVERRIDE")).toBe(true);
    }
  });

  it("rejects circular references, executable functions, excessive nesting depth, and oversized documents", () => {
    // 1. Executable function
    const fnDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE) as unknown as Record<
      string,
      unknown
    >;
    fnDoc.maliciousCallback = () => {};
    const fnRes = safeParsePageDocument(fnDoc);
    expect(fnRes.success).toBe(false);
    if (!fnRes.success) {
      expect(fnRes.issues[0].code).toBe("UNSAFE_EXECUTABLE_VALUE");
    }

    // 2. Circular reference
    const circularDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    const rootNode = circularDoc.root[0];
    rootNode.children.push(rootNode);
    const circularRes = safeParsePageDocument(circularDoc);
    expect(circularRes.success).toBe(false);
    if (!circularRes.success) {
      expect(circularRes.issues[0].code).toBe("CIRCULAR_REFERENCE");
    }

    // 3. Excessive nesting depth (> MAX_DOCUMENT_DEPTH = 12)
    const deepDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    let cursor: EditorNode = {
      id: "depth-node-1",
      type: "Container",
      name: "Depth 1",
      props: {},
      style: {},
      children: [],
    };
    deepDoc.root = [cursor];
    for (let d = 2; d <= MAX_DOCUMENT_DEPTH + 2; d += 1) {
      const next: EditorNode = {
        id: `depth-node-${d}`,
        type: "Container",
        name: `Depth ${d}`,
        props: {},
        style: {},
        children: [],
      };
      cursor.children.push(next);
      cursor = next;
    }
    const deepRes = safeParsePageDocument(deepDoc);
    expect(deepRes.success).toBe(false);
    if (!deepRes.success) {
      expect(deepRes.issues.some((i) => i.code === "MAX_DEPTH_EXCEEDED")).toBe(true);
    }

    // 4. Excessive node count (> MAX_DOCUMENT_NODES = 1500)
    const tooManyRootDoc = structuredClone(BASIC_SECTION_DOCUMENT_FIXTURE);
    tooManyRootDoc.root = Array.from({ length: MAX_DOCUMENT_NODES + 5 }, (_, i) => ({
      id: `spam-node-${i}`,
      type: "Section" as const,
      name: `Section ${i}`,
      props: {},
      style: {},
      children: [],
    }));
    expect(safeParsePageDocument(tooManyRootDoc).success).toBe(false);

    // 5. Oversized JSON payload (> 1 MiB)
    const hugeString = "x".repeat(1_100_000);
    const byteRes = validateSerializedPageDocument(hugeString);
    expect(byteRes.success).toBe(false);
    if (!byteRes.success) {
      expect(byteRes.issues[0].code).toBe("MAX_BYTES_EXCEEDED");
    }
  });
});
