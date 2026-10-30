import {
  AutosaveCoordinator,
  type AutosaveCoordinatorConfig,
  type SaveDraftExecutor,
} from "../autosave";
import { createDefaultHomepageDocument } from "../homepage/default-homepage-document";
import type { PageDocument } from "../schema/page-document";
import { updateNodeById } from "../utils/node-tree";
import type { StudioSaveDraftOutcome } from "../studio/studio-persistence";

export const edited = (document: PageDocument, name: string) =>
  updateNodeById(document, "home-planet-hero", (node) => ({ ...node, name }));
export function saved(document: PageDocument, revision: number): StudioSaveDraftOutcome {
  return {
    ok: true,
    persistedDocument: document,
    draftRevision: revision,
    publishedRevision: 0,
    savedAt: "2026-04-20T12:00:00.000Z",
    pageRecord: null,
    draftRecord: null,
    error: null,
  };
}
/** Initialize the actual production coordinator from the same loaded-draft contract as the UI. */
export function coordinatorFixture(
  executeSave: SaveDraftExecutor,
  config: Partial<AutosaveCoordinatorConfig> = {},
  document = createDefaultHomepageDocument(),
  revision = 1,
) {
  const coordinator = new AutosaveCoordinator({ initialDocument: document, executeSave, config });
  coordinator.initializeFromLoadedDraft({
    persistedDocument: document,
    draftRevision: revision,
    publishedRevision: 0,
    isPublishedLive: false,
    lastSavedAt: null,
    pageRecord: null,
    draftRecord: null,
    error: null,
  });
  return { coordinator, document };
}
