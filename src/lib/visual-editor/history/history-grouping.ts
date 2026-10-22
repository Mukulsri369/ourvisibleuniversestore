import { getDocumentNodeLookupIndex, parseStudioNodeIdentity } from "../interactions/index";
import type { PageDocument } from "../schema/page-document";
import type { EditorBreakpoint } from "../schema/responsive";
import type { StructuralCommand } from "../structure/index";
import type { EditingTransaction, HistoryActionType, HistoryOrigin } from "./history-types";

export const DEFAULT_COALESCING_WINDOW_MS = 800;

const DISCRETE_ACTION_TYPES = new Set<HistoryActionType>([
  "structural.reorder",
  "structural.move",
  "structural.duplicate",
  "structural.visibility",
  "structural.lock",
  "structural.remove",
  "structural.wrap",
  "structural.unwrap",
  "structural.create_container",
  "property.reset",
  "property.reset_breakpoint",
  "document.batch",
  "document.revert",
]);

export interface CoalesceKeyParams {
  readonly actionType: HistoryActionType;
  readonly targetNodeId: string;
  readonly propertyPath?: string;
  readonly breakpoint?: EditorBreakpoint;
}

/**
 * Generates a deterministic coalescing identity for continuous edits (slider drag,
 * color picker scrubbing, numeric input stepping, text input typing, or direct manipulation)
 * while returning `null` for discrete structural or reset actions so unrelated edits never merge
 * (Prompt 13, Part 6, Sections 16–18).
 */
export function buildTransactionCoalesceKey(params: CoalesceKeyParams): string | null {
  if (DISCRETE_ACTION_TYPES.has(params.actionType)) {
    return null;
  }

  const identity = parseStudioNodeIdentity(params.targetNodeId);
  const canonicalNodeId = identity?.documentNodeId ?? params.targetNodeId;
  const bp = params.breakpoint ?? "desktop";

  switch (params.actionType) {
    case "structural.rename":
      return `rename:${canonicalNodeId}`;
    case "property.content":
      return `prop:${canonicalNodeId}:${params.propertyPath ?? "content"}`;
    case "property.style":
    case "property.spacing":
    case "property.appearance":
      return `style:${canonicalNodeId}:${bp}:${params.propertyPath ?? "bundle"}`;
    case "interaction.direct_manipulation":
      return `gesture:${canonicalNodeId}:${bp}:${params.propertyPath ?? "transform"}`;
    default:
      return null;
  }
}

/**
 * Determines whether a new transaction should coalesce into the most recent committed
 * Undo transaction rather than pushing a separate history entry.
 *
 * Rules enforced (Prompt 13, Part 6, Sections 16–18):
 * 1. Both transactions must be undoable, committed, and have identical non-null `coalesceKey`s.
 * 2. Both transactions must share the same `actionType`.
 * 3. The time elapsed between `previousTx.updatedAt` and `candidate.timestamp` must be within
 *    `coalescingWindowMs`.
 * 4. Unrelated edits (different node, different property, different breakpoint, or discrete commands)
 *    have distinct keys and never coalesce even if executed at the exact same millisecond.
 */
export function shouldCoalesceTransactions(
  previousTx: EditingTransaction | undefined,
  candidate: {
    readonly coalesceKey: string | null;
    readonly actionType: HistoryActionType;
    readonly origin: HistoryOrigin;
    readonly timestamp: number;
  },
  coalescingWindowMs: number = DEFAULT_COALESCING_WINDOW_MS,
): boolean {
  if (!previousTx) return false;
  if (!previousTx.committed || !previousTx.undoable) return false;
  if (!previousTx.coalesceKey || !candidate.coalesceKey) return false;
  if (previousTx.coalesceKey !== candidate.coalesceKey) return false;
  if (previousTx.actionType !== candidate.actionType) return false;

  const elapsed = candidate.timestamp - previousTx.updatedAt;
  return elapsed >= 0 && elapsed <= coalescingWindowMs;
}

const STYLE_PATH_LABELS: Record<string, string> = {
  "geometry.width": "Width",
  "geometry.height": "Height",
  "geometry.minWidth": "Min Width",
  "geometry.maxWidth": "Max Width",
  "geometry.minHeight": "Min Height",
  "geometry.maxHeight": "Max Height",
  "geometry.aspectRatio": "Aspect Ratio",
  "geometry.padding": "Padding",
  "geometry.margin": "Margin",
  "layout.mode": "Layout Mode",
  "layout.flex": "Flex Layout",
  "layout.flex.direction": "Flex Direction",
  "layout.flex.wrap": "Flex Wrap",
  "layout.flex.justify": "Justify Content",
  "layout.flex.align": "Align Items",
  "layout.flex.columnGapPx": "Column Gap",
  "layout.flex.rowGapPx": "Row Gap",
  "layout.grid": "Grid Layout",
  "layout.grid.columns": "Grid Columns",
  "layout.grid.columnGapPx": "Grid Column Gap",
  "layout.grid.rowGapPx": "Grid Row Gap",
  flexItem: "Flex Item Sizing",
  gridItem: "Bento Grid Span",
  "appearance.backgroundColor": "Background",
  "appearance.backgroundGradient": "Gradient",
  "appearance.border": "Border",
  "appearance.shadow": "Shadow",
  "appearance.opacity": "Opacity",
  "appearance.filters": "Visual Filters",
  "appearance.typography": "Typography",
  "appearance.typography.fontFamily": "Font Family",
  "appearance.typography.fontSize": "Font Size",
  "appearance.typography.fontWeight": "Font Weight",
  "appearance.typography.lineHeight": "Line Height",
  "appearance.typography.letterSpacingEm": "Letter Spacing",
  "appearance.typography.textAlign": "Text Alignment",
  "appearance.typography.textTransform": "Text Transform",
  "appearance.typography.color": "Text Color",
  "shape.shapeType": "Shape Type",
  "shape.clipPreset": "Shape Mask",
  "shape.cornerRadius": "Corner Radius",
  "shape.imageCrop": "Media Framing",
  visible: "Visibility",
};

function formatBreakpointPrefix(breakpoint?: EditorBreakpoint): string {
  if (!breakpoint || breakpoint === "desktop") return "";
  return breakpoint === "mobile" ? "Mobile " : "Tablet ";
}

/**
 * Produces a concise human-readable description for a property or style update
 * (Prompt 13, Part 8, Section 26).
 * Examples:
 * - "Change Background"
 * - "Change Corner Radius"
 * - "Change Mobile Padding"
 * - "Reset Corner Radius"
 */
export function describeStylePathForHistory(
  path: string,
  breakpoint?: EditorBreakpoint,
  isReset: boolean = false,
): string {
  const friendlyField = STYLE_PATH_LABELS[path] ?? path.split(".").pop() ?? "Style";
  const bpPrefix = formatBreakpointPrefix(breakpoint);
  return isReset ? `Reset ${bpPrefix}${friendlyField}` : `Change ${bpPrefix}${friendlyField}`;
}

/**
 * Produces a concise human-readable description and `HistoryActionType` for a Prompt 11
 * structural command (Prompt 13, Part 18, Section 57).
 */
export function describeStructuralCommandForHistory(
  command: StructuralCommand,
  document: PageDocument,
): {
  readonly actionType: HistoryActionType;
  readonly label: string;
  readonly coalesceKey: string | null;
} {
  const resolveNodeLabel = (targetId: string | null): string => {
    if (!targetId) return "Component";
    const identity = parseStudioNodeIdentity(targetId);
    const docId = identity?.documentNodeId ?? targetId;
    const index = getDocumentNodeLookupIndex(document);
    const node = index.nodeById.get(docId);
    return node?.name || node?.type || "Component";
  };

  switch (command.type) {
    case "RenameNode":
      return {
        actionType: "structural.rename",
        label: `Rename Layer to "${command.newName.trim()}"`,
        coalesceKey: buildTransactionCoalesceKey({
          actionType: "structural.rename",
          targetNodeId: command.targetId,
        }),
      };
    case "ReorderNode": {
      const targetName = resolveNodeLabel(command.targetId);
      return {
        actionType: "structural.reorder",
        label: `Move ${targetName}`,
        coalesceKey: null,
      };
    }
    case "MoveNode": {
      const targetName = resolveNodeLabel(command.targetId);
      return {
        actionType: "structural.move",
        label: `Move ${targetName}`,
        coalesceKey: null,
      };
    }
    case "DuplicateNode": {
      const targetName = resolveNodeLabel(command.targetId);
      return {
        actionType: "structural.duplicate",
        label: `Duplicate ${targetName}`,
        coalesceKey: null,
      };
    }
    case "SetVisibility": {
      const targetName = resolveNodeLabel(command.targetId);
      const bpPrefix = formatBreakpointPrefix(command.breakpoint);
      const verb = command.visible ? "Show" : "Hide";
      return {
        actionType: "structural.visibility",
        label: `${verb} ${bpPrefix}${targetName}`,
        coalesceKey: null,
      };
    }
    case "SetLock": {
      const targetName = resolveNodeLabel(command.targetId);
      return {
        actionType: "structural.lock",
        label: `${command.locked ? "Lock" : "Unlock"} ${targetName}`,
        coalesceKey: null,
      };
    }
    case "RemoveNode": {
      const targetName = resolveNodeLabel(command.targetId);
      return {
        actionType: "structural.remove",
        label: `Delete ${targetName}`,
        coalesceKey: null,
      };
    }
    case "WrapNodeInContainer": {
      const targetName = resolveNodeLabel(command.targetId);
      return {
        actionType: "structural.wrap",
        label: `Wrap ${targetName} in ${command.containerType ?? "Container"}`,
        coalesceKey: null,
      };
    }
    case "UnwrapContainer": {
      const targetName = resolveNodeLabel(command.targetId);
      return {
        actionType: "structural.unwrap",
        label: `Unwrap ${targetName}`,
        coalesceKey: null,
      };
    }
    case "CreateContainer":
      return {
        actionType: "structural.create_container",
        label: `Add ${command.containerType ?? "Container"}`,
        coalesceKey: null,
      };
  }
}
