# Admin Access Approvals & Stock-Aware Price Sync

Establish an administrator approval and invitation gate so unauthorized users cannot register admin accounts, and integrate automated stock availability checks during live price refresh to automatically deactivate out-of-stock products.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification and will govern the build:

- **Confirmed Decision 1**: An **Admin Management** section will be added to the Admin Settings view (`/admin/settings`), allowing current admins to view existing admins, invite/pre-approve new admin emails, and revoke access.
- **Confirmed Decision 2**: Admin registration (`/admin/login` -> "Set up admin account") will enforce that only pre-approved emails can create accounts. Unapproved sign-up attempts will be blocked with an informative message.
- **Confirmed Decision 3**: When checking or refreshing product prices (both single product check and batch catalog refresh), the system will inspect retailer stock availability (Amazon, Flipkart, Ubuy, and generic e-commerce schema). If detected out of stock, the product will be **automatically deactivated** (`active = false`), and an alert toast will highlight the deactivation.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Strict Admin Whitelisting**: Prevents arbitrary users from setting up admin credentials. Only email addresses pre-authorized by an existing administrator in Mission Control Settings can register.
  2. **Stock Availability Scanner**: Enhances the existing price check engine (`/api/admin/check-price`) to parse stock indicators (Schema.org availability, OpenGraph metadata, and retailer-specific selectors such as Amazon's `#availability` and Flipkart's stock indicators).
  3. **Automated Deactivation Guard**: When a single product or batch price refresh detects an out-of-stock status, the product is automatically deactivated in the database and catalog to protect visitor trust and prevent dead affiliate clicks.

- **Target Audience / Persona**: Store administrators managing product inventory, affiliate links, and collaborator access.
- **Key Value**: Guarantees store security by eliminating open admin signups and keeps the public store catalog fresh by pruning unavailable products automatically during routine price maintenance.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Admin Approval & Invitation (Settings)**:
   - The current admin navigates to `/admin/settings`.
   - A new **Admin Team & Access** section displays a tabular list of approved admin emails and creation dates.
   - An "Invite / Approve Admin" input field allows typing a new email and adding it to the authorized admins list.
   - Each non-primary admin row includes a subtle "Revoke Access" action with confirmation.

2. **Blocked Unauthorized Signup (Login Screen)**:
   - If an uninvited user visits `/admin/login` and attempts to create an admin account, the frontend validates the email against the approved admin registry before invoking authentication.
   - If unapproved, a clear alert is displayed: *"This email is not authorized for administrator access. Please ask an existing administrator to invite you."*

3. **Stock-Aware Single Product Price Refresh**:
   - The admin clicks the refresh button on a product row in `/admin/products` or inside `ProductForm.tsx`.
   - The scanner fetches the retailer page, extracts the price, and detects availability.
   - If the item is in stock with a new price: updates price and displays *"Price updated to ₹X,XXX"*.
   - If the item is out of stock: sets `active = false` in the database, updates the row to show an inactive state, and alerts with a warning toast: *"Product is Out of Stock on retailer site. Automatically deactivated."*

4. **Catalog Batch Price Refresh**:
   - The admin clicks "Check All Live Prices" in `/admin/products`.
   - As products are analyzed sequentially, any item found out of stock is automatically deactivated.
   - Upon completion, a toast summarizes: *"Price check complete: X prices updated, Y out-of-stock items automatically deactivated."*

### Visual Identity & Theme Alignment
- **Aesthetic**: Utilitarian, mission-control styling following the store's deep dark cosmic palette (`bg-background`, `border-border`, subtle hairline borders).
- **Typography**: Clean sans headers with tabular numerals (`tabular-nums`) for currency and stock counts.
- **Micro-Interactions**: Smooth spinner states during price verification, amber warning badges for inactive/out-of-stock states, and clean Sonner toasts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Database Whitelist Enforced on Signup**:
  - *Chosen Approach*: Validate the entered email against `public.admins` before completing the signup workflow in `admin.login.tsx`.
  - *Why*: Prevents unapproved users from creating orphaned Supabase auth user accounts, while keeping permission enforcement tied directly to the existing `public.is_admin()` database function.
  - *Alternatives Considered*: Allowing anyone to register in Auth but blocking login. Rejected because it clutters the auth user database and confuses applicants.

- **Decision 2: Automated Deactivation vs. Prompting**:
  - *Chosen Approach*: Automatically set `active = false` with prominent toast feedback.
  - *Why*: Admins running batch refreshes across dozens of products cannot wait to click individual confirmation dialogs for each out-of-stock item. Direct deactivation keeps the public store accurate immediately.

- **Decision 3: Multi-Layer Stock Extraction**:
  - *Chosen Approach*: Parse Schema.org JSON-LD `itemAvailability` (`InStock`, `OutOfStock`, `Discontinued`), OpenGraph tags, and fallback DOM selectors (Amazon `#availability`, Flipkart status).
  - *Why*: Retailers frequently change their frontend DOM classes, but Schema.org microdata remains standardized and reliable.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             ADMIN UI VIEWS                               │
│                                                                          │
│   /admin/settings                /admin/products            /admin/login │
│   ┌───────────────────────┐      ┌────────────────────┐     ┌──────────┐ │
│   │ Admin Team Management │      │ Price & Stock Sync │     │ Signup   │ │
│   │ [Email input] [Add]   │      │ [Single / Batch]   │     │ Gate     │ │
│   └───────────┬───────────┘      └─────────┬──────────┘     └────┬─────┘ │
└───────────────┼────────────────────────────┼─────────────────────┼───────┘
                │                            │                     │
                ▼                            ▼                     ▼
┌───────────────────────────────┐  ┌────────────────────┐  ┌───────────────┐
│       SUPABASE DATABASE       │  │ API ROUTE HANDLER  │  │ CLIENT AUTH   │
│                               │  │                    │  │               │
│ - public.admins               │  │ /api/admin/        │  │ Check if      │
│   (id, email, created_at)     │  │ check-price        │  │ email in      │
│ - public.products             │  │                    │  │ public.admins │
│   (price, active, ...)        │  │ Returns:           │  │ before signup │
│ - public.is_admin() RPC       │  │ { price, inStock } │  │               │
└───────────────────────────────┘  └────────────────────┘  └───────────────┘
```

### Data Model & Handler Changes

1. **`src/routes/api/admin/check-price.ts`**:
   - Add `detectStockStatus($, retailer)` helper detecting `inStock: boolean` via:
     - JSON-LD `offers.availability` containing `InStock` vs `OutOfStock` / `SoldOut`.
     - Amazon selector `#availability span` checking for `"currently unavailable"`, `"out of stock"`, etc.
     - Flipkart selector and text check.
     - Ubuy out-of-stock cues.
   - Return `{ success: true, price: number | null, inStock: boolean, retailer: string }`.

2. **`src/routes/_admin.admin.products.index.tsx`**:
   - In `handleUpdateSinglePrice`: If `result.inStock === false`, update product to `active: false`, show warning toast, and refresh queries.
   - In `handleBatchUpdatePrices`: Track `deactivatedCount`, update products with `active: false` when `inStock === false`, and show summary toast.

3. **`src/components/admin/ProductForm.tsx`**:
   - In `handleUpdatePriceFromLink`: If `result.inStock === false`, set `setActive(false)` and alert the admin.

4. **`src/routes/_admin.admin.settings.tsx`**:
   - Add query to fetch `public.admins` list.
   - Add "Invite / Pre-approve Admin" form inserting to `public.admins`.
   - Add "Revoke Access" action deleting from `public.admins` (preventing self-deletion of the current user).

5. **`src/routes/admin.login.tsx`**:
   - In `submit` for `mode === "setup"`: Check if the provided email exists in `public.admins` (or an RPC / query). If not, abort signup and display: `"This email is not authorized for administrator access. Please ask an existing administrator to invite you."`
