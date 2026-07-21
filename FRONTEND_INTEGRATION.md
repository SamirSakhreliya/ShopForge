# ShopForge — Frontend Integration Guide

> **Last updated:** 2026-07-09 (KAN-25: Cart & Orders module + Vendor Settings follow-up)
> **Update this file whenever a new endpoint ships, an existing one changes shape, or a
> module moves from "planned" to "implemented."** Add a new `##` section per feature/module
> rather than editing old sections away — frontend engineers may be mid-integration against
> an older section. Bump the "Last updated" line and note the ticket ID above.

---

## 1. Basics

**Base URL (dev):** `http://localhost:4000` (`PORT` in `.env`, default `4000`)

**API versioning:** endpoints are split across two prefixes that do **not** correspond to
chronological versions — they're currently used to separate audiences:

- `/api/v2/...` — Customer-facing / public endpoints
- `/api/v1/...` — Vendor and SuperAdmin endpoints

Don't assume v2 is "newer" than v1; both are actively maintained. Always use the exact
prefix shown in the endpoint reference below.

**Response envelope** — every response (success or error) follows this shape:

```json
// Success
{ "success": true, "message": "Human-readable message", "data": { ... } }

// Error
{ "success": false, "message": "Human-readable error message", "data": {} }
```

Always check `success`, not just HTTP status — but HTTP status codes are also meaningful
(400 validation, 401 auth, 403 forbidden, 404 not found, 409 conflict, 500 server error).

**Auth header:** for any endpoint marked 🔒 below, send:

```
Authorization: Bearer <token>
```

The `token` comes from a login (or refresh) response's `data.token`. **Access tokens are
short-lived — 15 minutes.** See §2.4 below for how to stay logged in past that.

**Interactive API docs:** `GET /docs` (Swagger UI) always reflects the latest routes.

---

## 2. Auth module

Three separate identities, each with its own login: **Customer**, **Vendor**, **SuperAdmin**.
`data.user.role` in a login/refresh response tells you which one you got.

### 2.1 Customer (global account — works across every vendor storefront)

| Method | Path                     | Auth | Notes                                    |
| ------ | ------------------------ | ---- | ---------------------------------------- |
| POST   | `/api/v2/users/register` | —    | `tenant_id` optional — see below         |
| POST   | `/api/v2/users/login`    | —    | Returns `{ token, refresh_token, user }` |

Register body:

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "password": "at-least-8-chars",
  "tenant_id": "optional-vendor-storefront-uuid",
  "phone": "optional"
}
```

`tenant_id` is **optional** — omit it entirely, or send an empty string; both are treated
as "not provided." A Customer account is global: one login works on every vendor's
storefront. Only pass `tenant_id` if the customer is signing up _from_ a specific vendor's
storefront page — doing so auto-links them to that vendor (visible to the vendor as a known
customer) without scoping their account to it.

### 2.2 Vendor (creates a storefront + login in one call)

| Method | Path                      | Auth | Notes                                                |
| ------ | ------------------------- | ---- | ---------------------------------------------------- |
| POST   | `/api/v1/vendor/register` | —    | Creates a tenant (storefront) + vendor user together |
| POST   | `/api/v1/vendor/login`    | —    | Returns `{ token, refresh_token, user }`             |

Register body requires `store_name` and `store_slug` (URL-safe, lowercase, hyphenated) in
addition to the usual name/email/password fields — see `/docs` for the full schema. New
storefronts start in `pending_review` status.

### 2.3 SuperAdmin

| Method | Path                       | Auth | Notes                                  |
| ------ | -------------------------- | ---- | -------------------------------------- |
| POST   | `/api/v1/superadmin/login` | —    | No register endpoint (seeded manually) |

### 2.4 Refresh & logout — identical behavior under all three prefixes

Every login response now returns **two** tokens:

```json
{
  "token": "eyJhbGciOi...", // access token — 15 minutes, send as Authorization: Bearer
  "refresh_token": "9f3a1c...", // opaque random string — 30 days, keep it secret, never decode it
  "user": { "...": "..." }
}
```

When the access token expires (any 🔒 endpoint starts returning 401), call refresh instead
of forcing the user to log in again:

| Method | Path                         | Notes                               |
| ------ | ---------------------------- | ----------------------------------- |
| POST   | `/api/v2/users/refresh`      | Customer                            |
| POST   | `/api/v1/vendor/refresh`     | Vendor                              |
| POST   | `/api/v1/superadmin/refresh` | SuperAdmin                          |
| POST   | `/api/v2/users/logout`       | Customer — revoke one refresh token |
| POST   | `/api/v1/vendor/logout`      | Vendor                              |
| POST   | `/api/v1/superadmin/logout`  | SuperAdmin                          |

Refresh body: `{ "refresh_token": "..." }` → response is a **brand-new** `{ token,
refresh_token, user }` pair.

**Important — refresh tokens rotate on every use.** The old refresh token is revoked the
moment you call `/refresh`, and you get a new one back. Always overwrite your stored
`refresh_token` with the new value from the response — reusing an old one will fail with 401. This means only one "session" per stored refresh token can advance at a time; don't
call `/refresh` from two places concurrently with the same stored token.

Logout body: `{ "refresh_token": "..." }` → revokes that one token (that device/session
only). This endpoint always returns success, even if the token was already invalid, so it
can't be used to probe for valid tokens.

There is currently no "logout all devices" endpoint and no way to list a user's active
sessions — only single-token revoke.

### 2.5 Email verification (manual review — no email sending yet)

`is_email_verified` starts `false` for every new account. There's no automated email flow
yet — verification is a manual request/approve workflow:

| Method | Path                                                      | Auth          | Notes                                 |
| ------ | --------------------------------------------------------- | ------------- | ------------------------------------- |
| POST   | `/api/v2/users/verify-email/request`                      | 🔒 Customer   | Queues a request                      |
| POST   | `/api/v1/vendor/verify-email/request`                     | 🔒 Vendor     | Queues a request                      |
| GET    | `/api/v1/superadmin/verify-email/requests?status=pending` | 🔒 SuperAdmin | List queue (status filter optional)   |
| POST   | `/api/v1/superadmin/verify-email/requests/:id/approve`    | 🔒 SuperAdmin | Sets `is_email_verified = true`       |
| POST   | `/api/v1/superadmin/verify-email/requests/:id/reject`     | 🔒 SuperAdmin | Body: `{ "note": "optional reason" }` |

Request endpoints take no body — the user is identified from their access token. Calling
it again while a request is still `pending` returns `409`; calling it once already verified
returns `400`. After a rejection, the user can submit a new request.

There's no UI-facing way for a Customer/Vendor to check their own request status yet —
frontend should track `is_email_verified` on the user object (refreshed via `/login` or
`/refresh`) to know when a pending request has been approved.

---

## 3. Products module

Two different "views" of the same catalogue — pick the one matching your audience.

### 3a. Public / Customer browse — `/api/v2/products`

No auth required. Only returns products where `is_active = true` **and** the owning
storefront is `active`. Never includes `cost_price` or other vendor-internal fields.

| Method | Path                   | Notes                                 |
| ------ | ---------------------- | ------------------------------------- |
| GET    | `/api/v2/products`     | List + filter (see below)             |
| GET    | `/api/v2/products/:id` | Single product detail + image gallery |

**All filters are optional** — calling `GET /api/v2/products` with no query params returns
the entire public catalogue (paginated, newest first). Available query params:

| Param                     | Type    | Default  | Notes                                              |
| ------------------------- | ------- | -------- | -------------------------------------------------- |
| `tenant_id`               | uuid    | —        | Scope to one vendor's storefront                   |
| `category_id`             | uuid    | —        |                                                    |
| `min_price` / `max_price` | number  | —        |                                                    |
| `search`                  | string  | —        | Matches product name or description                |
| `sort`                    | enum    | `newest` | `price_asc` / `price_desc` / `newest` / `featured` |
| `page`                    | integer | `1`      |                                                    |
| `limit`                   | integer | `20`     | Max `100`                                          |

Response `data` shape:

```json
{
  "items": [
    {
      "id": "...",
      "name": "...",
      "price": 899.99,
      "primary_image_url": "/uploads/products/...",
      "...": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

Results are cached server-side for 5 minutes per unique filter combination — expect
slightly-stale data (never more than 5 min) rather than a fully live read on every request.

### 3b. Vendor catalogue — `/api/v1/vendor/products` 🔒 (Vendor role)

Scoped to the logged-in vendor's own storefront. Every status is visible (including
inactive products), plus `cost_price`, `sku`, `barcode`, and live `stock_quantity`. Never
cached — always a live DB read.

| Method | Path                                                  | Notes                                                                             |
| ------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/api/v1/vendor/products`                             | List + filter (adds `is_active`, `is_featured`, `stock_low`/`stock_high` sort)    |
| GET    | `/api/v1/vendor/products/:id`                         | Single product (own tenant only)                                                  |
| POST   | `/api/v1/vendor/products`                             | Create (`slug` auto-generated from `name` if omitted)                             |
| PUT    | `/api/v1/vendor/products/:id`                         | Partial update (any subset of create fields)                                      |
| DELETE | `/api/v1/vendor/products/:id`                         | Hard delete (safe — past orders keep a name/price snapshot)                       |
| POST   | `/api/v1/vendor/products/:id/images`                  | Upload image — `multipart/form-data`, field name **`image`**                      |
| DELETE | `/api/v1/vendor/products/:id/images/:imageId`         | Delete image (auto-promotes next image to primary if the deleted one was primary) |
| PATCH  | `/api/v1/vendor/products/:id/images/:imageId/primary` | Set an image as the thumbnail                                                     |

Image upload accepts `image/jpeg`, `image/png`, `image/webp`, `image/gif`, max 5MB. Uploaded
images are served back at whatever `url` comes back in the response (relative path under
`/uploads/products/...` — prefix with the API base URL to get a full image URL).

---

## 4. Categories module

Mirrors the Products module's public/vendor split, and adds one convenience endpoint for
bulk setup.

### 4a. Public / Customer browse — `/api/v2/categories`

No auth required. Only active categories belonging to active storefronts.

| Method | Path                     | Notes                                                             |
| ------ | ------------------------ | ----------------------------------------------------------------- |
| GET    | `/api/v2/categories`     | Filters: `tenant_id`, `parent_id`, `page`, `limit` (all optional) |
| GET    | `/api/v2/categories/:id` | Single category detail                                            |

### 4b. Vendor catalogue — `/api/v1/vendor/categories` 🔒 (Vendor role)

| Method | Path                             | Notes                                                           |
| ------ | -------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/v1/vendor/categories`      | Filters: `parent_id`, `is_active`, `page`, `limit`              |
| GET    | `/api/v1/vendor/categories/:id`  | Single category (own tenant only)                               |
| POST   | `/api/v1/vendor/categories`      | Create (`slug` auto-generated from `name` if omitted)           |
| PUT    | `/api/v1/vendor/categories/:id`  | Partial update                                                  |
| DELETE | `/api/v1/vendor/categories/:id`  | Hard delete — safe, children/products just become uncategorized |
| POST   | `/api/v1/vendor/categories/bulk` | **Create a category + multiple products in one call**           |

`POST /api/v1/vendor/categories/bulk` body:

```json
{
  "category": { "name": "Summer Collection", "description": "..." },
  "products": [
    { "name": "Beach Towel", "price": 19.99, "stock_quantity": 50 },
    { "name": "Sun Hat", "price": 24.5, "stock_quantity": 30 }
  ]
}
```

This is atomic — either the category and every product are created, or (e.g. a duplicate
SKU on product #2) nothing is created and the whole call fails with `409`. Response `data`
is `{ category, products: [...] }`. Only one level of category nesting is supported
(`parent_id`), matching the existing category schema.

---

## 5. Cart & Orders module (KAN-25)

### 5a. Cart — `/api/v2/cart` 🔒 (Customer role)

A Customer has exactly **one cart**, and — because Customer identity is global — that one
cart can hold items from **multiple different vendors at once**. Checkout later splits it into
one order per vendor (see §5b).

| Method | Path                            | Notes                                                   |
| ------ | ------------------------------- | ------------------------------------------------------- |
| GET    | `/api/v2/cart`                  | Cart contents, grouped by vendor, with live price/stock |
| POST   | `/api/v2/cart/items`            | Add a product (merges quantity if already in cart)      |
| PUT    | `/api/v2/cart/items/:productId` | Set the quantity of one line                            |
| DELETE | `/api/v2/cart/items/:productId` | Remove one line                                         |
| DELETE | `/api/v2/cart`                  | Empty the entire cart                                   |

`POST /api/v2/cart/items` body: `{ "product_id": "uuid", "quantity": 1 }` (`quantity` defaults
to `1`). Returns `409` if the requested quantity exceeds live `stock_quantity` — this is a
soft/early check; the authoritative, race-free check happens again at checkout.

`GET /api/v2/cart` response `data` shape:

```json
{
  "cart_id": "...",
  "items": [
    {
      "product_id": "...",
      "tenant_id": "...",
      "quantity": 2,
      "price": 19.99,
      "...": "..."
    }
  ],
  "vendors": [
    {
      "tenant_id": "...",
      "store_name": "...",
      "items": ["..."],
      "subtotal": 39.98
    }
  ],
  "subtotal": 39.98
}
```

### 5b. Checkout — `POST /api/v2/orders/checkout` 🔒 (Customer role)

Checks out the **entire** cart. If the cart spans multiple vendors, this creates **one order
per vendor**, atomically — either every vendor's order is created, or (e.g. one vendor's item
just went out of stock) none is, and the whole cart is left untouched.

Body:

```json
{
  "shipping_name": "Jane Doe",
  "shipping_phone": "+1-415-555-0100",
  "shipping_address": "301 Green St, Apt 4B",
  "shipping_city": "San Francisco",
  "shipping_country": "US",
  "shipping_zip": "94133",
  "payment_method": "cash_on_delivery",
  "notes": "optional"
}
```

All shipping fields are required; `payment_method` defaults to `cash_on_delivery` if omitted
(one of `card` / `cash_on_delivery` / `wallet` / `bank_transfer`). Response `data.orders` is
**always an array**, even when the cart only had one vendor's items in it. Returns `400` if the
cart is empty, `409` if any line item is no longer available or out of stock (nothing is
created in that case — try again after adjusting the cart).

The owning vendor(s) get a Slack alert per created order automatically — no frontend action
needed.

### 5c. Customer order history — `/api/v2/orders` 🔒 (Customer role)

| Method | Path                 | Notes                                                                                     |
| ------ | -------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/api/v2/orders`     | Every order across every vendor, newest first. Optional `?status=` filter, `page`/`limit` |
| GET    | `/api/v2/orders/:id` | One order's detail — items + status history                                               |

There is currently **no customer-initiated cancel endpoint** — cancellation is vendor-side only
(see §5d). If you need a "cancel my order" button, it isn't wired up yet.

### 5d. Vendor order processing — `/api/v1/vendor/orders` 🔒 (Vendor role)

| Method | Path                               | Notes                                                                                              |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/vendor/orders`            | The vendor's own orders, **oldest first** (FIFO queue). Optional `?status=` filter, `page`/`limit` |
| GET    | `/api/v1/vendor/orders/:id`        | One order's detail — items + status history (includes vendor-only `internal_notes`)                |
| PATCH  | `/api/v1/vendor/orders/:id/status` | Transition the order to a new status                                                               |

`PATCH .../status` body: `{ "status": "confirmed", "note": "optional", "tracking_number": "optional, relevant when status = shipped" }`.

Allowed transitions (anything else returns `400`):

```
pending → confirmed → processing → shipped → delivered
   └───────────────────────────────────────→ cancelled   (not after shipped)
                                   delivered → refunded
```

Cancelling an order automatically restocks every line item back onto its product.

---

## 6. Vendor Settings module (KAN-25 follow-up) — `/api/v1/vendor/settings` 🔒 (Vendor role)

Lets a vendor manage a small allow-listed set of their own `app_settings` — most notably
`slack_orders_hook`, which controls where §5's "new order" Slack alert gets sent for their
storefront specifically (falls back to the platform's shared webhook if unset).

| Method | Path                      | Notes                                                    |
| ------ | ------------------------- | -------------------------------------------------------- |
| GET    | `/api/v1/vendor/settings` | Returns all 4 allow-listed keys, `value: null` if unset  |
| PUT    | `/api/v1/vendor/settings` | Upsert one or more keys (send only what you're changing) |

Allow-listed keys — nothing outside this list can be read or written through this endpoint:

| Key                   | Type               | Notes                                             |
| --------------------- | ------------------ | ------------------------------------------------- |
| `slack_orders_hook`   | string (https URL) | Per-storefront Slack webhook for new-order alerts |
| `currency`            | string (3 letters) | ISO 4217 code, e.g. `USD`                         |
| `theme_color`         | string (hex)       | e.g. `#1a56db`                                    |
| `low_stock_threshold` | integer            | Alert when `stock_quantity` falls below this      |

`PUT` body — any subset of the four keys:

```json
{ "slack_orders_hook": "https://hooks.slack.com/services/T000/B000/xxxxxxxx" }
```

Send `null` or `""` for a key to clear it (e.g. clear `slack_orders_hook` to fall back to the
platform-wide webhook again). Response `data.settings` is always the full array of 4 keys with
their current values, same shape as `GET`.

---

## 7. Known gaps (as of this doc's last update)

- No "logout all devices" or session-listing endpoint — only single-refresh-token revoke.
- No automated email sending — verification approval/rejection is a fully manual SuperAdmin
  review step (see §2.5). Wiring an actual email provider is a separate, later piece of work.
- No customer-initiated order cancellation — only the vendor can cancel (§5d).
- Orders don't yet calculate real discount/shipping-fee/tax — all three are flat `0` for now,
  so `total_amount` always equals `subtotal`.
- No SuperAdmin / platform-wide settings API yet — only the vendor-scoped allow-list in §6 has
  an endpoint; platform rows like `maintenance_mode` are still DB-edit-only.
