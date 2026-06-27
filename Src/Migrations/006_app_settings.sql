-- ============================================================
-- Module: App Settings
-- Purpose: Key-value store for per-tenant runtime configuration
--          (e.g. storefront theme colour, currency, default
--          language, notification preferences). Values are stored
--          as TEXT; the application layer handles type coercion.
--          Platform-level settings use tenant_id = NULL.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS app_management;

CREATE TABLE app_management.app_settings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        REFERENCES tenants_management.tenants (id) ON DELETE CASCADE,
                          -- NULL = platform-wide setting (SuperAdmin scope)
  key         VARCHAR(120) NOT NULL,
  value       TEXT,
  description TEXT,
  is_public   BOOLEAN     NOT NULL DEFAULT FALSE,  -- Whether customer-facing APIs can read this
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_app_settings_tenant_key UNIQUE (tenant_id, key)
);

CREATE INDEX idx_app_settings_tenant ON app_management.app_settings (tenant_id);

-- ============================================================
-- Module: Notifications Log
-- Purpose: Persistent record of every outbound notification
--          (Slack alert, email, SMS). Useful for debugging
--          delivery failures and auditing alert history.
-- ============================================================

CREATE TYPE app_management.notification_channel AS ENUM ('slack', 'email', 'sms', 'push');
CREATE TYPE app_management.notification_status  AS ENUM ('queued', 'sent', 'failed', 'suppressed');

CREATE TABLE app_management.notifications_log (
  id          UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID                  REFERENCES tenants_management.tenants (id) ON DELETE SET NULL,
  user_id     UUID                  REFERENCES user_management.users (id) ON DELETE SET NULL,
  order_id    UUID                  REFERENCES order_management.orders (id)  ON DELETE SET NULL,
  channel     app_management.notification_channel  NOT NULL,
  status      app_management.notification_status   NOT NULL DEFAULT 'queued',
  subject     VARCHAR(255),
  body        TEXT,
  error_msg   TEXT,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_tenant  ON app_management.notifications_log (tenant_id);
CREATE INDEX idx_notifications_order   ON app_management.notifications_log (order_id);
CREATE INDEX idx_notifications_status  ON app_management.notifications_log (status);
CREATE INDEX idx_notifications_channel ON app_management.notifications_log (channel);
