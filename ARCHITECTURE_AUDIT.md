# Architecture Audit & Design Ledger — Visual Storefront Editor

- **Project:** Our Visible Universe Store (`Mukulsri369/ourvisibleuniversestore`)
- **Active Branch:** `feature/visual-storefront-editor`
- **Previous Remote Commit (`origin/main`):** `28d80db39d13150eb69ae34405ba3c06e0792acc`
- **Current Stage:** Phase 3 — Prompt 11 of 48 (`Advanced Layer Management, Component Hierarchy, Structural Editing, Safe Reordering, Duplication, Visibility & Locking`)

---

## 1. Persistence Entity-Relationship Architecture (`0010_storefront_page_persistence.sql`)

```text
+-----------------------------------------------------------------------+
|                           public.store_pages                          |
|-----------------------------------------------------------------------|
| PK  id: uuid                                                          |
| UQ  (store_scope, page_key)   -- e.g. ('default', 'home')             |
| UQ  (store_scope, slug)       -- e.g. ('default', '/')                |
|     page_type: 'home' | 'category' | 'collection' | 'landing' | ...   |
| FK  (published_version_id, id) -> store_page_versions(id, page_id)    |
|     published_revision: int >= 0                                      |
|     published_at: timestamptz                                         |
+-----------------------------------------------------------------------+
         | 1                                     | 1
         | (1:1 active draft)                    | (1:N immutable snapshots)
         v 0..1                                  v 0..*
+----------------------------------+   +---------------------------------------+
|     public.store_page_drafts     |   |      public.store_page_versions       |
|----------------------------------|   |---------------------------------------|
| PK  id: uuid                     |   | PK  id: uuid                          |
| UQ  page_id -> store_pages(id)   |   | FK  page_id -> store_pages(id)        |
|     store_scope: 'default'       |   | UQ  (page_id, version_number)         |
|     schema_version: text         |   | UQ  (id, page_id)                     |
|     draft_document: jsonb        |   |     schema_version: text              |
|     draft_revision: int >= 1     |   |     document_snapshot: jsonb          |
| FK  (base_published_version_id,  |   |     checksum: text                    |
|      page_id) -> versions        |   |     source_draft_revision: int        |
|     base_published_revision: int |   | FK  restored_from_version_id          |
|     state: 'active' | 'archived' |   |     release_notes: text               |
|     checksum: text               |   |     created_by: text                  |
+----------------------------------+   +---------------------------------------+
                                                         |
                                                         | (1:N audit trail)
                                                         v
                                       +---------------------------------------+
                                       | public.store_page_publishing_events   |
                                       |---------------------------------------|
                                       | PK  id: uuid                          |
                                       | FK  page_id -> store_pages(id)        |
                                       |     action_type: 'publish'|'rollback' |
                                       | FK  (published_version_id, page_id)   |
                                       | FK  (previous_version_id, page_id)    |
                                       |     published_revision: int >= 1      |
                                       |     actor_id: uuid                    |
                                       +---------------------------------------+
```

---

## 2. Row Level Security (RLS), Public Read Isolation & Trust Boundaries

1. **Zero Public Access to Base Tables:**
   - `REVOKE ALL ON public.store_pages, public.store_page_drafts, public.store_page_versions, public.store_page_publishing_events FROM PUBLIC, anon;`
   - Anonymous visitors (`anon`) cannot `SELECT` from `store_page_drafts` or `store_page_versions`.
   - Authenticated non-admin users are blocked by `USING (public.is_admin() AND store_scope = 'default')` RLS policies on all four tables.
2. **Narrow Public Read Function (`public.get_published_store_page`):**
   - `SECURITY DEFINER SET search_path = public` function executable by `anon` and `authenticated`.
   - Joins `store_pages` with `store_page_versions` exclusively on `v.id = p.published_version_id AND v.page_id = p.id`.

---

## 3. Precision Selection, DOM Hit-Testing & Geometry Architecture (Prompt 10)

- **Ephemeral Selection State vs. Persistent `PageDocument` State:** Selection and hover (`StudioSelectionControllerState`) never mutate `PageDocument` or mark drafts dirty.
- **`WeakMap`-Cached `O(1)` Document Index (`selection-controller.ts`):** `getDocumentNodeLookupIndex(document)` indexes `nodeById`, `parentIdById`, `childrenIdsById`, and `depthById` once per immutable `PageDocument` reference.
- **Deterministic Runtime Instance Identities (`runtime-node-identity.ts`):** Dynamic categories (`::category::`), product cards (`::product::`), and category cards (`::category-card::`) emit `data-editor-instance-id` only in `"editor"` mode (`0` attributes in `"public"` mode).

---

## 4. Structural Layer Engine, Hierarchy Rules & Lock Inheritance (Prompt 11)

### 4.1 Centralized Structural Command Boundary (`src/lib/visual-editor/structure/*`)
- Every structural operation flows through `executeStructuralCommand(document, command, currentSelectedNodeId)` (`structural-commands.ts`), which returns a strongly typed `StructuralOperationResult` (`ok`, `code`, `document`, `selectedNodeId`, `expandLayerIds`, `undoSnapshot`, `message`).
- Supported commands: `RenameNode`, `ReorderNode`, `MoveNode`, `DuplicateNode`, `SetVisibility`, `SetLock`, `RemoveNode`, `WrapNodeInContainer`, `UnwrapContainer`, and `CreateContainer`.
- All transformations reuse structural-sharing tree utilities (`updateNodeById`, `reorderChildNodes`, `insertChildNode`, `removeNodeById`, `cloneSubtreeWithFreshIds` in `src/lib/visual-editor/utils/node-tree.ts`), keeping untouched sibling subtrees referentially identical (`===`).

### 4.2 Pinned Root Sections & Parent/Slot Compatibility (`structural-validation.ts`, `move-node.ts`)
- **Pinned Root Boundary:** `CelestialScrollWorld` (`index 0`, fixed viewport background canvas) and `PlanetHero` (`index 1`, interactive hero section) are pinned at the top of `document.root`. Sibling reordering and cross-parent moves cannot displace indices `0` or `1`, nor nest root-only sections inside child containers.
- **Parent-Child & Slot Validation (`validateParentChildCompatibility`):** Consults `VisualComponentRegistry` (`isContainer`, `isLeaf`, `isRootOnly`, `allowedParents`, `allowedChildren`, and `slots` definitions with `allowedTypes` and `maxItems`), enforces `MAX_DOCUMENT_DEPTH` (`12`) and `MAX_DOCUMENT_NODES` (`500`), and blocks circular ancestor-into-descendant moves (`CIRCULAR_MOVE`).

### 4.3 Subtree Duplication Identity & Business Data Protection (`duplicate-node.ts`)
- `duplicateNode` uses `cloneSubtreeWithFreshIds` to assign deterministic, collision-free IDs to the cloned root and all nested descendants (`children` and `slots`), appends `" (Copy)"` to the cloned root's display name, inserts the clone at `indexInParent + 1`, and selects the clone.
- **Singleton & Dynamic Template Protection:** Global chrome (`StoreHeader`, `StoreFooter`), `CelestialScrollWorld`, `PlanetHero`, and repeated `dynamic_categories` template sections (`binding.kind === "dynamic_categories"`) cannot be duplicated. Duplicating visual nodes never creates or mutates product, category, price, or affiliate URL database records.

### 4.4 Direct & Ancestor Lock Inheritance (`locking.ts`, `studio-document.ts`)
- `isNodeEffectivelyLocked(document, nodeId)` checks both `node.locked === true` (`direct: true`) and any ancestor with `ancestor.locked === true` (`lockedAncestor`) in $O(\text{depth})$ time via the `WeakMap` index without writing redundant `locked` booleans onto descendants.
- Both `executeStructuralCommand` and all Inspector mutation helpers (`updateStudioNodeName`, `updateStudioNodeVisibility`, `updateStudioNodeProp`, `updateStudioNodeSpacing`, `updateStudioNodeAppearance`) reject modifications when `isNodeEffectivelyLocked(document, targetId).locked` is true.

### 4.5 Global vs. Responsive Visibility & Safe Deletion (`visibility.ts`, `structural-commands.ts`)
- **Global vs. Breakpoint Visibility:** Global hide sets `node.hidden = true`; responsive hide sets `node.responsive[breakpoint].visible = false` without conflating the two. Hidden nodes remain selectable and manageable in the Layers panel with a hidden badge.
- **Safe Deletion & Immediate Recovery:** `describeDeletionImpact` classifies the target (`page section`, `container with N nested elements`, or `design element`) for `LayerDeleteConfirmDialog`. `removeLayerNode` selects the nearest surviving sibling or parent and returns an `undoSnapshot` (`previousDocument`, `previousSelectedNodeId`) so administrators can immediately restore removed subtrees via the Layer Panel Undo banner.
