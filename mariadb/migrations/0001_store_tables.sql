-- MariaDB Store tables translated from the pinned PostgreSQL migrations. No products, users or approvals are seeded.

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `admins` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `email` VARCHAR(255) NOT NULL UNIQUE,  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `categories` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `name` LONGTEXT NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `description` LONGTEXT,
  `image_url` LONGTEXT,  `active` boolean NOT NULL DEFAULT true,  `sort_order` int NOT NULL DEFAULT 0,  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `products` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `name` LONGTEXT NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `short_description` LONGTEXT,
  `description` LONGTEXT,
  `brand` LONGTEXT,
  `subcategory` LONGTEXT,  `category_id` VARCHAR(36) REFERENCES categories(id) ON DELETE SET NULL,
  `amazon_url` LONGTEXT,
  `amazon_asin` LONGTEXT,
  `amazon_marketplace` LONGTEXT DEFAULT 'amazon.in',  `price` numeric(12,2),
  `currency` LONGTEXT DEFAULT 'INR',  `price_updated_at` DATETIME(6),  `featured` boolean NOT NULL DEFAULT false,  `active` boolean NOT NULL DEFAULT false,  `deleted_at` DATETIME(6),  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `product_images` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),  `product_id` VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  `image_url` LONGTEXT NOT NULL,
  `storage_path` LONGTEXT,
  `alt_text` LONGTEXT,  `sort_order` int NOT NULL DEFAULT 0,  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `product_features` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),  `product_id` VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  `feature` LONGTEXT NOT NULL,  `sort_order` int NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `product_tags` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),  `product_id` VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  `tag` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `site_settings` (
`id` int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  `store_name` LONGTEXT NOT NULL DEFAULT 'Our Visible Universe',
  `logo_url` LONGTEXT,
  `instagram_url` LONGTEXT,
  `contact_email` LONGTEXT,
  `affiliate_disclosure` LONGTEXT NOT NULL DEFAULT 'As an Amazon Associate, Our Visible Universe earns from qualifying purchases. When you buy through links on this site, we may earn a commission at no extra cost to you.',
  `footer_text` LONGTEXT NOT NULL DEFAULT 'Explore the universe. Discover something extraordinary.',  `social_links` JSON NOT NULL DEFAULT '{}',  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0000_migration.sql
CREATE TABLE IF NOT EXISTS `outbound_clicks` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),  `product_id` VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0010_storefront_page_persistence.sql
CREATE TABLE IF NOT EXISTS `store_pages` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `store_scope` VARCHAR(255) NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND TRIM(store_scope) <> '' AND CHAR_LENGTH(store_scope) <= 64 AND store_scope REGEXP '^[a-z0-9][a-z0-9_-]*$'),
  `page_key` VARCHAR(255) NOT NULL
    CHECK (TRIM(page_key) <> '' AND CHAR_LENGTH(page_key) <= 120 AND page_key REGEXP '^[a-z0-9][a-z0-9_-]*$'),
  `page_type` LONGTEXT NOT NULL DEFAULT 'home'
    CHECK (page_type IN ('home', 'category', 'collection', 'landing', 'custom')),
  `slug` VARCHAR(255) NOT NULL
    CHECK (TRIM(slug) <> '' AND CHAR_LENGTH(slug) <= 200 AND left(slug, 1) = '/'),
  `title` LONGTEXT NOT NULL
    CHECK (TRIM(title) <> '' AND CHAR_LENGTH(title) <= 200),  `published_version_id` VARCHAR(36),  `published_revision` int NOT NULL DEFAULT 0
    CHECK (published_revision >= 0),  `published_at` DATETIME(6),  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT store_pages_store_scope_page_key_key UNIQUE (store_scope, page_key),
  CONSTRAINT store_pages_store_scope_slug_key UNIQUE (store_scope, slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0010_storefront_page_persistence.sql
CREATE TABLE IF NOT EXISTS `store_page_versions` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),  `page_id` VARCHAR(36) NOT NULL REFERENCES store_pages(id) ON DELETE CASCADE,
  `store_scope` VARCHAR(255) NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND TRIM(store_scope) <> '' AND CHAR_LENGTH(store_scope) <= 64),  `version_number` int NOT NULL
    CHECK (version_number >= 1),
  `schema_version` LONGTEXT NOT NULL
    CHECK (TRIM(schema_version) <> '' AND CHAR_LENGTH(schema_version) <= 32),  `document_snapshot` JSON NOT NULL
    CHECK (
      LOWER(JSON_TYPE(document_snapshot)) = 'object'
      AND JSON_CONTAINS_PATH(document_snapshot, 'one', '$.id')
      AND JSON_CONTAINS_PATH(document_snapshot, 'one', '$.schemaVersion')
      AND JSON_CONTAINS_PATH(document_snapshot, 'one', '$.root')
      AND LOWER(JSON_TYPE(JSON_EXTRACT(document_snapshot, '$.root'))) = 'array'
      AND OCTET_LENGTH(document_snapshot) <= 1048576
    ),
  `checksum` LONGTEXT NOT NULL
    CHECK (TRIM(checksum) <> '' AND CHAR_LENGTH(checksum) <= 128),  `source_draft_revision` int
    CHECK (source_draft_revision IS NULL OR source_draft_revision >= 1),  `restored_from_version_id` VARCHAR(36) REFERENCES store_page_versions(id) ON DELETE SET NULL,
  `release_notes` LONGTEXT
    CHECK (release_notes IS NULL OR CHAR_LENGTH(release_notes) <= 1000),
  `created_by` LONGTEXT
    CHECK (created_by IS NULL OR CHAR_LENGTH(created_by) <= 320),  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT store_page_versions_page_id_version_number_key UNIQUE (page_id, version_number),
  CONSTRAINT store_page_versions_id_page_id_key UNIQUE (id, page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0010_storefront_page_persistence.sql
CREATE TABLE IF NOT EXISTS `store_page_drafts` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),  `page_id` VARCHAR(36) NOT NULL UNIQUE REFERENCES store_pages(id) ON DELETE CASCADE,
  `store_scope` VARCHAR(255) NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND TRIM(store_scope) <> '' AND CHAR_LENGTH(store_scope) <= 64),
  `schema_version` LONGTEXT NOT NULL
    CHECK (TRIM(schema_version) <> '' AND CHAR_LENGTH(schema_version) <= 32),  `draft_document` JSON NOT NULL
    CHECK (
      LOWER(JSON_TYPE(draft_document)) = 'object'
      AND JSON_CONTAINS_PATH(draft_document, 'one', '$.id')
      AND JSON_CONTAINS_PATH(draft_document, 'one', '$.schemaVersion')
      AND JSON_CONTAINS_PATH(draft_document, 'one', '$.root')
      AND LOWER(JSON_TYPE(JSON_EXTRACT(draft_document, '$.root'))) = 'array'
      AND OCTET_LENGTH(draft_document) <= 1048576
    ),  `draft_revision` int NOT NULL DEFAULT 1
    CHECK (draft_revision >= 1),  `base_published_version_id` VARCHAR(36),  `base_published_revision` int NOT NULL DEFAULT 0
    CHECK (base_published_revision >= 0),
  `state` LONGTEXT NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'archived')),
  `checksum` LONGTEXT NOT NULL
    CHECK (TRIM(checksum) <> '' AND CHAR_LENGTH(checksum) <= 128),
  `created_by` LONGTEXT
    CHECK (created_by IS NULL OR CHAR_LENGTH(created_by) <= 320),
  `last_edited_by` LONGTEXT
    CHECK (last_edited_by IS NULL OR CHAR_LENGTH(last_edited_by) <= 320),  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT store_page_drafts_base_version_same_page_fkey
    FOREIGN KEY (base_published_version_id, page_id)
    REFERENCES store_page_versions(id, page_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Source: 0010_storefront_page_persistence.sql
CREATE TABLE IF NOT EXISTS `store_page_publishing_events` (
`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),  `page_id` VARCHAR(36) NOT NULL REFERENCES store_pages(id) ON DELETE CASCADE,
  `store_scope` VARCHAR(255) NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND TRIM(store_scope) <> '' AND CHAR_LENGTH(store_scope) <= 64),
  `action_type` LONGTEXT NOT NULL
    CHECK (action_type IN ('publish', 'rollback')),  `published_version_id` VARCHAR(36) NOT NULL,  `previous_version_id` VARCHAR(36),  `published_revision` int NOT NULL
    CHECK (published_revision >= 1),  `draft_revision` int
    CHECK (draft_revision IS NULL OR draft_revision >= 1),
  `notes` LONGTEXT
    CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 1000),  `actor_id` VARCHAR(36),  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT store_page_publishing_events_published_version_same_page_fkey
    FOREIGN KEY (published_version_id, page_id)
    REFERENCES store_page_versions(id, page_id)
    ON DELETE RESTRICT,
  CONSTRAINT store_page_publishing_events_previous_version_same_page_fkey
    FOREIGN KEY (previous_version_id, page_id)
    REFERENCES store_page_versions(id, page_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
