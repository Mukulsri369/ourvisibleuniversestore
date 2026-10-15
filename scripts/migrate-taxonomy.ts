import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";
import { runTaxonomyMigration, TARGET_9_TAXONOMY } from "../src/lib/taxonomy-migration";

const SUPABASE_URL =
  process.env["SUPABASE_URL"] ||
  "https://c--e5dc52fc-4129-47cd-9ba2-1c20a9af2f78-prod.lovable.cloud";
const SUPABASE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_LnvKmEnYxmXbvplWO-pkgw_6cxxCkYL";

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("=== CATALOG TAXONOMY 9-CATEGORY REORGANIZATION ===");
  console.log(`Target URL: ${SUPABASE_URL}`);
  console.log(`Planned Categories: ${TARGET_9_TAXONOMY.length}`);

  try {
    const result = await runTaxonomyMigration(supabase, (progress) => {
      console.log(`[${progress.current}%] ${progress.message}`);
    });

    console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===");
    console.log(`Categories updated: ${result.categoriesUpdated}`);
    console.log(`Categories deactivated: ${result.categoriesDeactivated}`);
    console.log(`Products reassigned: ${result.productsReassigned}`);
    console.log(`Total products checked: ${result.totalProductsChecked}\n`);
    console.log("Category Distribution:");
    for (const c of result.categorySummary) {
      console.log(` - ${c.name} (${c.slug}): ${c.productCount} products`);
    }
  } catch (err) {
    console.error("Migration error:", err);
  }
}

main();
