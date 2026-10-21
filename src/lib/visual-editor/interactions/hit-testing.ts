import { defaultComponentRegistry, type VisualComponentRegistry } from "../registry/index";
import type { PageDocument } from "../schema/page-document";
import { parseStudioNodeIdentity } from "./runtime-node-identity";
import { getDocumentNodeLookupIndex } from "./selection-state";

export interface HitTestCandidate {
  readonly targetId: string;
  readonly documentNodeId: string | null;
  readonly isRuntimeInstance: boolean;
  readonly isGlobalBackground: boolean;
  readonly element: Element;
}

export interface HitTestOptions {
  readonly document: PageDocument;
  readonly stageEl: HTMLElement;
  /**
   * Currently selected ID in the studio. Used to support Figma-style container-first
   * vs. drill-down selection:
   * - Clicking inside a collection section when it is NOT selected selects the section first.
   * - Clicking a ProductCard inside that collection when the collection (or another card inside it)
   *   IS already selected (or when `drillDownModifier` is true) selects the ProductCard instance.
   */
  readonly currentSelectedId?: string | null;
  /**
   * True when the user holds Alt/Option, Cmd/Meta, or Ctrl, or double-clicks to drill directly
   * into the deepest runtime instance or cycle ancestors.
   */
  readonly drillDownModifier?: boolean;
  /**
   * Optional cycle step (`Alt+Click` on an already-selected deepest target cycles up to its parent).
   */
  readonly cycleAncestorOnRepeatClick?: boolean;
  /**
   * For hover hit-testing, whether to highlight runtime instances when already inside a selected parent.
   */
  readonly mode?: "select" | "hover";
  readonly registry?: VisualComponentRegistry;
}

export interface HitTestResult {
  readonly targetId: string | null;
  readonly primaryElement: HTMLElement | null;
  readonly candidates: readonly HitTestCandidate[];
}

function isIgnoredOverlayOrDecorativeElement(el: Element): boolean {
  if (el.getAttribute("data-testid") === "studio-selection-overlay-layer") return true;
  if (el.getAttribute("data-editor-decorative") === "true") return true;
  if (el.closest('[data-testid="studio-selection-overlay-layer"]')) return true;
  return false;
}

/**
 * Extracts ordered hit-test candidates (from deepest/most-specific to shallowest ancestor)
 * along a DOM ancestor or `composedPath()` chain up to `stageEl` (Prompt 10, Part 4, Sections 9–11).
 */
export function collectHitTestCandidatesFromElement(
  startElement: Element | null,
  stageEl: HTMLElement,
  document: PageDocument,
  registry: VisualComponentRegistry = defaultComponentRegistry,
): HitTestCandidate[] {
  if (!startElement || !stageEl.contains(startElement)) return [];
  if (isIgnoredOverlayOrDecorativeElement(startElement)) return [];

  const index = getDocumentNodeLookupIndex(document);
  const candidates: HitTestCandidate[] = [];
  const seenTargetIds = new Set<string>();

  let curr: Element | null = startElement;
  while (curr && curr !== stageEl && stageEl.contains(curr)) {
    if (!isIgnoredOverlayOrDecorativeElement(curr)) {
      // 1. Check runtime instance attribute first (more specific than enclosing section)
      const instanceId = curr.getAttribute("data-editor-instance-id");
      if (instanceId && !seenTargetIds.has(instanceId)) {
        const parsed = parseStudioNodeIdentity(instanceId);
        if (parsed && parsed.documentNodeId) {
          const parentNode = index.nodeById.get(parsed.documentNodeId);
          const cap = parentNode ? registry.getTrustedCapabilities(parentNode.type) : undefined;
          if (parentNode && !parentNode.hidden && (cap?.selectable ?? true)) {
            seenTargetIds.add(instanceId);
            candidates.push({
              targetId: instanceId,
              documentNodeId: parsed.documentNodeId,
              isRuntimeInstance: true,
              isGlobalBackground: false,
              element: curr,
            });
          }
        }
      }

      // 2. Check registered EditorNode / virtual category section / global chrome attribute
      const nodeId = curr.getAttribute("data-editor-node-id");
      if (nodeId && !seenTargetIds.has(nodeId)) {
        const parsed = parseStudioNodeIdentity(nodeId);
        if (parsed) {
          if (parsed.kind === "global_chrome" && parsed.globalChromeType) {
            const cap = registry.getTrustedCapabilities(parsed.globalChromeType);
            if (cap?.selectable ?? true) {
              seenTargetIds.add(nodeId);
              candidates.push({
                targetId: nodeId,
                documentNodeId: null,
                isRuntimeInstance: false,
                isGlobalBackground: false,
                element: curr,
              });
            }
          } else if (parsed.documentNodeId) {
            const docNode = index.nodeById.get(parsed.documentNodeId);
            const cap = docNode ? registry.getTrustedCapabilities(docNode.type) : undefined;
            if (docNode && !docNode.hidden && (cap?.selectable ?? true)) {
              const isGlobalBg =
                Boolean(cap?.isGlobalBackgroundLayer) ||
                curr.getAttribute("data-editor-global-layer") === "celestial-scroll-world";
              seenTargetIds.add(nodeId);
              candidates.push({
                targetId: nodeId,
                documentNodeId: parsed.documentNodeId,
                isRuntimeInstance: parsed.isRuntimeInstance,
                isGlobalBackground: isGlobalBg,
                element: curr,
              });
            }
          }
        }
      }
    }

    curr = curr.parentElement;
  }

  return candidates;
}

/**
 * Resolves the authoritative target ID from a DOM element or pointer target using
 * Prompt 10's hit-testing rules (Part 4, Sections 9–11 & Part 6, Section 17):
 * 1. Filters out `CelestialScrollWorld` global background layers when foreground candidates exist.
 * 2. Distinguishes registered `PageDocument` nodes from repeated `ProductCard` / `CategoryCard` runtime instances:
 *    - Registered `PageDocument` child nodes and virtual category sections are selected immediately.
 *    - Repeated `ProductCard` / `CategoryCard` runtime instances (`data-editor-instance-id`) are selected when:
 *      a) `drillDownModifier` (`Alt`/`Cmd`/`Ctrl` or double-click) is active, OR
 *      b) The user has already selected the enclosing parent collection/section (or another instance inside it),
 *         providing natural Figma/Webflow container-first -> item drill-down behavior!
 * 3. Supports `Alt+Click` cycling up the ancestor chain when clicking an already-selected target.
 */
export function resolveHitTestTarget(
  startElement: Element | null,
  options: HitTestOptions,
): HitTestResult {
  const {
    document,
    stageEl,
    currentSelectedId = null,
    drillDownModifier = false,
    cycleAncestorOnRepeatClick = false,
    registry = defaultComponentRegistry,
  } = options;

  const rawCandidates = collectHitTestCandidatesFromElement(
    startElement,
    stageEl,
    document,
    registry,
  );

  if (rawCandidates.length === 0) {
    return {
      targetId: null,
      primaryElement: null,
      candidates: [],
    };
  }

  // Never let a background CelestialScrollWorld layer block foreground selection if foreground candidates exist
  const foregroundCandidates = rawCandidates.filter((c) => !c.isGlobalBackground);
  const candidates = foregroundCandidates.length > 0 ? foregroundCandidates : rawCandidates;

  const currentIdentity = parseStudioNodeIdentity(currentSelectedId);

  // Determine whether runtime item instances (`::product::` / `::category-card::`) should be prioritized
  // over their enclosing collection container on this interaction
  const topCandidate = candidates[0];
  const topParsed = parseStudioNodeIdentity(topCandidate.targetId);

  const isTopItemInstance =
    topParsed?.kind === "virtual_product" || topParsed?.kind === "virtual_category_card";

  const isParentAlreadyActive =
    Boolean(currentIdentity && topParsed?.documentNodeId) &&
    currentIdentity?.documentNodeId === topParsed?.documentNodeId;

  const shouldSelectItemInstance = !isTopItemInstance || drillDownModifier || isParentAlreadyActive;

  const eligibleCandidates = shouldSelectItemInstance
    ? candidates
    : candidates.filter((c) => {
        const p = parseStudioNodeIdentity(c.targetId);
        return p?.kind !== "virtual_product" && p?.kind !== "virtual_category_card";
      });

  const finalList = eligibleCandidates.length > 0 ? eligibleCandidates : candidates;

  // Support Alt/Option-click cycling up to the parent when clicking the currently selected element
  if (
    cycleAncestorOnRepeatClick &&
    currentSelectedId &&
    finalList.length > 1 &&
    finalList[0].targetId === currentSelectedId
  ) {
    const parentCandidate = finalList[1];
    return {
      targetId: parentCandidate.targetId,
      primaryElement: parentCandidate.element as HTMLElement,
      candidates: finalList,
    };
  }

  const chosen = finalList[0];
  return {
    targetId: chosen.targetId,
    primaryElement: chosen.element as HTMLElement,
    candidates: finalList,
  };
}
