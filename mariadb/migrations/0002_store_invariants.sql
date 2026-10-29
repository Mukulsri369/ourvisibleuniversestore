CREATE TABLE IF NOT EXISTS app_roles (
  user_id VARCHAR(36) NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL CHECK(role IN ('owner','admin')),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(user_id,role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
ALTER TABLE products ADD COLUMN IF NOT EXISTS affiliate_url LONGTEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS retailer LONGTEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS retailer_product_id LONGTEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_ids JSON NOT NULL DEFAULT '[]';
ALTER TABLE site_settings ALTER COLUMN affiliate_disclosure SET DEFAULT 'Our Visible Universe participates in affiliate programs from Amazon, Flipkart and other retailers. We may earn a commission from qualifying purchases made through our links, at no extra cost to you.';

CREATE TABLE IF NOT EXISTS product_categories (
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id VARCHAR(36) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  position INT UNSIGNED NOT NULL,
  PRIMARY KEY(product_id,category_id), UNIQUE(product_id,position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS affiliate_url_locks (
  url_sha256 CHAR(64) PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS store_admin_audit (
  id VARCHAR(36) PRIMARY KEY DEFAULT(UUID()),
  actor_id VARCHAR(36) NOT NULL REFERENCES auth_user(id),
  action VARCHAR(64) NOT NULL, entity_id VARCHAR(36), details JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

ALTER TABLE store_pages ADD FOREIGN KEY IF NOT EXISTS store_pages_published_version_same_page_fkey
  (published_version_id,id) REFERENCES store_page_versions(id,page_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS products_public_idx ON products(active,deleted_at,created_at);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS product_images_pid ON product_images(product_id,sort_order);
CREATE INDEX IF NOT EXISTS product_features_pid ON product_features(product_id,sort_order);
CREATE INDEX IF NOT EXISTS product_tags_pid ON product_tags(product_id);
CREATE INDEX IF NOT EXISTS product_tags_tag ON product_tags(tag);
CREATE INDEX IF NOT EXISTS outbound_clicks_pid ON outbound_clicks(product_id);
CREATE INDEX IF NOT EXISTS store_page_versions_page_created ON store_page_versions(page_id,created_at);
CREATE INDEX IF NOT EXISTS store_page_publishing_events_page_created ON store_page_publishing_events(page_id,created_at);
