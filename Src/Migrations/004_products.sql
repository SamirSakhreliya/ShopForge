-- ============================================================
-- Module: Products
-- Purpose: Items listed for sale within a tenant's storefront.
--          Inventory is tracked here; stock_quantity is decremented
--          atomically inside an order transaction. Product images
--          are stored in a child table to allow multiple images
--          per product.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS product_management;

CREATE TABLE product_management.products (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID           NOT NULL REFERENCES tenants_management.tenants (id)    ON DELETE CASCADE,
  category_id     UUID           REFERENCES category_management.categories (id)          ON DELETE SET NULL,
  name            VARCHAR(200)   NOT NULL,
  slug            VARCHAR(200)   NOT NULL,
  description     TEXT,
  price           NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  compare_price   NUMERIC(12, 2) CHECK (compare_price >= 0),         -- Original / crossed-out price
  cost_price      NUMERIC(12, 2) CHECK (cost_price >= 0),            -- Internal cost (not public)
  stock_quantity  INTEGER        NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sku             VARCHAR(100),
  barcode         VARCHAR(100),
  weight_grams    INTEGER        CHECK (weight_grams > 0),
  is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
  is_featured     BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_products_slug_tenant UNIQUE (tenant_id, slug),
  CONSTRAINT uq_products_sku_tenant  UNIQUE (tenant_id, sku)
);

-- FIFO ordering index (used by order service for fair queue processing)
CREATE INDEX idx_products_tenant       ON product_management.products (tenant_id);
CREATE INDEX idx_products_category     ON product_management.products (category_id);
CREATE INDEX idx_products_is_active    ON product_management.products (is_active);
CREATE INDEX idx_products_created_at   ON product_management.products (created_at ASC);  -- FIFO support
CREATE INDEX idx_products_is_featured  ON product_management.products (is_featured);

-- ============================================================
-- Product Images
-- Purpose: One-to-many image gallery per product. One image
--          is marked primary and displayed as the thumbnail.
-- ============================================================

CREATE TABLE product_management.product_images (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES product_management.products (id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants_management.tenants (id)  ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  alt_text    VARCHAR(200),
  sort_order  SMALLINT    NOT NULL DEFAULT 0,
  is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_management.product_images (product_id);
CREATE INDEX idx_product_images_primary ON product_management.product_images (product_id, is_primary);
