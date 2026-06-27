-- ============================================================
-- Module: Users / Auth
-- Purpose: All human actors in the system — customers who shop,
--          vendors who manage storefronts, and super-admins who
--          oversee the whole platform. A single table; role column
--          drives access control.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS user_management;

CREATE TYPE user_management.user_role AS ENUM ('Customer', 'Vendor', 'SuperAdmin');

CREATE TABLE user_management.users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        REFERENCES tenants_management.tenants (id) ON DELETE CASCADE,
                                -- NULL only for SuperAdmin (platform-level, no tenant)
  email             VARCHAR(255) NOT NULL,
  password_hash     TEXT         NOT NULL,
  role              user_management.user_role    NOT NULL DEFAULT 'Customer',
  first_name        VARCHAR(80)  NOT NULL,
  last_name         VARCHAR(80)  NOT NULL,
  phone             VARCHAR(30),
  avatar_url        TEXT,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  is_email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
  preferred_language CHAR(5)     NOT NULL DEFAULT 'en',    -- BCP-47 tag e.g. 'en', 'ar', 'fr'
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Email must be unique within a tenant (customers of different storefronts
  -- may reuse the same email address)
  CONSTRAINT uq_users_email_tenant UNIQUE (tenant_id, email)
);

-- SuperAdmin has no tenant so their email must be globally unique
CREATE UNIQUE INDEX idx_users_superadmin_email
  ON user_management.users (email)
  WHERE role = 'SuperAdmin';

CREATE INDEX idx_users_tenant    ON user_management.users (tenant_id);
CREATE INDEX idx_users_role      ON user_management.users (role);
CREATE INDEX idx_users_is_active ON user_management.users (is_active);

-- ============================================================
-- Module: Refresh Tokens (Auth)
-- Purpose: Persisted refresh tokens for JWT rotation. Enables
--          logout-all-devices and token revocation.
-- ============================================================

CREATE TABLE user_management.refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES user_management.users (id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,                  -- bcrypt hash of the raw token
  device_info TEXT,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user    ON user_management.refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON user_management.refresh_tokens (expires_at);
