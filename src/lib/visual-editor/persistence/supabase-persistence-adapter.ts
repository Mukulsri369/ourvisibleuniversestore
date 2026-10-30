/** Compatibility import path; persistence no longer uses a Supabase client. */
export {
  defaultPersistenceAdapter,
  independentPersistenceAdapter,
} from "./independent-persistence-adapter";
export { InMemoryTransactionalPersistenceAdapter } from "./in-memory-persistence-adapter";
