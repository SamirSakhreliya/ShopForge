-- ============================================================
-- Module: Tenants
-- Purpose: Top-level multi-tenancy scope. Every vendor who
--          opens a storefront is a tenant. All downstream tables
--          carry tenant_id referencing this table.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS tenants_management;

CREATE TYPE tenants_management.tenant_status AS ENUM ('active', 'suspended', 'pending_review');

CREATE TABLE tenants_management.tenants (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(120)  NOT NULL,
  slug             VARCHAR(80)   NOT NULL UNIQUE,           -- URL-safe storefront identifier
  logo_url         TEXT,
  contact_email    VARCHAR(255)  NOT NULL UNIQUE,
  contact_phone    VARCHAR(30),
  business_address TEXT,
  status           tenants_management.tenant_status NOT NULL DEFAULT 'pending_review',
  plan             VARCHAR(30)   NOT NULL DEFAULT 'free',   -- free | pro | enterprise
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug   ON tenants_management.tenants (slug);
CREATE INDEX idx_tenants_status ON tenants_management.tenants (status);
