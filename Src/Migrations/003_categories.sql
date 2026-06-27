-- ============================================================
-- Module: Categories
-- Purpose: Hierarchical product taxonomy scoped per tenant.
--          Supports one level of nesting via parent_id (e.g.
--          Electronics > Phones). Deeper trees can be modelled
--          by chaining parent_id but the UI/API supports one
--          level for MVP.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS category_management;

CREATE TABLE category_management.categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants_management.tenants (id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES category_management.categories (id) ON DELETE SET NULL,  -- NULL = root category
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description TEXT,
  image_url   TEXT,
  sort_order  SMALLINT    NOT NULL DEFAULT 0,               -- Controls display order in listings
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_categories_slug_tenant UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_categories_tenant    ON category_management.categories (tenant_id);
CREATE INDEX idx_categories_parent    ON category_management.categories (parent_id);
CREATE INDEX idx_categories_is_active ON category_management.categories (is_active);
