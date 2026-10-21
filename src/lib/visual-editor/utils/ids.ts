import type { ComponentType, EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";

const NODE_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function isValidNodeId(id: string): boolean {
  return typeof id === "string" && id.length >= 1 && id.length <= 128 && NODE_ID_REGEX.test(id);
}

export function createDeterministicNodeId(
  componentType: ComponentType,
  sequenceNumber: number,
  prefix = "node",
): string {
  const normalizedType = componentType.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "node";
  return `${safePrefix}-${normalizedType}-${Math.max(0, Math.floor(sequenceNumber))}`;
}

export function generateUniqueNodeId(
  componentType: ComponentType,
  existingIds: ReadonlySet<string>,
  seedHint = 1,
): string {
  let counter = Math.max(1, seedHint);
  let candidate = createDeterministicNodeId(componentType, counter);
  while (existingIds.has(candidate)) {
    counter += 1;
    candidate = createDeterministicNodeId(componentType, counter);
  }
  return candidate;
}

export function collectAllNodeIds(nodes: readonly EditorNode[]): string[] {
  const result: string[] = [];

  const visit = (node: EditorNode) => {
    result.push(node.id);
    for (let i = 0; i < node.children.length; i += 1) {
      visit(node.children[i]);
    }
    if (node.slots) {
      for (const slotList of Object.values(node.slots)) {
        for (let i = 0; i < slotList.length; i += 1) {
          visit(slotList[i]);
        }
      }
    }
  };

  for (let i = 0; i < nodes.length; i += 1) {
    visit(nodes[i]);
  }

  return result;
}

export function findDuplicateNodeIds(doc: Pick<PageDocument, "root">): string[] {
  const allIds = collectAllNodeIds(doc.root);
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of allIds) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  return Array.from(duplicates);
}
