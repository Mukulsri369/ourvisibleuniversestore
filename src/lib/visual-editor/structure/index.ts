export {
  countSubtreeDescendants,
  getLockedAncestorNode,
  getSubtreeHeight,
  isNodeEffectivelyLocked,
  isPinnedRootComponent,
  resolveLayerOperationPermissions,
  validateParentChildCompatibility,
  validateStructuralDocumentIntegrity,
  withUpdatedStructuralTimestamp,
  type CompatibleContainerDestination,
  type LayerOperationPermissions,
  type StructuralErrorCode,
  type StructuralOperationResult,
  type StructuralUndoSnapshot,
} from "./structural-validation";

export { setNodeLock } from "./locking";
export { setNodeVisibility, type SetVisibilityOptions } from "./visibility";
export {
  moveNodeToContainer,
  reorderSiblingNode,
  type MoveNodeDestinationOptions,
} from "./move-node";
export { duplicateNode } from "./duplicate-node";
export {
  createCompatibleContainer,
  unwrapContainer,
  wrapNodeInContainer,
  type GroupingContainerType,
} from "./grouping";
export {
  describeDeletionImpact,
  executeStructuralCommand,
  removeLayerNode,
  renameLayerNode,
  type DeletionImpactSummary,
  type StructuralCommand,
} from "./structural-commands";
