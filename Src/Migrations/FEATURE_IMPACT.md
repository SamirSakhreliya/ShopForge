# ShopForge — Feature Real-World Impact Assessment

> **Purpose:** Score each database-backed feature on its real-world impact for the MVP.  
> **Scale:** 1 (negligible) → 10 (business-critical / revenue-blocking if absent).  
> **Evaluators:** Product · Engineering · Support  
> **Version:** 1.0.0 · KAN-8

---

## Scoring Criteria

| Dimension                  | Weight | Description                                         |
| -------------------------- | ------ | --------------------------------------------------- |
| **Revenue impact**         | High   | Does it directly enable or protect transactions?    |
| **User-facing visibility** | Medium | Is it immediately visible/felt by end-users?        |
| **Operational risk**       | High   | What breaks or degrades if this is absent or buggy? |
| **Recovery cost**          | Medium | How hard is it to fix bad data retroactively?       |

---

## Feature Impact Table

### Module 1 — Tenants

| Feature                                                 | Score | Justification                                                                                                                                                          |
| ------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant registration & profile**                       | 9/10  | Without tenant isolation every vendor's data leaks to every other. The entire multi-tenancy promise collapses. Recovery from a cross-tenant data leak is catastrophic. |
| **Tenant status management** (active/suspended/pending) | 7/10  | Platform operators need to gate bad actors quickly. A suspended tenant still being served costs the platform legally and reputationally.                               |
| **Plan-based feature gating**                           | 6/10  | Limits premium features to paying tenants. Not launch-blocking but required before public monetisation begins.                                                         |

---

### Module 2 — Users & Auth

| Feature                                                          | Score | Justification                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer registration & login** (global account)               | 10/10 | No auth = no orders. Every revenue flow starts here. Since Customer identity is now global (one account, all storefronts), a broken login page is a platform-wide revenue outage, not just one tenant's. |
| **Customer-Vendor linking** (`customer_vendor_links`)            | 6/10  | Not blocking for checkout itself, but without it vendors lose "my customers" visibility since Customer rows are no longer tenant-scoped.                                                                 |
| **Vendor login**                                                 | 10/10 | Vendors can't manage orders, update stock, or configure their storefront without this. Complete operational paralysis.                                                                                   |
| **SuperAdmin login**                                             | 8/10  | Required for platform maintenance and tenant management. Not customer-visible but an operational necessity on day 1.                                                                                     |
| **JWT refresh token rotation**                                   | 7/10  | Session hijacking risk without it. Post-breach, no way to force-logout a compromised account. Low-friction attack vector for stolen tokens.                                                              |
| **Email verification flag**                                      | 5/10  | Reduces spam/fake accounts. Not blocking for MVP but unverified accounts degrade email deliverability and trustworthiness of notifications over time.                                                    |
| **Role-based access control** (Vendor vs Customer vs SuperAdmin) | 9/10  | A customer who can edit another customer's order, or read vendor cost prices, is a critical security hole. RBAC must be airtight before exposing any endpoints.                                          |

---

### Module 3 — Categories

| Feature                                 | Score | Justification                                                                                                           |
| --------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| **Root category creation**              | 6/10  | Required for product organisation but not technically blocking for initial orders if a flat product list is acceptable. |
| **Hierarchical sub-categories**         | 5/10  | Enhances discoverability. Impact grows with catalogue size; low for early MVPs with under 20 products.                  |
| **Category soft-disable** (`is_active`) | 4/10  | Allows seasonal or temporary removal. Low urgency; a vendor can delete and re-create for MVP.                           |

---

### Module 4 — Products

| Feature                                     | Score | Justification                                                                                                                                                                         |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product listing (public)**                | 10/10 | Customers can't browse or buy without it. Zero storefront function.                                                                                                                   |
| **Product creation & editing** (vendor)     | 10/10 | Vendors can't sell without adding products. Directly blocks all revenue.                                                                                                              |
| **Stock quantity tracking**                 | 9/10  | Overselling (stock going negative) causes fulfilment failures, refunds, and vendor-customer disputes. Atomic decrement in order transaction is critical.                              |
| **Product soft-disable** (`is_active`)      | 7/10  | Vendors need to temporarily hide out-of-stock or seasonal items without losing order history references.                                                                              |
| **Featured product flag**                   | 4/10  | Drives homepage promotion. Nice-to-have for early MVPs with few products.                                                                                                             |
| **Compare / sale price** (`compare_price`)  | 5/10  | Psychological pricing boosts conversion. Not technically required for transactions but expected by customers in any modern storefront.                                                |
| **Cost price** (internal)                   | 3/10  | Margin analytics only. No customer or order impact. Useful for vendor reporting later.                                                                                                |
| **Product image gallery** (multiple images) | 6/10  | Primary image is critical for conversion; secondary gallery images are a UX enhancement. Single-image MVP is viable.                                                                  |
| **SKU / barcode**                           | 5/10  | Required for physical inventory management and warehouse integrations. Not blocking for digital-first MVP.                                                                            |
| **Redis product listing cache** (5-min TTL) | 7/10  | Under load, uncached catalogue queries will hit the DB on every pageview. At small scale survivable; at moderate scale (100+ concurrent users) causes latency spikes and DB overload. |

---

### Module 5 — Orders

| Feature                                                            | Score | Justification                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Order placement (atomic + stock decrement)**                     | 10/10 | The core business transaction. Race conditions here lead to overselling. A non-atomic decrement under concurrent load will cause inventory discrepancies that are expensive to reconcile.                           |
| **Order status state machine**                                     | 9/10  | Without clear statuses, vendors and customers have no shared understanding of where an order is. Support tickets multiply. State machine prevents illegal transitions (e.g. jumping from `pending` to `delivered`). |
| **Order status history audit log**                                 | 7/10  | Critical for disputes ("you said it was delivered but I never received it"). Without it, support has no evidence. Low engineering cost, high operational value.                                                     |
| **Checkout price snapshot** (frozen `unit_price` in `order_items`) | 9/10  | If an item's price changes after purchase, the customer must be charged the price they agreed to. Without snapshotting, a price update retroactively changes invoice amounts — a legal and trust problem.           |
| **FIFO order queue** (vendor dashboard)                            | 6/10  | Fair processing for customers. Without FIFO, newer orders may be fulfilled before older ones, causing SLA violations. Moderate impact at low order volume.                                                          |
| **Slack new-order alert**                                          | 7/10  | Vendors miss new orders without it. Silent order queue leads to SLA breaches and customer complaints. Non-blocking (fire-and-forget) so it doesn't impact order placement reliability.                              |
| **Order cancellation flow**                                        | 7/10  | Customers expect cancellation within a window. Without it, support handles cancellations manually — high effort, error-prone. Stock must be returned on cancellation.                                               |
| **Refund status tracking**                                         | 5/10  | Required before accepting card payments. COD-first MVPs can defer this.                                                                                                                                             |
| **Shipping address snapshot** (not FK to address table)            | 6/10  | A linked address that can be edited post-purchase would silently change the delivery address on a shipped order. Snapshotting is the correct approach; missing it causes fulfilment errors.                         |

---

### Module 6 — App Settings & Notifications

| Feature                                 | Score | Justification                                                                                                                                     |
| --------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per-tenant Slack orders hook**        | 7/10  | Enables each vendor to receive order alerts in their own Slack workspace. Without it, all alerts go to the platform, not the vendor — unscalable. |
| **Tenant currency setting**             | 6/10  | Incorrect currency display destroys customer trust instantly. Needs to be correct before any storefront goes live.                                |
| **Low-stock threshold alert**           | 5/10  | Prevents stockouts that lead to accepted orders that can't be fulfilled. Important but recoverable — vendor can manually monitor for early MVP.   |
| **Maintenance mode flag**               | 6/10  | Required during deployments to prevent partial-state orders. Without it, a deploy mid-order can corrupt order state.                              |
| **Notifications log**                   | 6/10  | Enables retry on failed delivery, deduplication, and support audit. Without it, failed Slack/email alerts are silently lost.                      |
| **Platform-wide settings** (SuperAdmin) | 5/10  | Needed for platform-level toggles. Low urgency until multi-operator scenarios arise.                                                              |

---

## Summary — Top 10 by Impact Score

| Rank | Feature                                  | Score | Module   |
| ---- | ---------------------------------------- | ----- | -------- |
| 1    | Customer login                           | 10/10 | Auth     |
| 1    | Vendor login                             | 10/10 | Auth     |
| 1    | Public product listing                   | 10/10 | Products |
| 1    | Product creation & editing               | 10/10 | Products |
| 1    | Atomic order placement + stock decrement | 10/10 | Orders   |
| 6    | RBAC (role enforcement)                  | 9/10  | Auth     |
| 6    | Stock quantity tracking                  | 9/10  | Products |
| 6    | Order status state machine               | 9/10  | Orders   |
| 6    | Checkout price snapshot                  | 9/10  | Orders   |
| 10   | Tenant isolation & registration          | 9/10  | Tenants  |

---

## Risk Matrix — Features with High Recovery Cost if Deferred

| Feature                  | If skipped for MVP                          | Recovery cost |
| ------------------------ | ------------------------------------------- | ------------- |
| Atomic stock decrement   | Overselling, manual refunds, customer churn | HIGH          |
| Checkout price snapshot  | Retroactive price changes on live invoices  | HIGH          |
| Tenant data isolation    | Cross-tenant data leak, legal exposure      | CRITICAL      |
| Order audit log          | No evidence for disputes                    | MEDIUM        |
| Refresh token revocation | No way to contain compromised sessions      | MEDIUM        |

---

_Document maintained alongside `DATABASE.md`. Update when new features are added or priorities shift._
