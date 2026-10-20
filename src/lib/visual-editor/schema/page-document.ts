import { z } from "zod";
import { EditorNodeSchema, NodeIdSchema, type EditorNode } from "./nodes";

export const CURRENT_PAGE_SCHEMA_VERSION = "1.0.0" as const;
export const SUPPORTED_PAGE_SCHEMA_VERSIONS = ["1.0.0"] as const;

export type PageSchemaVersion = (typeof SUPPORTED_PAGE_SCHEMA_VERSIONS)[number];

export const MAX_DOCUMENT_DEPTH = 12;
export const MAX_DOCUMENT_NODES = 1500;
export const MAX_SERIALIZED_DOCUMENT_BYTES = 1_048_576; // 1 MiB

export const PAGE_TYPES = ["home", "category", "collection", "landing", "custom"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export interface PageDocumentMetadata {
  createdAt: string;
  updatedAt: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  authorEmail?: string;
  baseRevision?: number;
}

export const PageDocumentMetadataSchema: z.ZodType<PageDocumentMetadata> = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    description: z.string().max(1000).optional(),
    seoTitle: z.string().max(160).optional(),
    seoDescription: z.string().max(320).optional(),
    authorEmail: z.string().email().max(254).optional(),
    baseRevision: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();

export interface PageGlobalSettings {
  celestialWorldEnabled?: boolean;
  preserveCategoryOrder?: boolean;
  preserveFestivalOrder?: boolean;
  containerMaxWidthPx?: number;
}

export const PageGlobalSettingsSchema: z.ZodType<PageGlobalSettings> = z
  .object({
    celestialWorldEnabled: z.boolean().optional(),
    preserveCategoryOrder: z.boolean().optional(),
    preserveFestivalOrder: z.boolean().optional(),
    containerMaxWidthPx: z.number().int().min(320).max(3840).optional(),
  })
  .strict();

export interface PageDocument {
  id: string;
  pageId: string;
  pageType: PageType;
  slug: string;
  schemaVersion: PageSchemaVersion;
  storeId?: string;
  name: string;
  metadata: PageDocumentMetadata;
  settings?: PageGlobalSettings;
  root: EditorNode[];
}

export const PageSlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^(\/|[a-z0-9][a-z0-9/_-]*)$/, "Invalid page slug");

export const PageDocumentBaseSchema: z.ZodType<PageDocument> = z
  .object({
    id: NodeIdSchema,
    pageId: NodeIdSchema,
    pageType: z.enum(PAGE_TYPES),
    slug: PageSlugSchema,
    schemaVersion: z.enum(SUPPORTED_PAGE_SCHEMA_VERSIONS),
    storeId: NodeIdSchema.optional(),
    name: z.string().min(1).max(200),
    metadata: PageDocumentMetadataSchema,
    settings: PageGlobalSettingsSchema.optional(),
    root: z.array(EditorNodeSchema).max(MAX_DOCUMENT_NODES),
  })
  .strict();
