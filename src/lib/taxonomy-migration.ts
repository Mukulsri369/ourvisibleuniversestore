import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface TargetTaxonomyCategory {
  key: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  primaryLegacySlug: string; // The category to rename/update in-place to preserve IDs
  absorbedLegacySlugs: string[]; // Merged categories whose items are adopted
}

export const TARGET_9_TAXONOMY: TargetTaxonomyCategory[] = [
  {
    key: "cosmic-lighting",
    name: "Cosmic Lighting & Projectors",
    slug: "cosmic-lighting",
    description:
      "Galaxy projectors, planetarium domes, 3D moon lamps, neon signs, and starlight strings.",
    sort_order: 0,
    primaryLegacySlug: "lights",
    absorbedLegacySlugs: ["lamp", "projectors"],
  },
  {
    key: "space-wall-art",
    name: "Space Wall Art & Posters",
    slug: "space-wall-art",
    description: "Canvas prints, celestial tapestries, glow-in-the-dark decals, and NASA art.",
    sort_order: 1,
    primaryLegacySlug: "spaceart",
    absorbedLegacySlugs: ["posters"],
  },
  {
    key: "kids-learning",
    name: "Kids & STEM Learning",
    slug: "kids-learning",
    description: "DIY solar system kits, magnet sets, activity books, and educational space toys.",
    sort_order: 2,
    primaryLegacySlug: "kids-learning",
    absorbedLegacySlugs: [],
  },
  {
    key: "space-party-supplies",
    name: "Space Party Supplies",
    slug: "space-party-supplies",
    description: "Galaxy balloons, astronaut banners, cake toppers, and birthday decoration sets.",
    sort_order: 3,
    primaryLegacySlug: "space-b-day-party",
    absorbedLegacySlugs: [],
  },
  {
    key: "clocks-timepieces",
    name: "Clocks & Timepieces",
    slug: "clocks-timepieces",
    description: "Glowing moon wall clocks, silent dial Earth clocks, and astronaut desk alarms.",
    sort_order: 4,
    primaryLegacySlug: "clock",
    absorbedLegacySlugs: [],
  },
  {
    key: "books-guides",
    name: "Books & Field Guides",
    slug: "books-guides",
    description: "Universe encyclopedias, star atlases, and deep sky observation guides.",
    sort_order: 5,
    primaryLegacySlug: "books",
    absorbedLegacySlugs: [],
  },
  {
    key: "space-decor",
    name: "Space Décor & Showpieces",
    slug: "space-decor",
    description:
      "Magnetic levitating globes, astronaut statues, Mars globes, and desktop displays.",
    sort_order: 6,
    primaryLegacySlug: "space-decor",
    absorbedLegacySlugs: ["showpieces"],
  },
  {
    key: "astronomy-gifts",
    name: "Astronomy Gifts & Keepsakes",
    slug: "astronomy-gifts",
    description:
      "3D laser-etched crystal balls, solar system spheres, curated boxes, and keepsakes.",
    sort_order: 7,
    primaryLegacySlug: "astronomy-gifts",
    absorbedLegacySlugs: [],
  },
  {
    key: "tech-accessories",
    name: "Tech & Daily Accessories",
    slug: "tech-accessories",
    description: "Astronaut desk phone stands, grips, mobile skins, and laptop decals.",
    sort_order: 8,
    primaryLegacySlug: "mobile-accessories",
    absorbedLegacySlugs: ["space-gadgets"],
  },
];

export const RETIRED_LEGACY_SLUGS = [
  "astronomy-apparel",
  "lamp",
  "projectors",
  "posters",
  "showpieces",
  "space-gadgets",
];

export interface MigrationStepProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

export interface MigrationResult {
  categoriesUpdated: number;
  categoriesDeactivated: number;
  productsReassigned: number;
  totalProductsChecked: number;
  categorySummary: { name: string; slug: string; productCount: number }[];
}

export async function runTaxonomyMigration(
  client: SupabaseClient<Database>,
  onProgress?: (p: MigrationStepProgress) => void,
): Promise<MigrationResult> {
  onProgress?.({
    step: "fetch",
    current: 0,
    total: 100,
    message: "Fetching existing categories and catalog records…",
  });

  // 1. Fetch all current categories
  const { data: existingCategories, error: catError } = await client.from("categories").select("*");
  if (catError) throw catError;
  if (!existingCategories) throw new Error("Could not load categories.");

  const catBySlug = new Map<string, (typeof existingCategories)[0]>();
  const catById = new Map<string, (typeof existingCategories)[0]>();
  for (const c of existingCategories) {
    catBySlug.set(c.slug, c);
    catById.set(c.id, c);
  }

  // 2. Fetch all products (batches if needed)
  let allProducts: {
    id: string;
    name: string;
    category_id: string | null;
    category_ids: string[];
    slug: string;
  }[] = [];

  let from = 0;
  const pageSize = 500;
  while (true) {
    const { data: page, error: prodErr } = await client
      .from("products")
      .select("id,name,category_id,category_ids,slug")
      .range(from, from + pageSize - 1);
    if (prodErr) throw prodErr;
    if (!page || page.length === 0) break;
    allProducts = allProducts.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  onProgress?.({
    step: "categories",
    current: 25,
    total: 100,
    message: "Updating 9 primary category records and metadata…",
  });

  // 3. Update or Insert the 9 target categories
  // Maps targetKey -> categoryId in DB
  const targetIdByKey = new Map<string, string>();
  // Maps legacy slug/id -> new target categoryId
  const legacyToTargetCatId = new Map<string, string>();

  let categoriesUpdated = 0;

  for (const target of TARGET_9_TAXONOMY) {
    // Check if category matching primaryLegacySlug exists
    const primaryCat = catBySlug.get(target.primaryLegacySlug) || catBySlug.get(target.slug);

    if (primaryCat) {
      // Update in place
      const { error } = await client
        .from("categories")
        .update({
          name: target.name,
          slug: target.slug,
          description: target.description,
          sort_order: target.sort_order,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", primaryCat.id);
      if (error) throw error;
      targetIdByKey.set(target.key, primaryCat.id);
      legacyToTargetCatId.set(primaryCat.id, primaryCat.id);
      legacyToTargetCatId.set(primaryCat.slug, primaryCat.id);
      categoriesUpdated++;
    } else {
      // Create new category
      const { data, error } = await client
        .from("categories")
        .insert({
          name: target.name,
          slug: target.slug,
          description: target.description,
          sort_order: target.sort_order,
          active: true,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (data?.id) {
        targetIdByKey.set(target.key, data.id);
        legacyToTargetCatId.set(data.id, data.id);
        legacyToTargetCatId.set(target.slug, data.id);
      }
      categoriesUpdated++;
    }

    // Map absorbed legacy categories to this target ID
    for (const absorbedSlug of target.absorbedLegacySlugs) {
      const absorbedCat = catBySlug.get(absorbedSlug);
      if (absorbedCat) {
        const targetId = targetIdByKey.get(target.key);
        if (targetId) {
          legacyToTargetCatId.set(absorbedCat.id, targetId);
          legacyToTargetCatId.set(absorbedCat.slug, targetId);
        }
      }
    }
  }

  onProgress?.({
    step: "products",
    current: 50,
    total: 100,
    message: `Reclassifying ${allProducts.length} products across the 9 categories…`,
  });

  // 4. Reclassify products
  let productsReassigned = 0;

  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i];
    const currentIds = p.category_ids?.length
      ? p.category_ids
      : p.category_id
        ? [p.category_id]
        : [];

    const newTargetIdsSet = new Set<string>();

    for (const cid of currentIds) {
      const mappedTargetId = legacyToTargetCatId.get(cid);
      if (mappedTargetId) {
        newTargetIdsSet.add(mappedTargetId);
      } else {
        // Look up by category row if known
        const catObj = catById.get(cid);
        if (catObj) {
          const bySlugTarget = legacyToTargetCatId.get(catObj.slug);
          if (bySlugTarget) newTargetIdsSet.add(bySlugTarget);
          else newTargetIdsSet.add(cid);
        } else {
          newTargetIdsSet.add(cid);
        }
      }
    }

    // Fallback if empty: assign to Space Décor & Showpieces
    if (newTargetIdsSet.size === 0) {
      const defaultId = targetIdByKey.get("space-decor") || targetIdByKey.get("astronomy-gifts");
      if (defaultId) newTargetIdsSet.add(defaultId);
    }

    const updatedArray = Array.from(newTargetIdsSet);
    const updatedPrimary = updatedArray[0] ?? null;

    // Check if changes are needed
    const needsUpdate =
      JSON.stringify(p.category_ids?.slice().sort() ?? []) !==
        JSON.stringify(updatedArray.slice().sort()) || p.category_id !== updatedPrimary;

    if (needsUpdate) {
      const { error: updateErr } = await client
        .from("products")
        .update({
          category_ids: updatedArray,
          category_id: updatedPrimary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (updateErr) {
        console.error(`Failed to update product ${p.name} (${p.id}):`, updateErr);
      } else {
        productsReassigned++;
      }
    }

    if (i % 25 === 0 || i === allProducts.length - 1) {
      onProgress?.({
        step: "products",
        current: 50 + Math.round(((i + 1) / allProducts.length) * 35),
        total: 100,
        message: `Processing products (${i + 1}/${allProducts.length})…`,
      });
    }
  }

  onProgress?.({
    step: "cleanup",
    current: 90,
    total: 100,
    message: "Deactivating retired & merged legacy categories…",
  });

  // 5. Deactivate retired / merged categories
  let categoriesDeactivated = 0;
  for (const retiredSlug of RETIRED_LEGACY_SLUGS) {
    const retiredCat = catBySlug.get(retiredSlug);
    if (retiredCat && retiredCat.active) {
      const { error: deactErr } = await client
        .from("categories")
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", retiredCat.id);
      if (!deactErr) categoriesDeactivated++;
    }
  }

  // 6. Compute final counts per category
  const { data: finalActiveCategories } = await client
    .from("categories")
    .select("id,name,slug,sort_order")
    .eq("active", true)
    .order("sort_order");

  const categorySummary: { name: string; slug: string; productCount: number }[] = [];
  if (finalActiveCategories) {
    for (const c of finalActiveCategories) {
      const { count } = await client
        .from("products")
        .select("id", { count: "exact", head: true })
        .contains("category_ids", [c.id]);
      categorySummary.push({
        name: c.name,
        slug: c.slug,
        productCount: count ?? 0,
      });
    }
  }

  onProgress?.({
    step: "complete",
    current: 100,
    total: 100,
    message: "Taxonomy reorganization successfully completed!",
  });

  return {
    categoriesUpdated,
    categoriesDeactivated,
    productsReassigned,
    totalProductsChecked: allProducts.length,
    categorySummary,
  };
}
