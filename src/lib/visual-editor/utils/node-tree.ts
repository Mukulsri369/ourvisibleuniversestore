import { LEAF_COMPONENT_TYPES, ROOT_ONLY_COMPONENT_TYPES, type EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import type { EditorBreakpoint, NodeStyleBundle } from "../schema/responsive";
import { collectAllNodeIds, generateUniqueNodeId } from "./ids";
import { setResponsiveStyleOverride } from "./responsive-resolution";

export interface NodeLookupLocation {
  node: EditorNode;
  parent: EditorNode | null;
  indexInParent: number;
  slotKey?: string;
  depth: number;
  path: string[];
}

export function traverseNodes(
  nodes: readonly EditorNode[],
  visitor: (
    node: EditorNode,
    meta: { parent: EditorNode | null; depth: number; indexInParent: number; slotKey?: string },
  ) => void | boolean,
): void {
  const walk = (
    list: readonly EditorNode[],
    parent: EditorNode | null,
    depth: number,
    slotKey?: string,
  ): boolean => {
    for (let i = 0; i < list.length; i += 1) {
      const current = list[i];
      const shouldStop = visitor(current, { parent, depth, indexInParent: i, slotKey });
      if (shouldStop === false) {
        return false;
      }
      if (current.children.length > 0) {
        if (!walk(current.children, current, depth + 1)) {
          return false;
        }
      }
      if (current.slots) {
        for (const [key, slotNodes] of Object.entries(current.slots)) {
          if (!walk(slotNodes, current, depth + 1, key)) {
            return false;
          }
        }
      }
    }
    return true;
  };

  walk(nodes, null, 1);
}

export function findNodeLocation(
  doc: Pick<PageDocument, "root">,
  nodeId: string,
): NodeLookupLocation | null {
  const search = (
    list: readonly EditorNode[],
    parent: EditorNode | null,
    depth: number,
    ancestors: string[],
    slotKey?: string,
  ): NodeLookupLocation | null => {
    for (let i = 0; i < list.length; i += 1) {
      const current = list[i];
      const currentPath = [...ancestors, current.id];
      if (current.id === nodeId) {
        return {
          node: current,
          parent,
          indexInParent: i,
          slotKey,
          depth,
          path: currentPath,
        };
      }
      if (current.children.length > 0) {
        const foundInChildren = search(current.children, current, depth + 1, currentPath);
        if (foundInChildren) return foundInChildren;
      }
      if (current.slots) {
        for (const [sKey, slotList] of Object.entries(current.slots)) {
          const foundInSlot = search(slotList, current, depth + 1, currentPath, sKey);
          if (foundInSlot) return foundInSlot;
        }
      }
    }
    return null;
  };

  return search(doc.root, null, 1, []);
}

export function findNodeById(doc: Pick<PageDocument, "root">, nodeId: string): EditorNode | null {
  return findNodeLocation(doc, nodeId)?.node ?? null;
}

export function findParentNode(doc: Pick<PageDocument, "root">, nodeId: string): EditorNode | null {
  return findNodeLocation(doc, nodeId)?.parent ?? null;
}

export function countNodes(doc: Pick<PageDocument, "root">): number {
  let count = 0;
  traverseNodes(doc.root, () => {
    count += 1;
  });
  return count;
}

export function getMaxTreeDepth(doc: Pick<PageDocument, "root">): number {
  let maxDepth = 0;
  traverseNodes(doc.root, (_node, meta) => {
    if (meta.depth > maxDepth) {
      maxDepth = meta.depth;
    }
  });
  return maxDepth;
}

/**
 * Updates a single node by ID using structural sharing:
 * - Only clones the ancestor chain along the path to `nodeId` (`O(depth)`).
 * - Unchanged sibling subtrees retain exact reference equality (`===`).
 */
export function updateNodeById(
  doc: PageDocument,
  nodeId: string,
  updater: (node: EditorNode) => EditorNode,
): PageDocument {
  let didUpdate = false;

  const updateList = (list: readonly EditorNode[]): EditorNode[] => {
    let listChanged = false;
    const nextList = list.map((item) => {
      const updatedItem = updateSingleNode(item);
      if (updatedItem !== item) {
        listChanged = true;
      }
      return updatedItem;
    });
    return listChanged ? nextList : (list as EditorNode[]);
  };

  const updateSingleNode = (node: EditorNode): EditorNode => {
    if (node.id === nodeId) {
      const nextNode = updater(node);
      if (nextNode !== node) {
        didUpdate = true;
      }
      return nextNode;
    }

    const nextChildren =
      node.children.length > 0 ? updateList(node.children) : node.children;

    let nextSlots = node.slots;
    let slotsChanged = false;
    if (node.slots) {
      const updatedSlots: Record<string, EditorNode[]> = {};
      for (const [slotKey, slotNodes] of Object.entries(node.slots)) {
        const nextSlotList = updateList(slotNodes);
        if (nextSlotList !== slotNodes) {
          slotsChanged = true;
        }
        updatedSlots[slotKey] = nextSlotList;
      }
      if (slotsChanged) {
        nextSlots = updatedSlots;
      }
    }

    if (nextChildren === node.children && !slotsChanged) {
      return node;
    }

    didUpdate = true;
    return {
      ...node,
      children: nextChildren,
      ...(nextSlots ? { slots: nextSlots } : {}),
    };
  };

  const nextRoot = updateList(doc.root);
  if (!didUpdate || nextRoot === doc.root) {
    return doc;
  }

  return {
    ...doc,
    root: nextRoot,
  };
}

export function updateNodeStyle(
  doc: PageDocument,
  nodeId: string,
  patch: NodeStyleBundle,
  breakpoint: EditorBreakpoint = "desktop",
): PageDocument {
  return updateNodeById(doc, nodeId, (node) =>
    setResponsiveStyleOverride(node, breakpoint, patch),
  );
}

export function reorderChildNodes(
  doc: PageDocument,
  parentId: string | null,
  fromIndex: number,
  toIndex: number,
): PageDocument {
  const reorderArray = (arr: readonly EditorNode[]): EditorNode[] => {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= arr.length ||
      toIndex >= arr.length ||
      fromIndex === toIndex
    ) {
      return arr as EditorNode[];
    }
    const copy = [...arr];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    return copy;
  };

  if (parentId === null) {
    const nextRoot = reorderArray(doc.root);
    return nextRoot === doc.root ? doc : { ...doc, root: nextRoot };
  }

  return updateNodeById(doc, parentId, (parent) => {
    const nextChildren = reorderArray(parent.children);
    return nextChildren === parent.children ? parent : { ...parent, children: nextChildren };
  });
}

export function insertChildNode(
  doc: PageDocument,
  parentId: string | null,
  newNode: EditorNode,
  index?: number,
): PageDocument {
  const existingIds = new Set(collectAllNodeIds(doc.root));
  if (existingIds.has(newNode.id)) {
    throw new Error(`Cannot insert node with duplicate ID "${newNode.id}"`);
  }

  if (parentId === null) {
    const nextRoot = [...doc.root];
    const targetIdx =
      index === undefined ? nextRoot.length : Math.max(0, Math.min(index, nextRoot.length));
    nextRoot.splice(targetIdx, 0, newNode);
    return { ...doc, root: nextRoot };
  }

  return updateNodeById(doc, parentId, (parent) => {
    if (LEAF_COMPONENT_TYPES.has(parent.type)) {
      throw new Error(`Cannot insert child into leaf component "${parent.type}"`);
    }
    if (ROOT_ONLY_COMPONENT_TYPES.has(newNode.type)) {
      throw new Error(`Root-only component "${newNode.type}" cannot be nested inside "${parent.type}"`);
    }
    const nextChildren = [...parent.children];
    const targetIdx =
      index === undefined ? nextChildren.length : Math.max(0, Math.min(index, nextChildren.length));
    nextChildren.splice(targetIdx, 0, newNode);
    return { ...parent, children: nextChildren };
  });
}

export function removeNodeById(doc: PageDocument, nodeId: string): PageDocument {
  const filterList = (list: readonly EditorNode[]): EditorNode[] => {
    let changed = false;
    const filtered: EditorNode[] = [];

    for (const item of list) {
      if (item.id === nodeId) {
        changed = true;
        continue;
      }
      const nextChildren = item.children.length > 0 ? filterList(item.children) : item.children;
      if (nextChildren !== item.children) {
        changed = true;
        filtered.push({ ...item, children: nextChildren });
      } else {
        filtered.push(item);
      }
    }

    return changed ? filtered : (list as EditorNode[]);
  };

  const nextRoot = filterList(doc.root);
  return nextRoot === doc.root ? doc : { ...doc, root: nextRoot };
}

export function cloneSubtreeWithFreshIds(
  rootNode: EditorNode,
  existingDocumentIds: ReadonlySet<string>,
): EditorNode {
  const usedIds = new Set<string>(existingDocumentIds);
  let counter = 1;

  const cloneRecursive = (node: EditorNode): EditorNode => {
    const freshId = generateUniqueNodeId(node.type, usedIds, counter);
    usedIds.add(freshId);
    counter += 1;

    const clonedChildren = node.children.map((child) => cloneRecursive(child));
    let clonedSlots: Record<string, EditorNode[]> | undefined;
    if (node.slots) {
      clonedSlots = {};
      for (const [sKey, sList] of Object.entries(node.slots)) {
        clonedSlots[sKey] = sList.map((child) => cloneRecursive(child));
      }
    }

    return {
      ...structuredClone({
        ...node,
        children: [],
        slots: undefined,
      }),
      id: freshId,
      name: `${node.name} (Copy)`,
      children: clonedChildren,
      ...(clonedSlots ? { slots: clonedSlots } : {}),
    };
  };

  return cloneRecursive(rootNode);
}

export function serializePageDocument(doc: PageDocument): string {
  return JSON.stringify(doc);
}
