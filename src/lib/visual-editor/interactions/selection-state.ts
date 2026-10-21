import type { EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import type { StudioPointerInteractionMode } from "./interaction-modes";

export type StudioSelectionSource =
  | "initial"
  | "canvas_click"
  | "layer_tree"
  | "keyboard"
  | "breadcrumb"
  | "mode_restore"
  | "programmatic";

export interface SelectionBreadcrumbEntry {
  readonly id: string;
  readonly label: string;
  readonly componentType: string;
  readonly isRuntimeInstance: boolean;
  readonly isGlobalChrome: boolean;
  readonly locked: boolean;
}

export interface StudioSelectionControllerState {
  readonly selectedNodeId: string | null;
  readonly hoveredNodeId: string | null;
  readonly previousSelectedNodeId: string | null;
  readonly selectionSource: StudioSelectionSource;
  readonly interactionMode: StudioPointerInteractionMode;
}

/**
 * O(1) lookup index cached per `PageDocument` reference via `WeakMap`
 * (Prompt 10, Part 19, Section 55 & Part 20, Section 58).
 * Eliminates full-tree traversals during pointer movement, hover updates, and selection changes
 * even on 1,000+ node documents.
 */
export interface DocumentNodeLookupIndex {
  readonly nodeById: ReadonlyMap<string, EditorNode>;
  readonly parentIdById: ReadonlyMap<string, string | null>;
  readonly ancestorIdsById: ReadonlyMap<string, readonly string[]>;
  readonly childIdsById: ReadonlyMap<string, readonly string[]>;
  readonly depthById: ReadonlyMap<string, number>;
  readonly indexInParentById: ReadonlyMap<string, number>;
  readonly slotKeyById: ReadonlyMap<string, string | undefined>;
  readonly rootIds: readonly string[];
}

const documentLookupCache = new WeakMap<PageDocument, DocumentNodeLookupIndex>();

export function getDocumentNodeLookupIndex(document: PageDocument): DocumentNodeLookupIndex {
  const cached = documentLookupCache.get(document);
  if (cached) return cached;

  const nodeById = new Map<string, EditorNode>();
  const parentIdById = new Map<string, string | null>();
  const ancestorIdsById = new Map<string, readonly string[]>();
  const childIdsById = new Map<string, readonly string[]>();
  const depthById = new Map<string, number>();
  const indexInParentById = new Map<string, number>();
  const slotKeyById = new Map<string, string | undefined>();
  const rootIds: string[] = [];

  const visit = (
    node: EditorNode,
    parentId: string | null,
    ancestors: readonly string[],
    depth: number,
    indexInParent: number,
    slotKey?: string,
  ) => {
    nodeById.set(node.id, node);
    parentIdById.set(node.id, parentId);
    ancestorIdsById.set(node.id, ancestors);
    depthById.set(node.id, depth);
    indexInParentById.set(node.id, indexInParent);
    slotKeyById.set(node.id, slotKey);

    const directChildIds: string[] = [];
    const nextAncestors = [...ancestors, node.id];

    if (node.slots) {
      for (const [sKey, slotNodes] of Object.entries(node.slots)) {
        for (let i = 0; i < slotNodes.length; i += 1) {
          const slotChild = slotNodes[i];
          directChildIds.push(slotChild.id);
          visit(slotChild, node.id, nextAncestors, depth + 1, i, sKey);
        }
      }
    }

    for (let i = 0; i < node.children.length; i += 1) {
      const child = node.children[i];
      directChildIds.push(child.id);
      visit(child, node.id, nextAncestors, depth + 1, i, undefined);
    }

    childIdsById.set(node.id, directChildIds);
  };

  for (let i = 0; i < document.root.length; i += 1) {
    const rootNode = document.root[i];
    rootIds.push(rootNode.id);
    visit(rootNode, null, [], 1, i, undefined);
  }

  const index: DocumentNodeLookupIndex = {
    nodeById,
    parentIdById,
    ancestorIdsById,
    childIdsById,
    depthById,
    indexInParentById,
    slotKeyById,
    rootIds,
  };

  documentLookupCache.set(document, index);
  return index;
}
