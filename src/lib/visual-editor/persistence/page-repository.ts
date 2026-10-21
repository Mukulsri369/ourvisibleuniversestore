import {
  DEFAULT_STORE_SCOPE,
  type PersistenceDatabaseAdapter,
  type StorePageRecord,
} from "./persistence-types";
import { mapDatabaseErrorToPersistenceError } from "./persistence-errors";
import { validateStoreScope } from "./persistence-validation";
import { defaultPersistenceAdapter } from "./supabase-persistence-adapter";

export interface PageRepositoryOptions {
  adapter?: PersistenceDatabaseAdapter;
  storeScope?: string;
}

export async function getStorePageByKey(
  pageKey: string,
  options: PageRepositoryOptions = {},
): Promise<StorePageRecord | null> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    return await adapter.getPageByKey(pageKey, storeScope);
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}

export async function getStorePageById(
  pageId: string,
  options: PageRepositoryOptions = {},
): Promise<StorePageRecord | null> {
  const adapter = options.adapter ?? defaultPersistenceAdapter;
  const storeScope = validateStoreScope(options.storeScope ?? DEFAULT_STORE_SCOPE);
  try {
    return await adapter.getPageById(pageId, storeScope);
  } catch (err) {
    throw mapDatabaseErrorToPersistenceError(err);
  }
}
