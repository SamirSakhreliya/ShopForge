# ShopForge Database — Schema Reference

> **Engine:** PostgreSQL 15  
> **Multi-tenancy model:** Row-level — every table (except `users` for SuperAdmin) carries a `tenant_id` UUID column that scopes all reads and writes to a single vendor's storefront.  
> **UUID generation:** `gen_random_uuid()` (pgcrypto / pg 13+)

---

## Module Map

| #   | Migration file                  | Tables defined                                  |
| --- | ------------------------------- | ----------------------------------------------- |
| 1   | `001_tenants.sql`               | `tenants`                                       |
| 2   | `002_users.sql`                 | `users`, `refresh_tokens`                       |
| 3   | `003_categories.sql`            | `categories`                                    |
| 4   | `004_products.sql`              | `products`, `product_images`                    |
| 5   | `005_orders.sql`                | `orders`, `order_items`, `order_status_history` |
| 6   | `006_app_settings.sql`          | `app_settings`, `notifications_log`             |
| 7   | `007_customer_vendor_links.sql` | `customer_vendor_links` (+ alters `users`)      |

---

## Entity Relationship Overview

```
tenants
  ├── users  (tenant_id → tenants.id; NULL for Customer + SuperAdmin, set for Vendor)
  │     ├── refresh_tokens  (user_id → users.id)
  │     └── customer_vendor_links  (customer_id → users.id, tenant_id → tenants.id)
  ├── categories  (tenant_id → tenants.id, parent_id → categories.id)
  ├── products  (tenant_id → tenants.id, category_id → categories.id)
  │     └── product_images  (product_id → products.id)
  ├── orders  (tenant_id → tenants.id, customer_id → users.id)
  │     ├── order_items  (order_id → orders.id, product_id → products.id)
  │     └── order_status_history  (order_id → orders.id, changed_by → users.id)
  ├── app_settings  (tenant_id → tenants.id)
  └── notifications_log  (tenant_id, user_id, order_id — all optional FKs)
```

---

## Module 1 — Tenants (`001_tenants.sql`)

### `tenants`

The root entity. Every vendor who opens a storefront is a tenant. The system is genuinely multi-tenant: TechGadgets Pro and Urban Threads are completely isolated — their customers, products, and orders never mix.

| Column             | Type                | Notes                                     |
| ------------------ | ------------------- | ----------------------------------------- |
| `id`               | UUID PK             | `gen_random_uuid()`                       |
| `name`             | VARCHAR(120)        | Display name of the storefront            |
| `slug`             | VARCHAR(80) UNIQUE  | URL-safe identifier (`techgadgets-pro`)   |
| `logo_url`         | TEXT                | Path to uploaded logo                     |
| `contact_email`    | VARCHAR(255) UNIQUE | Primary contact for the vendor            |
| `contact_phone`    | VARCHAR(30)         | Optional                                  |
| `business_address` | TEXT                | Optional                                  |
| `status`           | ENUM                | `active` · `suspended` · `pending_review` |
| `plan`             | VARCHAR(30)         | `free` · `pro` · `enterprise`             |
| `created_at`       | TIMESTAMPTZ         | Auto                                      |
| `updated_at`       | TIMESTAMPTZ         | Auto                                      |

**Use cases:**

- SuperAdmin lists all tenants and changes their `status` (e.g. suspends an abusive vendor).
- The slug becomes the subdomain or URL prefix: `shopforge.io/store/techgadgets-pro`.
- Plan gates feature access (e.g. only `pro`/`enterprise` tenants can use the Slack orders hook).

---

## Module 2 — Users & Auth (`002_users.sql`)

### `users`

Single table for all human actors. Role determines access level.

**Identity model (as of migration 7):** `tenant_id` is NULL for `Customer` and `SuperAdmin` — both have a single global account. Only `Vendor` carries a real `tenant_id`, since a vendor owns exactly one storefront. Customer ↔ Vendor shopping relationships live in `customer_vendor_links`, not on the user row.

| Column                     | Type                   | Notes                                                     |
| -------------------------- | ---------------------- | --------------------------------------------------------- |
| `id`                       | UUID PK                |                                                           |
| `tenant_id`                | UUID FK → `tenants.id` | NULL for Customer and SuperAdmin; set for Vendor          |
| `email`                    | VARCHAR(255)           | Globally unique per role (partial unique indexes)         |
| `password_hash`            | TEXT                   | bcrypt hash                                               |
| `role`                     | ENUM                   | `Customer` · `Vendor` · `SuperAdmin`                      |
| `first_name` / `last_name` | VARCHAR(80)            |                                                           |
| `phone`                    | VARCHAR(30)            | Optional                                                  |
| `avatar_url`               | TEXT                   |                                                           |
| `is_active`                | BOOLEAN                | Soft-disable without deleting                             |
| `is_email_verified`        | BOOLEAN                | Gates certain actions                                     |
| `preferred_language`       | CHAR(5)                | BCP-47 e.g. `en`, `ar` — maps to `req.preferred_language` |
| `last_login_at`            | TIMESTAMPTZ            | Updated on successful login                               |

**Use cases:**

- A Customer registers once and shops across every vendor storefront on the platform with the same account — no per-storefront signup.
- `Customer` and `SuperAdmin` each have a globally unique email enforced by partial unique indexes (`idx_users_customer_email`, `idx_users_superadmin_email`). `Vendor` email is likewise globally unique (`idx_users_vendor_email`).
- `authenticate` middleware decodes JWT → looks up this table → attaches `{ id, role, tenant_id }` to `req.user`. For Customer tokens, `tenant_id` is always `null`.

### `refresh_tokens`

Persisted tokens for JWT rotation. Enables logout-all-devices.

| Column        | Type                 | Notes                                |
| ------------- | -------------------- | ------------------------------------ |
| `user_id`     | UUID FK → `users.id` | Cascade delete                       |
| `token_hash`  | TEXT UNIQUE          | bcrypt hash of the raw refresh token |
| `device_info` | TEXT                 | User-agent string                    |
| `ip_address`  | INET                 |                                      |
| `expires_at`  | TIMESTAMPTZ          | Token TTL                            |
| `revoked_at`  | TIMESTAMPTZ          | NULL = still valid                   |

**Use cases:**

- On logout: `revoked_at = NOW()` for the specific token.
- On logout-all: delete all rows for `user_id`.
- Expired tokens are pruned by a `node-cron` job.

---

## Module 3 — Categories (`003_categories.sql`)

### `categories`

Hierarchical product taxonomy, scoped per tenant. MVP supports one level of nesting (root + children). Deeper nesting is possible via `parent_id` chaining.

| Column       | Type                      | Notes                                     |
| ------------ | ------------------------- | ----------------------------------------- |
| `tenant_id`  | UUID FK → `tenants.id`    | Cascade delete                            |
| `parent_id`  | UUID FK → `categories.id` | NULL = root category                      |
| `name`       | VARCHAR(100)              | Display name                              |
| `slug`       | VARCHAR(100)              | Unique within tenant                      |
| `sort_order` | SMALLINT                  | Controls display order in listings        |
| `is_active`  | BOOLEAN                   | Hidden from customer-facing APIs if FALSE |

**Use cases:**

- Vendor creates root category "Electronics", then adds child categories "Phones" and "Laptops".
- Product listing endpoint filters by `category_id` and traverses to parent for breadcrumb navigation.
- `is_active = FALSE` lets a vendor hide a seasonal category without deleting it and losing the product associations.

---

## Module 4 — Products (`004_products.sql`)

### `products`

Core catalogue entity. Stock is managed here with `stock_quantity`; the order service decrements it atomically inside a PostgreSQL transaction.

| Column           | Type                      | Notes                                    |
| ---------------- | ------------------------- | ---------------------------------------- |
| `tenant_id`      | UUID FK → `tenants.id`    |                                          |
| `category_id`    | UUID FK → `categories.id` | `SET NULL` on category delete            |
| `price`          | NUMERIC(12,2)             | Current selling price                    |
| `compare_price`  | NUMERIC(12,2)             | Crossed-out "was" price                  |
| `cost_price`     | NUMERIC(12,2)             | Internal — never exposed to customers    |
| `stock_quantity` | INTEGER ≥ 0               | Decremented on order placement           |
| `sku`            | VARCHAR(100)              | Unique per tenant                        |
| `is_active`      | BOOLEAN                   | Inactive products hidden from storefront |
| `is_featured`    | BOOLEAN                   | Promoted in homepage banners             |
| `created_at ASC` | Index                     | Supports FIFO queue ordering             |

**Use cases:**

- Redis caches product listings per tenant with a 5-minute TTL. Cache is invalidated when a product is created, updated, or deleted.
- `compare_price > price` triggers a sale badge on the storefront.
- Low-stock alert fires a Slack notification when `stock_quantity` drops below `app_settings.low_stock_threshold`.

### `product_images`

One-to-many gallery per product.

| Column       | Type                    | Notes                        |
| ------------ | ----------------------- | ---------------------------- |
| `product_id` | UUID FK → `products.id` | Cascade delete               |
| `is_primary` | BOOLEAN                 | Only one per product is TRUE |
| `sort_order` | SMALLINT                | Display order in gallery     |

**Use cases:**

- Multer handles image upload → stores file in `/uploads/{tenant_id}/` → saves URL here.
- Product listing queries use `WHERE is_primary = TRUE` to fetch the thumbnail without joining the full gallery.

---

## Module 5 — Orders (`005_orders.sql`)

### `orders`

Transactional core of the platform. All monetary values are snapshotted at checkout time.

**Status state machine:**

```
pending → confirmed → processing → shipped → delivered
   └─────────────────────────────────────────→ cancelled
                                     delivered → refunded
```

| Column                          | Type                   | Notes                                                              |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `tenant_id`                     | UUID FK → `tenants.id` | RESTRICT delete (can't delete tenant with orders)                  |
| `customer_id`                   | UUID FK → `users.id`   | RESTRICT delete                                                    |
| `status`                        | ENUM                   | Drives the state machine                                           |
| `payment_method`                | ENUM                   | `card` · `cash_on_delivery` · `wallet` · `bank_transfer`           |
| `payment_status`                | ENUM                   | `unpaid` · `paid` · `partially_refunded` · `refunded`              |
| `subtotal` … `total_amount`     | NUMERIC(12,2)          | Frozen at checkout                                                 |
| `shipping_*`                    | Various                | Shipping address snapshot (not linked to an address table for MVP) |
| `tracking_number`               | VARCHAR(120)           | Set when status → `shipped`                                        |
| `confirmed_at` … `delivered_at` | TIMESTAMPTZ            | Nullable — set on each transition                                  |

**Use cases:**

- Vendor dashboard lists orders using `WHERE tenant_id = $1 ORDER BY created_at ASC` (FIFO).
- Slack webhook fires on new order placement (non-blocking, via `errorNotifier` pattern).
- `ON DELETE RESTRICT` on `tenant_id` and `customer_id` prevents accidental data loss.

### `order_items`

Line-item snapshot per order. `unit_price` is frozen at purchase time.

| Column         | Type                    | Notes                                                |
| -------------- | ----------------------- | ---------------------------------------------------- |
| `product_id`   | UUID FK → `products.id` | `SET NULL` — deleted products don't break history    |
| `product_name` | VARCHAR(200)            | Snapshot of name at purchase                         |
| `subtotal`     | NUMERIC(12,2)           | `GENERATED ALWAYS AS (quantity * unit_price) STORED` |

**Use cases:**

- Invoice generation uses `order_items` + `orders` header — no live product lookup needed.
- `product_id = NULL` means the product was deleted after purchase; `product_name` still preserves the display value.

### `order_status_history`

Immutable append-only audit log of every status transition.

| Column        | Type                 | Notes                    |
| ------------- | -------------------- | ------------------------ |
| `from_status` | ENUM                 | NULL on first insert     |
| `to_status`   | ENUM                 | New status               |
| `changed_by`  | UUID FK → `users.id` | SET NULL if user deleted |

**Use cases:**

- Customer support traces the exact timeline of any order.
- Dispute resolution: proves when an order was shipped relative to a complaint.

---

## Module 6 — App Settings & Notifications (`006_app_settings.sql`)

### `app_settings`

Key-value runtime configuration, scoped to tenant or platform.

| Column      | Type         | Notes                                     |
| ----------- | ------------ | ----------------------------------------- |
| `tenant_id` | UUID FK      | NULL = platform-wide setting              |
| `key`       | VARCHAR(120) | Unique per `(tenant_id, key)`             |
| `is_public` | BOOLEAN      | Safe to expose via public storefront APIs |

**Use cases:**

- Tenant-level: `currency`, `theme_color`, `slack_orders_hook`, `low_stock_threshold`.
- Platform-level: `platform_version`, `maintenance_mode`.
- The maintenance mode flag is read at API gateway level to return 503 for non-admin routes.

### `notifications_log`

Persistent record of every outbound notification.

| Column     | Type    | Notes                                       |
| ---------- | ------- | ------------------------------------------- |
| `channel`  | ENUM    | `slack` · `email` · `sms` · `push`          |
| `status`   | ENUM    | `queued` · `sent` · `failed` · `suppressed` |
| `order_id` | UUID FK | Optional — links notification to an order   |

**Use cases:**

- Retry logic: a cron job picks up `status = 'queued'` or `status = 'failed'` rows and re-sends.
- Deduplication: before firing a Slack alert, check for a recent `sent` entry to avoid spamming.
- Support can audit exactly which notifications a customer received for a given order.

---

## Module 7 — Customer-Vendor Links (`007_customer_vendor_links.sql`)

### `customer_vendor_links`

Many-to-many join between global Customer accounts and the Vendor storefronts (tenants) they've interacted with. Created when this migration reworked Customer identity from tenant-scoped to platform-global.

| Column                            | Type                   | Notes                                 |
| --------------------------------- | ---------------------- | ------------------------------------- |
| `customer_id`                     | UUID FK → `users.id`   | Cascade delete                        |
| `tenant_id`                       | UUID FK → `tenants.id` | Cascade delete                        |
| `first_interaction_at`            | TIMESTAMPTZ            | When the relationship was established |
| `UNIQUE (customer_id, tenant_id)` |                        | One row per customer-vendor pair      |

**Use cases:**

- Created on customer registration (if `tenant_id` supplied) or via `authService.linkCustomerToVendor()` on a customer's first order/visit at a storefront.
- Vendor dashboard can query "my customers" via `WHERE tenant_id = $1` without scanning the global `users` table.
- Lets a single customer buy from multiple independent vendors with one login, while still letting each vendor see their own customer list.

---

## Cross-Cutting Conventions

### Tenant isolation

Every query in a service layer **must** include `WHERE tenant_id = $tenantId`. The `authenticate` middleware injects `req.user.tenant_id`; controllers pass it down to services — never trust a tenant_id from the request body.

### Soft deletes

Products and categories use `is_active = FALSE` rather than hard deletes to preserve historical order references.

### Price precision

All monetary columns use `NUMERIC(12, 2)` — never `FLOAT` — to avoid floating-point rounding errors.

### FIFO ordering

The `idx_products_created_at` and `idx_orders_tenant_status` indexes both include `created_at ASC` to support fair, oldest-first queue processing with efficient index scans.

### Timestamp convention

All timestamps are `TIMESTAMPTZ` (timezone-aware UTC). Application layer converts to user's local timezone for display only.
