# Category Spotlight Showcases with Admin Curation & Collapsible Details

A showcase experience for every category on the landing page, featuring a prominent side-by-side hero product with collapsed/expandable rich descriptions, paired with a curation tool inside the Admin Categories manager.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The design directly incorporates your confirmed preferences:
> - **Visual Presentation**: Side-by-side split hero card positioned immediately above each category product rail on the landing page.
> - **Smart Fallback Rule**: If no custom product has been pinned by an admin, automatically spotlight the **top featured product** in that category, falling back to the **newest arrival**.
> - **Curation Control**: Curators pick and switch each category's showcase product directly within the **Categories manager** in the Admin panel.
> - **Space Conservation**: Long descriptions remain collapsed with an ergonomic **"Read more / Read less"** toggle so vertical space remains compact above the product browse rail.

---

## 1. Overview & Core Concept

Currently, category sections on the landing page display horizontal product scroll rails. This enhancement introduces an editorial **Category Spotlight Hero** above each category rail:

1. **Large Product Showcase**:
   - High-fidelity product photography with cosmic framing.
   - Live pricing, title, and crisp `short_description`.
   - Collapsible `description` with a smooth "Read more / Read less" toggle to conserve vertical space.
   - Actionable CTAs: Direct retailer affiliate purchase button and quick-view preview.
2. **Admin Curation Tool**:
   - Within `/admin/categories`, curators can select any product assigned to that category as its permanent showcase item.
   - Configured selections are stored cleanly in database site settings with real-time preview and instant "Reset to Auto" option.

---

## 2. User Experience & Visual Design

### A. Landing Page Category Showcase Component (`CategorySpotlightHero.tsx`)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Category Spotlight Card                         │
├───────────────────────────────┬────────────────────────────────────────┤
│                               │ SECTOR // COSMIC LIGHTING SHOWCASE    │
│                               │                                        │
│   [ High-Resolution           │ Astronaut Galaxy Projector             │
│     Product Image             │ ₹2,499.00  ·  In Stock                 │
│     with Ambient Glow ]       │                                        │
│                               │ Short Description:                     │
│                               │ 360° rotating nebula dome with stars.  │
│                               │                                        │
│                               │ Description:                           │
│                               │ Transform any room into a planetarium. │
│                               │ Features 8 distinct nebula modes...    │
│                               │ [▾ Read more]                          │
│                               │                                        │
│                               │ [ Buy on Amazon ]  [ Quick View ]      │
└───────────────────────────────┴────────────────────────────────────────┘
```

- **Collapsible Discipline**: The full description is clamped to 2 lines by default with an unobtrusive inline `Read more` button. Expanding reveals full specifications with a `Read less` toggle.
- **Responsive Layout**: Desktop displays a balanced 50/50 split; mobile displays a vertically stacked card with touch-friendly 44px buttons.
- **Anti-Slop Restraint**: Zero decorative pill clusters or generic candy badges. Clean monospace sector kickers and tabular pricing.

---

## 3. Data Strategy & Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Spotlight Data Architecture                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│   Admin Categories Manager       │        │     Storefront Landing Page      │
│   (/admin/categories)            │        │     (src/routes/_store.index)    │
├──────────────────────────────────┤        ├──────────────────────────────────┤
│ 1. Reads current spotlights      │        │ 1. Reads category_spotlights     │
│ 2. Opens Product Picker Dialog   │        │ 2. Resolves selected or fallback │
│ 3. Updates site_settings:        │        │ 3. Renders CategorySpotlightHero │
│    social_links.category_        │        │    above each ProductScrollRail  │
│    spotlights[categoryId]        │        └──────────────────────────────────┘
└──────────────────────────────────┘
```

### Data Model & Storage:
- **Persistence**: Spotlight selections are saved in `site_settings.social_links.category_spotlights` (a key-value map of `{ [categoryId]: productId }`), fully covered by existing Row Level Security and cached via React Query.
- **Fallback Resolution**:
  ```ts
  function getSpotlightProduct(category, products, spotlights) {
    const customId = spotlights[category.id];
    if (customId) {
      const match = products.find(p => p.id === customId);
      if (match) return match;
    }
    // Fallback: Top featured product -> newest arrival
    return products.find(p => p.featured) || products[0] || null;
  }
  ```

---

## 4. Implementation Steps

1. **CategorySpotlightHero Component** (`src/components/store/CategorySpotlightHero.tsx`):
   - Build responsive split hero with image gallery, title, pricing, short description, expandable full description, and purchase buttons.
2. **Landing Page Integration** (`src/routes/_store.index.tsx`):
   - Retrieve `category_spotlights` from settings query.
   - Mount `CategorySpotlightHero` above each `ProductScrollRail`.
3. **Admin Spotlight Picker** (`src/routes/_admin.admin.categories.tsx`):
   - Add a "Showcase Product" card per category in `/admin/categories`.
   - Add an interactive Product Selection Modal with search filtering.
   - Support "Set Spotlight" and "Reset to Auto".
4. **Verification**:
   - Verify TypeScript compilation, linting, responsive layout on desktop and mobile, and seamless expansion of long descriptions.
