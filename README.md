# Cosmic Cart

BUILD A COMPLETE PRODUCTION-READY E-COMMERCE-STYLE AFFILIATE STORE FROM SCRATCH FOR “OUR VISIBLE UNIVERSE”

I want you to build a completely separate store website for my brand “Our Visible Universe”.

This is an astronomy/space-themed affiliate storefront.

IMPORTANT BUSINESS MODEL:
This is NOT a traditional e-commerce store.

I will NOT:
- Keep physical inventory
- Pack products
- Ship products
- Process customer payments
- Handle returns

Instead:

1. Products are displayed beautifully on my store website.
2. Each product has its own Amazon Associates affiliate URL.
3. Customer clicks “Buy on Amazon”.
4. Customer is redirected to the exact Amazon product page through my affiliate URL.
5. Amazon handles checkout, payment, shipping and fulfillment.
6. I earn applicable affiliate commission from qualifying purchases.

The website must be designed around this workflow.

==================================================
1. BRAND
==================================================

Brand name:

Our Visible Universe

The store should feel like a premium extension of an astronomy/universe exploration brand.

The design should communicate:

- Space
- Astronomy
- Exploration
- Curiosity
- Science
- Discovery
- Premium quality

Do NOT make it look like a generic Amazon clone.

Use a distinctive cosmic visual identity.

==================================================
2. WEBSITE URL / ARCHITECTURE
==================================================

This will be a completely separate website from the main Our Visible Universe application.

Suggested URL:

store.ourvisibleuniverse.com

The application must be independently deployable.

The main Our Visible Universe website will later have a simple “STORE” button that links to this store URL.

Do not depend on the main application for the store to function.

==================================================
3. TECHNOLOGY / ARCHITECTURE
==================================================

Build this as a real database-backed web application.

Do NOT hard-code products into frontend source code.

Use:

- Secure authentication
- Database
- Image/file storage
- Server-side protected operations
- Responsive frontend
- Proper routing
- SEO-friendly product URLs

The database must be the single source of truth for products.

The architecture must be scalable enough to eventually handle hundreds or thousands of products.

==================================================
4. PUBLIC WEBSITE PAGES
==================================================

Create these public pages:

/

Home

/shop

All Products

/category/:slug

Category page

/product/:slug

Product details

/search

Search results

/about

About the Store

/contact

Contact

/affiliate-disclosure

Affiliate Disclosure

/privacy

Privacy Policy

/terms

Terms & Conditions

==================================================
5. ADMIN PAGES
==================================================

Create a completely protected admin area:

/admin/login

/admin

/admin/products

/admin/products/new

/admin/products/edit/:id

/admin/products/trash

/admin/categories

/admin/settings

Only authenticated administrators can access these pages.

==================================================
6. ADMIN ACCOUNT
==================================================

The initial administrator email must be:

mukul.srivastava.025@gmail.com

IMPORTANT:

Do NOT hard-code a password into the frontend.

Use secure authentication.

The administrator should create/set the password through the authentication system.

The email above should be configured as the initial authorized administrator.

Only this authorized admin should initially have administrative privileges.

Do NOT display the admin email publicly.

==================================================
7. ADMIN LOGIN
==================================================

Create a premium but simple admin login page.

URL:

/admin/login

Fields:

Email
Password

Buttons:

Sign In

Additional functionality:

- Show/hide password
- Loading state
- Invalid credentials message
- Session persistence
- Secure logout
- Forgot/reset password if supported by the authentication provider

After successful authentication:

Redirect to:

/admin

If a non-authenticated user attempts to access an admin route:

Redirect to:

/admin/login

IMPORTANT:

Authentication and authorization must be enforced server-side/database-side, not only through frontend route protection.

==================================================
8. ADMIN DASHBOARD
==================================================

Create a professional dashboard.

Sidebar:

Dashboard
Products
Categories
Settings
View Store
Logout

Dashboard cards:

- Total Products
- Active Products
- Inactive Products
- Featured Products
- Total Categories
- Products Added Recently

Add a prominent:

+ ADD PRODUCT

button.

Show recent products.

Each recent product should display:

- Image
- Name
- Category
- Status
- Featured status
- Created date
- Actions

==================================================
9. PRODUCT MANAGEMENT
==================================================

Admin must be able to:

CREATE
READ
UPDATE
DELETE

products.

Create:

/admin/products

Provide:

- Search
- Category filter
- Status filter
- Featured filter
- Pagination

Product table/card should display:

- Image
- Product name
- Category
- Amazon URL status
- Active/inactive
- Featured/not featured
- Date added
- Last updated
- Actions

Actions:

View
Edit
Delete
Activate/Deactivate

==================================================
10. ADD PRODUCT
==================================================

When admin clicks:

+ ADD PRODUCT

open:

/admin/products/new

Create a professional multi-section product creation form.

SECTION 1 — BASIC PRODUCT INFORMATION

Fields:

Product Name *
Short Description *
Full Description *
Category *
Subcategory
Brand
Tags

Example tags:

astronomy
space
galaxy
universe
solar system
telescope
NASA
astronaut
stars

Product Name must be required.

Descriptions must support clean formatting.

==================================================
11. PRODUCT IMAGE MANAGEMENT
==================================================

Add a dedicated:

PRODUCT IMAGES

section.

Admin must be able to:

- Upload primary image
- Upload multiple additional images
- Preview images
- Delete images
- Reorder images
- Select primary image

Supported formats:

JPG
JPEG
PNG
WEBP

Validate:

- File type
- File size

Use secure file storage.

Optimize images where possible.

Use lazy loading on the public website.

Do NOT expose storage credentials.

==================================================
12. PRODUCT FEATURES
==================================================

Allow the admin to add multiple product features.

Example:

“HD galaxy projection”

“Compact design”

“Suitable for bedroom use”

Interface:

+ Add Feature

Each feature can be edited or removed.

==================================================
13. AMAZON AFFILIATE INFORMATION
==================================================

Create a clearly separated:

AMAZON INFORMATION

section.

Fields:

Amazon Affiliate URL *
Amazon ASIN
Amazon Marketplace

The Amazon Affiliate URL must be stored individually for every product.

Example:

Product A:
Amazon URL A

Product B:
Amazon URL B

Product C:
Amazon URL C

Never use one global Amazon URL.

When Product A is opened and the customer clicks:

BUY ON AMAZON

the system MUST use Product A's stored affiliate URL.

When Product B is clicked:

use Product B's stored URL.

Do not redirect all products to Amazon's homepage.

Do not remove or alter affiliate tracking parameters.

==================================================
14. AMAZON LINK VALIDATION
==================================================

When an admin enters an Amazon URL:

Validate that it is a valid URL.

If invalid:

Show:

“Please enter a valid Amazon affiliate URL.”

Do not allow publishing until required Amazon information is valid.

Do not automatically generate fake affiliate URLs.

==================================================
15. PRICE INFORMATION
==================================================

Allow optional fields:

Price
Currency
Price last updated

IMPORTANT:

Do not invent Amazon prices.

Do not claim:

“Lowest price”
“Best price”
“Guaranteed price”

unless the information is actually available and permitted.

If price information is not available, display:

“Check latest price on Amazon”

instead.

Design the architecture so official Amazon-supported product data/API integration can be added later.

==================================================
16. PRODUCT STATUS
==================================================

Every product should have:

Active / Inactive

If Active:

Product appears publicly.

If Inactive:

Product disappears from public listings.

It remains visible to the administrator.

This allows temporary hiding without deleting.

==================================================
17. FEATURED PRODUCTS
==================================================

Add:

Featured Product

toggle.

Featured products may appear on:

- Homepage
- Featured section
- Category highlights

Non-featured products remain searchable and accessible.

==================================================
18. SAVE / PUBLISH FLOW
==================================================

At the bottom of Add Product:

Save Draft
Preview
Publish Product
Cancel

Required fields:

- Product name
- Description
- Category
- Primary image
- Amazon affiliate URL

Validate before publishing.

Show clear field-level validation messages.

Example:

“Product name is required.”

“Please upload a primary image.”

“Amazon affiliate URL is required.”

==================================================
19. AFTER PUBLISHING
==================================================

When the admin successfully publishes a product:

Show:

“Product published successfully.”

Buttons:

View Product
Back to Products

The product must immediately become available on the public store.

NO coding.

NO database editing.

NO redeployment.

NO manual frontend changes.

==================================================
20. PRODUCT EDITING
==================================================

Admin clicks:

Edit

The existing product data must load into the form.

Admin can change:

- Product name
- Description
- Images
- Category
- Brand
- Tags
- Features
- Price
- Amazon affiliate URL
- ASIN
- Active status
- Featured status

Click:

Save Changes

The public website must reflect the changes.

==================================================
21. PRODUCT DELETE
==================================================

Admin must be able to delete products.

When clicking Delete:

Show confirmation dialog:

“Delete this product?”

“Deleting this product will remove it from the public store.”

Buttons:

Cancel
Delete Product

Prevent accidental deletion.

Prefer a soft-delete/recycle-bin architecture.

Create:

/admin/products/trash

Admin can:

- Restore product
- Permanently delete product

Deleted products must never appear publicly.

==================================================
22. CATEGORY MANAGEMENT
==================================================

Create:

/admin/categories

Admin can:

- Add category
- Edit category
- Delete category
- Activate/deactivate category
- Upload category image
- Add category description

Initial categories:

1. Astronomy & Telescopes
2. Space Gadgets
3. Astronomy Apparel
4. Galaxy & Nebula
5. Solar System
6. Space Décor
7. Astronomy Gifts
8. Educational & Science
9. Kids & Learning
10. Space Accessories

New categories created by admin must automatically become available in the Add Product form.

==================================================
23. HOMEPAGE
==================================================

Create an impressive astronomy-themed homepage.

Hero headline:

“Bring the Universe Closer.”

Subheadline:

“Discover astronomy-inspired products, space gear, cosmic décor, apparel and gifts curated for curious minds.”

CTA:

EXPLORE THE STORE

Secondary CTA:

EXPLORE CATEGORIES

==================================================
24. HOMEPAGE SECTIONS
==================================================

Include:

Hero

Featured Categories

Featured Products

New Arrivals

Explore by Interest

Why Our Store

Instagram CTA

Footer

==================================================
25. CATEGORY CARDS
==================================================

Create visually attractive category cards.

Each card:

- Image
- Category name
- Short description
- Explore button

Example:

ASTRONOMY & TELESCOPES

“Tools for observing the night sky.”

SPACE GADGETS

“Bring a little cosmos into everyday life.”

ASTRONOMY APPAREL

“Wear your curiosity.”

GALAXY & NEBULA

“Cosmic-inspired objects and décor.”

==================================================
26. PRODUCT CARDS
==================================================

Product cards should contain:

- Product image
- Product name
- Short description
- Category
- Price if available
- View Product
- Buy on Amazon

Do not overcrowd the card.

Use subtle hover effects.

==================================================
27. PRODUCT DETAILS PAGE
==================================================

URL:

/product/:slug

Display:

- Large image gallery
- Product name
- Category
- Description
- Features
- Price if available
- Amazon CTA
- Affiliate disclosure
- Related products

Main button:

BUY ON AMAZON

When clicked:

Open the exact affiliate URL stored for that product.

==================================================
28. RELATED PRODUCTS
==================================================

Show related products based on:

- Category
- Tags
- Product type

Example:

Telescope product:

Show telescope accessories and astronomy products.

Galaxy projector:

Show space décor and galaxy products.

==================================================
29. SEARCH
==================================================

Create global product search.

Search:

- Product name
- Description
- Category
- Tags

Example searches:

“telescope”
“Saturn”
“galaxy”
“space t shirt”
“projector”
“astronomy gift”

Show:

“X products found”

Filters:

Category
Price if available
Featured

Sorting:

Featured
Newest
Price low to high
Price high to low

==================================================
30. MOBILE-FIRST DESIGN
==================================================

A significant amount of traffic may come from Instagram.

Therefore, mobile experience is extremely important.

Optimize for:

- Android phones
- iPhones
- Tablets
- Desktop

Mobile requirements:

- Fast loading
- Large touch targets
- Easy search
- Responsive product cards
- Easy Amazon CTA
- No horizontal scrolling
- Responsive navigation
- Optimized images

==================================================
31. VISUAL DESIGN
==================================================

Use a premium deep-space visual identity.

Use:

- Dark background
- Subtle star field
- Nebula gradients
- Cosmic glow
- Glass panels
- Elegant typography
- Premium spacing
- High-quality imagery

Do NOT make the site excessively animated.

The products must remain the visual focus.

Prioritize:

READABILITY
PERFORMANCE
PRODUCT DISCOVERY
TRUST

over excessive visual effects.

==================================================
32. ADMIN DESIGN
==================================================

Admin dashboard should use the same brand identity but prioritize usability.

Use:

- Clean sidebar
- Dashboard cards
- Tables
- Forms
- Clear buttons
- Status badges
- Confirmation dialogs

Do not use heavy animations in admin.

==================================================
33. DATABASE
==================================================

Create a proper database schema.

Tables:

admins
products
product_images
product_features
categories
product_tags
site_settings
outbound_clicks

PRODUCT fields:

id
name
slug
short_description
description
brand
category_id
amazon_url
amazon_asin
amazon_marketplace
price
currency
price_updated_at
featured
active
deleted_at
created_at
updated_at

PRODUCT_IMAGES:

id
product_id
image_url
alt_text
sort_order
created_at

PRODUCT_FEATURES:

id
product_id
feature
sort_order

CATEGORIES:

id
name
slug
description
image_url
active
created_at
updated_at

==================================================
34. DATABASE SECURITY
==================================================

Implement proper database access policies.

PUBLIC:

Can read:
- Active products
- Active categories

ADMIN:

Can:
- Create products
- Update products
- Delete products
- Manage images
- Manage categories
- Manage settings

Never allow public users to modify database records.

==================================================
35. ADMIN AUTHORIZATION
==================================================

The initial admin email:

mukul.srivastava.025@gmail.com

Must be recognized as an administrator.

Do not rely solely on the email being present in frontend code.

Store admin authorization securely.

Use proper backend/database authorization.

If using Supabase:

Use Supabase Auth.

Create an admin role/profile.

Use Row Level Security policies.

Do not expose service-role keys in the browser.

==================================================
36. SEO
==================================================

Every product should automatically generate:

- SEO title
- Meta description
- Canonical URL
- Open Graph title
- Open Graph description
- Open Graph image

Example:

/product/galaxy-projector

SEO title:

Galaxy Projector | Our Visible Universe Store

Generate clean, human-readable URLs.

==================================================
37. AFFILIATE DISCLOSURE
==================================================

Create a dedicated:

/affiliate-disclosure

page.

Include clear disclosure that the website participates in affiliate marketing and may earn commissions from qualifying purchases.

Also show an appropriate disclosure near affiliate purchase CTAs where required.

Do not misrepresent the relationship with Amazon.

==================================================
38. AMAZON COMPLIANCE
==================================================

IMPORTANT:

Do NOT scrape Amazon.

Do NOT build an unauthorized Amazon product scraper.

Do NOT automatically copy Amazon product information through unofficial methods.

Initially, product information will be entered manually by the admin.

Prepare the architecture for a future official Amazon-supported API integration.

If an official API is added later:

- Keep credentials server-side.
- Never expose credentials in frontend code.
- Follow applicable Amazon Associates policies.

==================================================
39. OUTBOUND CLICK TRACKING
==================================================

Optionally record:

- Product ID
- Timestamp
- Outbound click

This should measure clicks from our website to Amazon.

Do NOT claim that the system knows Amazon sales or commissions unless Amazon provides that data through an authorized integration.

Admin dashboard may show:

Total Amazon Clicks
Most-clicked Products

==================================================
40. PERFORMANCE
==================================================

Optimize the website for speed.

Use:

- Lazy-loaded images
- Responsive images
- Image compression
- Pagination
- Efficient database queries
- Caching where appropriate
- Code splitting

Do not use a heavy 3D universe background on every page.

The store should feel premium without becoming slow.

==================================================
41. ERROR HANDLING
==================================================

Handle:

- Invalid product
- Missing image
- Missing Amazon URL
- Database errors
- Authentication errors
- Image upload errors
- Network failures
- Invalid category
- Unauthorized admin access

Use friendly UI messages.

Example:

“Cosmic coordinates not found.”

Button:

“Return to Store”

==================================================
42. ADMIN SETTINGS
==================================================

Create:

/admin/settings

Allow admin to manage:

- Store name
- Logo
- Instagram URL
- Contact email
- Affiliate disclosure
- Footer text
- Social links

Do not expose secrets.

==================================================
43. FOOTER
==================================================

Footer:

OUR VISIBLE UNIVERSE

Explore:
- Shop
- Categories
- About

Information:
- Contact
- FAQ

Legal:
- Privacy Policy
- Terms & Conditions
- Affiliate Disclosure

Social:
- Instagram

Tagline:

“Explore the universe. Discover something extraordinary.”

==================================================
44. COMPLETE ADMIN WORKFLOW
==================================================

The final workflow must be:

ADMIN LOGIN
↓
Dashboard
↓
Add Product
↓
Product Information
↓
Upload Images
↓
Select Category
↓
Add Features
↓
Add Amazon Affiliate URL
↓
Set Active / Featured
↓
Preview
↓
Publish
↓
Product saved to database
↓
Product automatically appears on public website

No code editing should ever be required to add a product.

==================================================
45. COMPLETE CUSTOMER WORKFLOW
==================================================

Customer:

Instagram / Main Website
↓
Store
↓
Browse Categories
↓
Search Product
↓
Open Product
↓
View Images + Description
↓
Click “Buy on Amazon”
↓
Exact Amazon product page opens
↓
Amazon handles purchase and delivery

==================================================
46. CRITICAL REQUIREMENT
==================================================

The public website and admin dashboard MUST use the same database.

Products MUST NOT be hard-coded.

When admin adds:

“Galaxy Projector”

the product must automatically appear on:

- Homepage if featured
- Shop page
- Relevant category
- Search results
- Product details page

When admin deactivates it:

It disappears from the public store.

When admin edits it:

The public information updates.

When admin deletes it:

It disappears from the public store.

==================================================
47. FINAL ACCEPTANCE TEST
==================================================

Before completing the project, test the following:

1. Open /admin/login.
2. Authenticate using the authorized administrator account:
   mukul.srivastava.025@gmail.com
3. Dashboard opens.
4. Click Add Product.
5. Enter product name.
6. Add description.
7. Select category.
8. Upload image.
9. Add product features.
10. Add Amazon affiliate URL.
11. Mark product Featured.
12. Publish.
13. Verify product appears on public homepage.
14. Verify product appears in Shop.
15. Verify product appears in its category.
16. Verify product appears in search.
17. Open product details.
18. Click Buy on Amazon.
19. Verify the exact stored Amazon affiliate URL opens.
20. Return to admin.
21. Edit product.
22. Verify changes appear publicly.
23. Deactivate product.
24. Verify it disappears publicly.
25. Reactivate it.
26. Verify it appears again.
27. Delete product.
28. Verify it disappears publicly.
29. Verify unauthorized users cannot access admin routes.
30. Verify another product can have a completely different Amazon affiliate URL.

==================================================
48. DO NOT DO THESE THINGS
==================================================

DO NOT:

- Hard-code products
- Hard-code admin passwords
- Put authentication credentials in frontend code
- Put API keys in frontend code
- Scrape Amazon
- Create fake Amazon URLs
- Redirect every product to the Amazon homepage
- Create an internal payment gateway
- Create inventory management
- Create shipping management
- Claim Amazon sales data without an authorized integration
- Require code changes whenever a product is added
- Require redeployment after adding products

==================================================
49. FINAL GOAL
==================================================

I want a complete standalone astronomy-themed affiliate store.

ADMIN SIDE:

mukul.srivastava.025@gmail.com
↓
Secure Admin Login
↓
Dashboard
↓
Add/Edit/Delete Products
↓
Upload Images
↓
Add Product Details
↓
Add Amazon Affiliate URL
↓
Publish

CUSTOMER SIDE:

Our Visible Universe Store
↓
Discover Products
↓
Search / Categories
↓
Product Page
↓
BUY ON AMAZON
↓
Exact Amazon Product Page

Build the complete application from scratch.

Use a clean, scalable architecture so that I can later add hundreds of products without changing the code.

Make the first version production-ready, responsive, secure, fast, SEO-friendly, and visually consistent with the Our Visible Universe brand.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ourvisibleuniversestore.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e5dc52fc-4129-47cd-9ba2-1c20a9af2f78).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
