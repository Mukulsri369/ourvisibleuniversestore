import type { EditorNode } from "../schema/nodes";
import type { PageDocument } from "../schema/page-document";
import type { EditingTransaction, HistoryStackLimits } from "./history-types";

export const DEFAULT_HISTORY_LIMITS: HistoryStackLimits = {
  maxTransactions: 100,
  maxEstimatedRetainedNodes: 50_000,
  coalescingWindowMs: 800,
};

function collectNodeReferences(nodes: readonly EditorNode[], into: Set<EditorNode>): void {
  const stack: EditorNode[] = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || into.has(current)) continue;
    into.add(current);

    for (let i = current.children.length - 1; i >= 0; i -= 1) {
      stack.push(current.children[i]);
    }

    if (current.slots) {
      for (const slotList of Object.values(current.slots)) {
        for (let i = slotList.length - 1; i >= 0; i -= 1) {
          stack.push(slotList[i]);
        }
      }
    }
  }
}

/**
 * Computes the number of newly allocated `EditorNode` object references between
 * `previousDocument` and `nextDocument`.
 *
 * Because all PageDocument mutations use structural sharing (`updateNodeById`, `reorderChildNodes`,
 * `insertChildNode`, `removeNodeById`), unaffected subtrees share identical `===` references.
 * A single property update on a 1,000-node document allocates only `O(depth)` (~1–4) nodes.
 */
export function estimateTransactionNodeAllocations(
  previousDocument: PageDocument,
  nextDocument: PageDocument,
): number {
  if (previousDocument === nextDocument || previousDocument.root === nextDocument.root) {
    return 1;
  }

  const previousRefs = new Set<EditorNode>();
  collectNodeReferences(previousDocument.root, previousRefs);

  const nextRefs = new Set<EditorNode>();
  collectNodeReferences(nextDocument.root, nextRefs);

  let allocatedCount = 0;
  for (const node of nextRefs) {
    if (!previousRefs.has(node)) {
      allocatedCount += 1;
    }
  }

  return Math.max(1, allocatedCount);
}

/**
 * Sums the estimated retained node allocations across a stack of transactions.
 */
export function calculateStackRetainedNodes(stack: readonly EditingTransaction[]): number {
  let total = 0;
  for (const tx of stack) {
    total += tx.estimatedAllocatedNodes;
  }
  return total;
}

/**
 * Enforces configured transaction count and memory-budget limits on the Undo stack
 * (Prompt 13, Part 7, Section 20).
 *
 * Prunes the oldest transactions from the front of the stack while preserving at least
 * one transaction when `maxTransactions >= 1`.
 */
export function pruneHistoryStackToLimits(
  undoStack: readonly EditingTransaction[],
  limits: HistoryStackLimits = DEFAULT_HISTORY_LIMITS,
): {
  readonly prunedStack: readonly EditingTransaction[];
  readonly estimatedRetainedNodes: number;
} {
  const maxTx = Math.max(1, limits.maxTransactions);
  const maxNodes = Math.max(10, limits.maxEstimatedRetainedNodes);

  let startIndex = Math.max(0, undoStack.length - maxTx);
  let totalNodes = 0;
  for (let i = startIndex; i < undoStack.length; i += 1) {
    totalNodes += undoStack[i].estimatedAllocatedNodes;
  }

  while (totalNodes > maxNodes && startIndex < undoStack.length - 1) {
    totalNodes -= undoStack[startIndex].estimatedAllocatedNodes;
    startIndex += 1;
  }

  if (startIndex === 0) {
    return {
      prunedStack: undoStack,
      estimatedRetainedNodes: totalNodes,
    };
  }

  return {
    prunedStack: undoStack.slice(startIndex),
    estimatedRetainedNodes: totalNodes,
  };
}
