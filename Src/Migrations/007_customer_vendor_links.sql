-- ============================================================
-- Module: Customer Identity Rework + Customer-Vendor Links
-- Purpose: ShopForge customers get ONE global account across the
--          whole platform, instead of a separate account per vendor
--          storefront. A many-to-many table tracks which vendors a
--          given customer has an established relationship with
--          (registered on their storefront, or placed a first order),
--          without tying the customer's identity/uniqueness to a
--          single tenant_id.
--
--          Vendors are unaffected — a Vendor still owns exactly one
--          tenant (their storefront), so tenant_id remains their
--          scoping key.
-- ============================================================

-- 1. Drop the per-tenant email uniqueness constraint. Customer email
--    uniqueness becomes global (see partial index below).
ALTER TABLE user_management.users
  DROP CONSTRAINT uq_users_email_tenant;

-- 2. Global uniqueness for Customer email — mirrors the existing
--    SuperAdmin partial index (idx_users_superadmin_email).
CREATE UNIQUE INDEX idx_users_customer_email
  ON user_management.users (email)
  WHERE role = 'Customer';

-- 3. Global uniqueness for Vendor email. NOTE: this also fixes a
--    latent bug — loginVendor already queried by email + role only
--    (no tenant_id filter), so two Vendor rows under different
--    tenants with the same email could previously have matched the
--    same query without this constraint.
CREATE UNIQUE INDEX idx_users_vendor_email
  ON user_management.users (email)
  WHERE role = 'Vendor';

-- ============================================================
-- Customer <-> Vendor relationship table
-- ============================================================
CREATE TABLE user_management.customer_vendor_links (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID        NOT NULL REFERENCES user_management.users (id) ON DELETE CASCADE,
  tenant_id             UUID        NOT NULL REFERENCES tenants_management.tenants (id) ON DELETE CASCADE,
  first_interaction_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_customer_vendor UNIQUE (customer_id, tenant_id)
);

CREATE INDEX idx_cvl_customer ON user_management.customer_vendor_links (customer_id);
CREATE INDEX idx_cvl_tenant   ON user_management.customer_vendor_links (tenant_id);

-- ============================================================
-- Backfill: existing Customer rows already carry a tenant_id from
-- the old per-storefront model. Preserve that relationship in the
-- new link table, then clear tenant_id on the user row since
-- identity is no longer tenant-scoped.
-- ============================================================
INSERT INTO user_management.customer_vendor_links (customer_id, tenant_id)
SELECT id, tenant_id
FROM user_management.users
WHERE role = 'Customer' AND tenant_id IS NOT NULL
ON CONFLICT (customer_id, tenant_id) DO NOTHING;

UPDATE user_management.users
SET tenant_id = NULL
WHERE role = 'Customer';
