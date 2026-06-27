-- ============================================================
-- Module: Orders
-- Purpose: Core transactional module. An order belongs to one
--          customer within one tenant's storefront. order_items
--          capture a snapshot of unit_price at purchase time so
--          future product price changes do not affect historical
--          records. Stock is decremented atomically when the
--          order is placed. Status follows a strict state machine.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS order_management;

CREATE TYPE order_management.order_status AS ENUM (
  'pending',      -- placed but not yet confirmed by vendor
  'confirmed',    -- vendor has accepted the order
  'processing',   -- being prepared / packed
  'shipped',      -- handed to courier
  'delivered',    -- customer confirmed receipt
  'cancelled',    -- cancelled before shipping
  'refunded'      -- post-delivery refund issued
);

CREATE TYPE order_management.payment_method AS ENUM ('card', 'cash_on_delivery', 'wallet', 'bank_transfer');
CREATE TYPE order_management.payment_status AS ENUM ('unpaid', 'paid', 'partially_refunded', 'refunded');

CREATE TABLE order_management.orders (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID           NOT NULL REFERENCES tenants_management.tenants (id) ON DELETE RESTRICT,
  customer_id         UUID           NOT NULL REFERENCES user_management.users (id) ON DELETE RESTRICT,
  status              order_management.order_status   NOT NULL DEFAULT 'pending',
  payment_method      order_management.payment_method NOT NULL DEFAULT 'cash_on_delivery',
  payment_status      order_management.payment_status NOT NULL DEFAULT 'unpaid',

  -- Totals snapshotted at checkout
  subtotal            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_fee        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Shipping
  shipping_name       VARCHAR(120),
  shipping_phone      VARCHAR(30),
  shipping_address    TEXT,
  shipping_city       VARCHAR(80),
  shipping_country    CHAR(2),                               -- ISO 3166-1 alpha-2
  shipping_zip        VARCHAR(20),
  tracking_number     VARCHAR(120),

  notes               TEXT,
  internal_notes      TEXT,                                  -- Vendor-only notes
  cancelled_reason    TEXT,

  -- Timestamps for each state transition (nullable = not yet reached)
  confirmed_at        TIMESTAMPTZ,
  shipped_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- FIFO queue: vendor lists pending orders oldest-first
CREATE INDEX idx_orders_tenant_status   ON order_management.orders (tenant_id, status, created_at ASC);
CREATE INDEX idx_orders_customer        ON order_management.orders (customer_id);
CREATE INDEX idx_orders_payment_status  ON order_management.orders (payment_status);

-- ============================================================
-- Order Items
-- Purpose: Line items of an order. unit_price is frozen at the
--          moment of purchase. product_id is a soft reference —
--          the FK is nullable so deleted products do not break
--          historical order records.
-- ============================================================

CREATE TABLE order_management.order_items (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID           NOT NULL REFERENCES order_management.orders (id)  ON DELETE CASCADE,
  tenant_id    UUID           NOT NULL REFERENCES tenants_management.tenants (id) ON DELETE RESTRICT,
  product_id   UUID           REFERENCES product_management.products (id)         ON DELETE SET NULL,  -- soft reference
  product_name VARCHAR(200)   NOT NULL,                        -- snapshot of name at purchase
  product_sku  VARCHAR(100),
  quantity     INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal     NUMERIC(12, 2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON order_management.order_items (order_id);
CREATE INDEX idx_order_items_product ON order_management.order_items (product_id);

-- ============================================================
-- Order Status History
-- Purpose: Immutable audit log of every status transition on
--          an order. Used for support, disputes, and analytics.
-- ============================================================

CREATE TABLE order_management.order_status_history (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID         NOT NULL REFERENCES order_management.orders (id) ON DELETE CASCADE,
  tenant_id   UUID         NOT NULL REFERENCES tenants_management.tenants (id) ON DELETE RESTRICT,
  from_status order_management.order_status,                                    -- NULL on initial insert
  to_status   order_management.order_status NOT NULL,
  changed_by  UUID         REFERENCES user_management.users (id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_history_order ON order_management.order_status_history (order_id, created_at ASC);
