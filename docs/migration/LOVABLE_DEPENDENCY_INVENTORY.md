# Lovable, Supabase and PostgreSQL dependency inventory

Snapshot: `b73f3b0f666e0f97d523f59c3b122de5a4547227` (GitHub default-branch HEAD observed 2026-10-29; actual deployed production SHA remains unverified).

This is an exhaustive pattern scan of the pinned tracked text files, with targeted manual inspection of authentication, payment, storage, server entry and Store fetch paths. A match is a migration candidate, not proof that every reference runs in production. Markdown/history and binary files are retained in the separate full file inventory. No secret values are included.

| File | Categories | Lines | Required action |
|---|---|---|---|
| `drizzle.config.ts` | PostgreSQL/Drizzle; Provider environment/config | 4, 8 | Replace provider build/database setup while keeping TanStack Start |
| `drizzle/migrations/0000_migration.sql` | PostgreSQL/Drizzle; Database-side authorization; Hosted storage | 4, 7, 8, 12, 15, 16, 20, 23, 34, 35, 39, 40, 41, 42, 43, 44, 73, 76, 77, 78, 84, 85, 86, 88, 89, 90, 94, 106, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 147, 148, 152, 153, 154, 155, 162, 167, 168, 169, 170, 172, 173, 174, 175 | Translate SQL semantics and authorization; preserve original migrations |
| `drizzle/migrations/0002_protect_private_store_contact_settings.sql` | Database-side authorization | 3, 14 | Translate SQL semantics and authorization; preserve original migrations |
| `drizzle/migrations/0006_validate_retailer_affiliate_links.sql` | PostgreSQL/Drizzle | 5 | Translate SQL semantics and authorization; preserve original migrations |
| `drizzle/migrations/0007_prevent_duplicate_affiliate_publishing.sql` | PostgreSQL/Drizzle; Database-side authorization | 3, 4, 15, 32 | Translate SQL semantics and authorization; preserve original migrations |
| `drizzle/migrations/0008_multiple_product_categories.sql` | PostgreSQL/Drizzle; Database-side authorization | 4, 25 | Translate SQL semantics and authorization; preserve original migrations |
| `drizzle/migrations/0009_admin_approvals_and_management.sql` | Database-side authorization | 4, 7, 10 | Translate SQL semantics and authorization; preserve original migrations |
| `drizzle/migrations/0010_storefront_page_persistence.sql` | Database-side authorization; PostgreSQL/Drizzle | 4, 21, 22, 23, 37, 55, 74, 96, 97, 120, 145, 173, 203, 205, 206, 207, 208, 211, 215, 219, 224, 229, 233, 237, 241, 260, 262, 266, 294, 303, 318, 320, 321, 354, 355, 436, 437, 455, 457, 458, 522, 523, 589, 605, 624, 626, 627, 685, 686, 758, 774 | Translate SQL semantics and authorization; preserve original migrations |
| `drizzle/migrations/0011_product_video_uploads.sql` | Hosted storage | 2 | Translate SQL semantics and authorization; preserve original migrations |
| `package.json` | Supabase SDK/auth/database; Lovable SDK/build; PostgreSQL/Drizzle | 48, 80, 98 | Replace provider build/database setup while keeping TanStack Start |
| `scripts/migrate-taxonomy.ts` | Supabase SDK/auth/database; Provider environment/config; External hosted assets | 1, 2, 5, 6, 7, 8, 9, 10, 13, 17, 21 | Replace provider calls with authorized independent repositories/APIs |
| `src/components/admin/ProductForm.tsx` | Supabase SDK/auth/database | 26, 266, 312, 365, 523, 595, 598, 609, 610, 611, 616, 629, 635 | Replace provider calls with authorized independent repositories/APIs |
| `src/integrations/supabase/auth-attacher.ts` | Supabase SDK/auth/database | 3, 7, 9 | Replace with independent server-side authentication/data boundary |
| `src/integrations/supabase/auth-middleware.ts` | Supabase SDK/auth/database; Provider environment/config; External hosted assets | 4, 34, 36, 37, 38, 39, 40, 41, 42, 70, 72, 84, 95 | Replace with independent server-side authentication/data boundary |
| `src/integrations/supabase/client.server.ts` | Supabase SDK/auth/database; Provider environment/config | 5, 36, 37, 39, 41, 42, 49, 51, 65, 67 | Replace with independent server-side authentication/data boundary |
| `src/integrations/supabase/client.ts` | Supabase SDK/auth/database; Provider environment/config; External hosted assets | 2, 33, 34, 39, 40, 41, 42, 43, 44, 46, 48, 60, 61, 62 | Replace with independent server-side authentication/data boundary |
| `src/integrations/supabase/cron-auth.ts` | Provider environment/config | 3, 4 | Replace with independent server-side authentication/data boundary |
| `src/integrations/supabase/previewAuthStorage.ts` | External hosted assets | 63, 64, 69 | Replace with independent server-side authentication/data boundary |
| `src/lib/admin-queries.ts` | Supabase SDK/auth/database | 2, 35, 58, 83 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/admin.ts` | Supabase SDK/auth/database; Hosted storage | 1, 41, 51, 66 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/store.ts` | Supabase SDK/auth/database; Provider environment/config; External hosted assets | 1, 3, 11, 12, 20, 21, 22, 24, 25, 26 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/taxonomy-migration.ts` | Supabase SDK/auth/database | 1, 2 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/__tests__/persistence.test.ts` | Database-side authorization | 63, 64, 65, 67 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/__tests__/studio-shell.test.tsx` | Supabase SDK/auth/database | 183, 184 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/persistence/draft-repository.ts` | Supabase SDK/auth/database | 16 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/persistence/index.ts` | Supabase SDK/auth/database | 4 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/persistence/page-repository.ts` | Supabase SDK/auth/database | 8 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/persistence/published-page-reader.ts` | Supabase SDK/auth/database | 12 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/persistence/supabase-persistence-adapter.ts` | Supabase SDK/auth/database; Database-side authorization | 1, 2, 54, 89, 104, 116, 154, 236, 292, 337, 373, 446, 518 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/persistence/version-repository.ts` | Supabase SDK/auth/database | 12 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/publishing/publish-page.ts` | Supabase SDK/auth/database | 12 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/publishing/restore-version.ts` | Supabase SDK/auth/database | 12 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/recovery/recovery-policy.ts` | Database-side authorization | 17 | Replace provider calls with authorized independent repositories/APIs |
| `src/lib/visual-editor/schema/bindings.ts` | Database-side authorization | 201 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/__root.tsx` | Supabase SDK/auth/database | 13, 129 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.admin.categories.tsx` | Supabase SDK/auth/database | 29, 97, 117, 148, 252, 253, 265, 278, 293 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.admin.duplicates.tsx` | Supabase SDK/auth/database | 25, 136, 158 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.admin.festival.tsx` | Supabase SDK/auth/database | 32, 69, 82, 333 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.admin.index.tsx` | Supabase SDK/auth/database | 6, 32, 48, 49, 65, 77 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.admin.products.index.tsx` | Supabase SDK/auth/database | 18, 110, 155, 204, 264, 278, 339, 350 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.admin.products.trash.tsx` | Supabase SDK/auth/database | 18, 47, 58, 69, 73 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.admin.settings.tsx` | Supabase SDK/auth/database | 8, 9, 39, 59, 76, 100, 125, 131, 142, 177, 182, 194, 229 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/_admin.tsx` | Supabase SDK/auth/database | 24, 45, 47, 49, 69 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/admin.login.tsx` | Supabase SDK/auth/database | 6, 49, 58, 60, 67, 85, 99, 126 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/admin.reset-password.tsx` | Supabase SDK/auth/database | 6, 34 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/api/admin/check-price.ts` | Supabase SDK/auth/database; Provider environment/config | 3, 85, 186 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/api/admin/scrape-product.ts` | Provider environment/config | 87, 265 | Replace provider calls with authorized independent repositories/APIs |
| `src/routes/api/public/img.$.ts` | Supabase SDK/auth/database; Hosted storage | 18, 21, 25 | Replace provider calls with authorized independent repositories/APIs |
| `src/start.ts` | Supabase SDK/auth/database | 4, 29 | Replace provider calls with authorized independent repositories/APIs |
| `visual-regression/manifest/repository-version.json` | Supabase SDK/auth/database | 24 | Replace provider calls with authorized independent repositories/APIs |
| `vite.config.ts` | Lovable SDK/build; Provider environment/config | 1, 4, 7 | Replace provider build/database setup while keeping TanStack Start |

## Environment variable names

- `LOVABLE_CRON_SECRET`
- `LOVABLE_CRON_SECRET_PREVIOUS`
- `LOVABLE_DB_MIGRATION_URL`
- `MODE`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
