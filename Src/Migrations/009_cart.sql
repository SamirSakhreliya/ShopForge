-- ============================================================
-- Module: Cart (KAN-25)
-- Purpose: Pre-checkout shopping cart. One cart per Customer
--          (global identity — see 007_customer_vendor_links.sql),
--          holding items that may belong to MULTIPLE different
--          vendors at once. At checkout, Order.Service splits the
--          cart into one order PER TENANT (order_management.orders
--          still requires exactly one tenant_id per order) — see
--          the "Cart & Checkout" section of CLAUDE.md.
--
--          Unlike order_items (which snapshot product_name/sku/
--          unit_price so history survives product edits/deletes),
--          cart_items intentionally do NOT snapshot anything —
--          a cart is a live, pre-purchase intent, not a historical
--          record, so it should always reflect current product
--          data. That's why cart_items.product_id is a hard
--          ON DELETE CASCADE (not the nullable soft reference used
--          by order_items.product_id): if a product is deleted,
--          any cart line referencing it should simply disappear.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS cart_management;

CREATE TABLE cart_management.carts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        NOT NULL REFERENCES user_management.users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One cart per customer — simpler than a cart-session model for MVP.
  -- Global Customer identity (007) means this cart is already shared
  -- across every vendor storefront, which is exactly what lets a single
  -- checkout span multiple vendors.
  CONSTRAINT uq_carts_customer UNIQUE (customer_id)
);

CREATE TABLE cart_management.cart_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID        NOT NULL REFERENCES cart_management.carts (id)            ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES product_management.products (id)      ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants_management.tenants (id)       ON DELETE CASCADE,
                          -- Denormalized from products.tenant_id so checkout can
                          -- GROUP BY tenant_id (split into one order per vendor)
                          -- without an extra join per row.
  quantity    INTEGER     NOT NULL CHECK (quantity > 0),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Adding a product already in the cart merges quantities rather than
  -- creating a duplicate row — see CartService.addItem().
  CONSTRAINT uq_cart_items_cart_product UNIQUE (cart_id, product_id)
);

CREATE INDEX idx_cart_items_cart    ON cart_management.cart_items (cart_id);
CREATE INDEX idx_cart_items_product ON cart_management.cart_items (product_id);
CREATE INDEX idx_cart_items_tenant  ON cart_management.cart_items (tenant_id);
