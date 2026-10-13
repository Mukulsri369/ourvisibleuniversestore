# Live Retailer Price Update for Admin Products

## Summary

Add individual and batch "Update Price" actions for store administrators across the Admin Products list table and the Product Edit form. Clicking the button checks the live retailer price from the product's affiliate link using real browser-grade fetching and immediately updates the database with the verified price, displaying instant toast feedback with previous and new pricing.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification:
>
> - **Placement**: Price update buttons will be available in **both the admin products list table and the product edit form**.
> - **Execution**: The system will **save immediately to the database** upon checking the link and display an informative toast showing the updated price (and old price if changed).
> - **Batch Capability**: In addition to per-product update buttons, a **"Refresh All Prices"** batch button will be provided in the admin products header to check and synchronize all live products.

---

## 1. Overview & Core Concept

When an admin clicks "Update Price" on any product:

1. The server takes the product's affiliate link (e.g. Amazon, Flipkart, or redirect shortlink) and fetches the current page with modern Chromium headers.
2. It scrapes the exact active price and currency from the retailer's DOM (checking `.a-price .a-offscreen`, `.priceToPay`, JSON-LD schema offers, etc.).
3. If an existing `productId` is provided, the database record (`products.price`, `products.currency`, and `products.price_updated_at`) is updated automatically.
4. The client receives the verified price data, shows a toast notification (e.g. `✨ Price updated from ₹4,018 to ₹3,899` or `Price verified: unchanged at ₹3,899`), and refreshes the table row.
5. In the Product Edit form, the price input and last updated date are populated and saved immediately.
6. The batch "Refresh All Prices" button iterates over all products with affiliate URLs, showing live progress and a final summary of changes.

---

## 2. User Experience & Visual Design

### Admin Products Table (`/_admin/admin/products/`)

- **New Price Column**:
  - Displays the formatted price (e.g., `₹4,018.00` or `—` if not set) alongside a subtle relative time indicator (e.g., `Updated 2d ago`).
  - Next to each price, a dedicated "Update Price" button with a refresh icon (`RefreshCw`) allows 1-click price checking.
  - While fetching, the button transitions into a spinning loader and is disabled to prevent duplicate requests.
- **Top Bar Batch Action**:
  - Added alongside "Add Product" and "Festival Special": a **"Refresh All Prices"** button.
  - Clicking triggers sequential or throttled parallel price checks for all products in the store.
  - An interactive Sonner loading toast displays live progress (`Checking prices: 4 / 22...`) followed by a success summary (`🎉 22 products checked: 3 updated, 19 unchanged`).

### Admin Product Form (`src/components/admin/ProductForm.tsx`)

- In the **Pricing** section:
  - An inline **"Check Link Price"** button is placed directly inside the Price input header.
  - Clicking inspects the current affiliate URL, fetches the latest price, sets the field, and (if editing an existing product) persists it to the database with a success toast.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dedicated Server Endpoint `/api/admin/check-price`**
  - _Chosen Approach_: Create a fast, lightweight server route dedicated specifically to price extraction without re-scraping the entire gallery and full text description.
  - _Why_: Much faster response times (under 1 second per product) which is crucial for responsive 1-click updates and batch refreshing.

- **Decision 2: Direct Database Persistence vs. Form-Only Pre-fill**
  - _Chosen Approach_: When triggered from the products table or when editing an existing product, persist directly to Supabase and update `price_updated_at`.
  - _Why_: Saves admin time by avoiding an unnecessary multi-step save confirmation for routine price checks.

- **Decision 3: Handling Missing or Out-of-Stock Prices**
  - _Chosen Approach_: If the retailer page does not display an active price (e.g. temporarily out of stock or coupon-only), the system will notify the admin with a clear warning toast without wiping out the existing recorded price.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────┐
│ Admin UI: _admin.admin.products.index.tsx                      │
│ - Price Column with individual "Update Price" button           │
│ - Header "Refresh All Prices" batch action                     │
└───────────────────────────────┬────────────────────────────────┘
                                │ POST /api/admin/check-price
                                ▼
┌────────────────────────────────────────────────────────────────┐
│ Server Route: src/routes/api/admin/check-price.ts               │
│ - Resolves redirects with Chromium headers                     │
│ - Extracts current price from DOM / JSON-LD                    │
│ - Updates products table: price, currency, price_updated_at    │
│ - Returns { success: true, price, currency, previousPrice }    │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│ TanStack Query Cache Invalidation & Feedback:                  │
│ - Invalidate ['admin', 'products']                             │
│ - Sonner toast: "✨ Price updated: ₹3,899 (was ₹4,018)"        │
└────────────────────────────────────────────────────────────────┘
```

### Affected Files

1. **`src/routes/api/admin/check-price.ts`** (New):
   - Fast server endpoint to extract current retailer price from affiliate URLs and optionally update the product in Supabase.
2. **`src/routes/_admin.admin.products.index.tsx`**:
   - Add Price column to the table.
   - Add per-row "Update Price" action with spinning state.
   - Add "Refresh All Prices" batch action button to the header with progress toast.
3. **`src/components/admin/ProductForm.tsx`**:
   - Add "Check Link Price" button beside the Price field.
