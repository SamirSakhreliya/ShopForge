# CLAUDE.md — ShopForge Codebase Reference

> This file is a living reference for Claude. Update it whenever you add new modules,
> change conventions, or introduce new patterns. Keep it dense and factual — no fluff.

---

## Project Overview

**ShopForge** is a multi-tenant SaaS marketplace REST API. Independent vendors each run
isolated storefronts; customers browse and order; support runs through per-order chat;
all errors and order events are monitored via Slack.

**Stack:** Node.js 20 + TypeScript 5 · Express.js · PostgreSQL 15 (pg) · Redis (ioredis) ·
Firebase Firestore (firebase-admin) · JWT + bcrypt · Slack webhooks · Socket.io · Multer

**Status:** Auth module is implemented — Routes/Controllers/Services/Schemas/Middlewares/
Migrations/Seeds now exist for Customer/Vendor/SuperAdmin register+login, refresh/logout
(JWT rotation), and manual email verification request/approve/reject (see
`Src/Routes/Auth.Routes.ts` etc.). Products (catalogue) module is implemented as of KAN-21 —
public/customer browse (`/api/v2/products`) and vendor CRUD + image upload
(`/api/v1/vendor/products`), see `Src/Routes/Product.Routes.ts` etc. below. Categories module
is implemented — public browse (`/api/v2/categories`), vendor CRUD
(`/api/v1/vendor/categories`), plus an atomic bulk "category + products in one call" endpoint
(`POST /api/v1/vendor/categories/bulk`). Redis runs via `docker-compose.yml` (see Docker
section below). Routes/Controllers were restructured post-KAN-21 for readability (see "Routes
& Controllers structure" below): each domain router now exports one Router per URL-prefix
group with **relative** paths only, and the actual `/api/v1` / `/api/v2` prefix is applied
centrally in `Src/Routes/index.ts`. Controllers are one function per file under
`Controllers/<Domain>/`, no controller classes. Orders still only exists as migrations/seeds
— its Routes/Controllers/Services are **not yet created**.
NOTE: this Status line and the "Planned Structure" / "What Does NOT Exist Yet" sections below
are stale relative to disk state and due for a fuller audit — treat Directory Layout as
illustrative, not authoritative; verify against the filesystem for anything load-bearing.

---

## Directory Layout

```
ShopForge/
├── Server.ts                          # HTTP server entry point — creates app, binds port
├── docker-compose.yml                 # Redis service (redis:7-alpine) for local dev
├── FRONTEND_INTEGRATION.md            # Frontend-facing endpoint/contract guide — update per feature
├── Src/
│   ├── Index.ts                       # Server class — Express middleware config + Swagger setup
│   ├── Configs/
│   │   ├── db_config.ts               # PostgreSQL Pool export (named: `pool`)
│   │   └── redis_config.ts            # ioredis client export (named: `redis`) — product catalogue cache
│   ├── Routes/
│   │   ├── index.ts                   # Central prefix table — maps /api/v1|v2/... onto each domain router
│   │   ├── Auth.Routes.ts             # Exports CustomerAuthRouter, VendorAuthRouter, SuperAdminAuthRouter (relative paths only)
│   │   ├── Product.Routes.ts          # Exports PublicProductRouter, VendorProductRouter (relative paths only)
│   │   ├── Category.Routes.ts         # Exports PublicCategoryRouter, VendorCategoryRouter (relative paths only)
│   │   └── Test.Routes.ts             # RBAC smoke-test stub routes (legacy, absolute paths, mounted as-is)
│   ├── Controllers/
│   │   ├── Auth/                      # One file per handler: RegisterCustomer, LoginCustomer, RegisterVendor, LoginVendor, LoginSuperAdmin, RefreshToken, Logout, RequestEmailVerification, ListEmailVerificationRequests, ApproveEmailVerification, RejectEmailVerification
│   │   ├── Product/                   # One file per handler: ListPublic, GetPublicById, ListVendor, GetVendorById, Create, Update, Delete, UploadImage, DeleteImage, SetPrimaryImage
│   │   └── Category/                  # One file per handler: ListPublic, GetPublicById, ListVendor, GetVendorById, Create, Update, Delete, CreateWithProducts
│   ├── Services/
│   │   ├── Auth.Service.ts            # Register/login + refresh/logout (token rotation) + email verification request/approve/reject
│   │   ├── Product.Service.ts         # Listing/CRUD/image logic + Redis cache helpers (+ public invalidateCache() for cross-service use)
│   │   └── Category.Service.ts        # Listing/CRUD + createCategoryWithProducts (atomic bulk create)
│   ├── Schemas/
│   │   ├── Auth.Schema.ts             # + refreshTokenSchema, verificationStatusQuerySchema, rejectVerificationSchema
│   │   ├── Product.Schema.ts          # createProductSchema, updateProductSchema, publicListQuerySchema, vendorListQuerySchema
│   │   └── Category.Schema.ts         # createCategorySchema, updateCategorySchema, public/vendorListCategoryQuerySchema, createCategoryWithProductsSchema (nests createProductSchema)
│   ├── Middlewares/
│   │   ├── authenticate.ts
│   │   ├── authorise.ts
│   │   ├── validateBody.ts
│   │   ├── validateQuery.ts           # Joi validation for req.query (coerces types, e.g. "20" -> 20)
│   │   └── uploadProductImage.ts      # multer disk storage -> uploads/products, 5MB limit, image mimetypes only
│   ├── Utils/
│   │   └── Helpers/
│   │       ├── ResponseEnhancer.ts    # Middleware: attaches res.success / res.error
│   │       └── SlackMessageBuilder.ts # ErrorNotifier class + `errorNotifier` singleton
│   └── types/
│       └── express.d.ts               # Express type augmentation (res.success, res.error, req.preferred_language)
├── package.json
├── tsconfig.json
├── eslint.config.cjs
├── .prettierrc
├── commitlint.config.cjs
├── lint-staged.config.cjs
└── .env                               # Local env vars (never commit)
```

### Planned Structure (not yet created — matches README)

```
Src/
├── Routes/          # Express routers — swagger-jsdoc scans ./Routes/**/*.ts
├── Controllers/     # Thin route handlers, call services
├── Services/        # Business logic (order, cache, slack, chat)
├── Middlewares/     # authenticate.ts · authorise.ts · validateBody.ts · error.middleware.ts
├── Schemas/         # Joi validation schemas
├── Migrations/      # SQL migration files
└── Seeds/           # Dev seed data
```

---

## Routes & Controllers structure (post-KAN-21 refactor)

Adopted for human readability — one place to see every URL prefix, and one file per
controller handler instead of a growing controller class.

**Routes:** each domain file under `Src/Routes/` (e.g. `Auth.Routes.ts`) exports one or more
named `Router()` instances, one per URL-prefix group, using only paths **relative** to that
group (`/register`, `/:id`, never `/api/v1/...`). `Src/Routes/index.ts` is the single place
that calls `router.use(prefix, DomainRouter)` for every group — that's where `/api/v1` vs
`/api/v2` actually gets applied. `Src/Index.ts` mounts only `Routes/index.ts`.

To add a new feature module: create `Feature.Routes.ts` exporting its router(s) with
relative paths, import it in `Routes/index.ts`, add one `router.use('/api/vX/...', X)` line.

Swagger (`@openapi`) JSDoc blocks still use the **full absolute path** (e.g.
`/api/v2/products/{id}`) regardless of the router's relative path — swagger-jsdoc parses
those comments independently of how Express actually mounts the router, so the doc block
must spell out the real, final URL. Where the same handler is mounted at multiple prefixes
(e.g. refresh/logout under all three Auth routers), write out a full separate `@openapi`
block per mount point rather than looping the route-registration call — a loop would only
produce one physical comment in the source, leaving the other mount points undocumented in
Swagger even though they work at runtime.

**Controllers:** no controller classes. `Src/Controllers/<Domain>/` holds one file per
handler (e.g. `Controllers/Auth/RegisterCustomer.Controller.ts` exports a single
`registerCustomer` async function), imported directly into the route file that uses it.

---

## Entry Points

### `Server.ts` (root)

- Loads `.env`, creates Express app, configures CORS (all origins allowed for now)
- Serves `/uploads` as static files (local uploads folder — dev only, not S3)
- Instantiates `new Server(app)` from `Src/Index.ts`
- Creates `http.createServer(app)` and listens on `PORT` / `SERVER_IP` from env
- Default: `PORT=4000`, `SERVER_IP=0.0.0.0`

### `Src/Index.ts` — `Server` class

- Constructor calls `this.config(app)` then `this.setupSwagger(app)`
- `config()`: sets `express.json({ limit: '5mb' })`, `bodyParser.json`, `bodyParser.urlencoded`, global error handler (returns 500 JSON), mounts the single combined router from `Src/Routes/index.ts`
- `setupSwagger()`: Swagger UI at `/docs`, scans `./Routes/**/*.ts` for JSDoc annotations
- Swagger servers: `http://localhost:{PORT}` and `http://{SWAGGER_IP}:{PORT}`

---

## Key Modules

### `Src/Configs/db_config.ts`

```ts
export const pool = new Pool({ host, user, password, port, database });
// Reads: DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, DB_DATABASE_NAME from .env
```

Import as: `import { pool } from '../Configs/db_config';`

### `Src/Utils/Helpers/ResponseEnhancer.ts`

Express middleware. Attach before routes. Extends `res` with two methods:

| Method        | Signature                               | Behavior                                              |
| ------------- | --------------------------------------- | ----------------------------------------------------- |
| `res.success` | `(message, data={}, statusCode=200)`    | `{ success: true, message, data }`                    |
| `res.error`   | `(message, error=null, statusCode=500)` | `{ success: false, message, data: {} }` + Slack alert |

Slack alert logic in `res.error`:

- Always fires when `statusCode !== 404`
- Also fires for 404s only on these two exact URLs: `/api/v1/superadmin/login`, `/api/v2/users/login`
- Logs full request context (URL, method, body, query, params, stack) to console and Slack

Also logs every incoming request (url, method, body, query, params) to console on each call.

### `Src/Utils/Helpers/SlackMessageBuilder.ts`

```ts
export const errorNotifier = new ErrorNotifier();
// errorNotifier.sendNotification(errorDetails) — async, non-blocking (fire-and-forget)
```

- Reads `SLACK_URL` from env
- Builds Slack Block Kit message with severity emoji, timestamp (`moment`), env, API URL, error code, method, body, query, params, stack
- Bot name: `'Match-US error'` (legacy name — can be updated)
- `severityLevels`: info / warning / error / critical

### `Src/types/express.d.ts`

Augments Express globals:

- `Response.success(message, data?, statusCode?): void`
- `Response.error(message, error?, statusCode?): void`
- `Request.preferred_language?: string`

### `Src/Configs/redis_config.ts`

```ts
export const redis = new Redis({ host, port, password });
// Reads: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD from .env
```

Non-fatal on connection errors (logs only) — callers must degrade gracefully to a direct DB
read if Redis is unavailable; see `Product.Service.ts` cache helpers. Points at the
`docker-compose.yml` Redis service in dev (see Docker section below). **Still required even
though Redis itself runs in Docker** — the container is just the server process; this file is
the Node-side `ioredis` client that connects the app to it. Removing it would remove caching
entirely, not just move where it's configured.

### Auth module — refresh tokens + email verification

- **Access tokens**: JWT, 15-minute expiry (`ACCESS_TOKEN_EXPIRES_IN` in `Auth.Service.ts`,
  down from the original 7-day single-token setup).
- **Refresh tokens**: opaque random strings (`crypto.randomBytes(48)`), 30-day expiry,
  persisted in the pre-existing `user_management.refresh_tokens` table. Looked up by
  **SHA-256** hash (`hashToken()`), not bcrypt — bcrypt's slow salted hashing is for
  low-entropy secrets (passwords); a 48-byte random token already has enough entropy that a
  fast deterministic hash is the correct/standard choice for exact-match lookup.
- **Rotation**: every `POST .../refresh` call revokes the token just used
  (`revoked_at = NOW()`) and issues a brand-new access+refresh pair — see
  `AuthService.refreshAccessToken()`. A stolen-but-unused refresh token becomes worthless the
  moment the legitimate owner refreshes again.
- **Logout**: `AuthService.logout()` revokes one refresh token; always resolves successfully
  (even if the token was already invalid) so the endpoint can't be used to probe validity.
  There's no logout-all-devices or session-listing endpoint yet.
- **Shared across roles**: refresh/logout/verify-request logic doesn't depend on
  Customer/Vendor/SuperAdmin — the same controller functions are wired into all three routers
  in `Auth.Routes.ts` at their respective prefixes (each gets its own full `@openapi` block —
  see the note in "Routes & Controllers structure" above about why this isn't a loop).
- **Email verification** (`Src/Migrations/008_email_verification_requests.sql`): manual
  workflow, no email-sending integration yet. Customer/Vendor call
  `POST .../verify-email/request` (blocked if already verified or a `pending` request already
  exists — partial unique index `uq_email_verif_one_pending_per_user`). SuperAdmin lists via
  `GET /api/v1/superadmin/verify-email/requests` and approves/rejects by ID; approval flips
  `users.is_email_verified` to `TRUE` inside a transaction.

### Product module (KAN-21) — `Product.Routes/Controller/Service/Schema.ts`

Two distinct views over the same `product_management.products` table:

- **Public/Customer** (`/api/v2/products`, no auth): only `is_active = TRUE` products from
  `tenant.status = 'active'` storefronts. Excludes `cost_price`. Filters: `tenant_id`,
  `category_id`, `min_price`/`max_price`, `search` (ILIKE name/description), `sort`
  (`price_asc` / `price_desc` / `newest` / `featured`), `page`/`limit`. All filters optional —
  calling with no query params returns the full public catalogue, paginated. Result is cached
  in Redis for 5 minutes per unique filter combination.
- **Vendor** (`/api/v1/vendor/products`, `authenticate` + `authorise(['Vendor'])`): scoped to
  `req.user.tenant_id`. Every status visible, plus `cost_price`, `sku`, `barcode`,
  `stock_quantity`. Adds `is_active`/`is_featured` filters and `stock_low`/`stock_high` sorts.
  Never cached — vendors need a live inventory view.
- **Cache invalidation pattern:** a single Redis key `products:cache:version` is `INCR`'d on
  every product/image mutation (create/update/delete/image change). Cache keys embed the
  current version (`products:public:v{version}:{filters}`), so a mutation makes all prior
  cache entries permanently unreachable — no active `SCAN`/`DEL` needed, they just expire via
  the 5-minute TTL. This avoids scanning Redis keys, which does not scale well.
  `ProductService.invalidateCache()` is a public wrapper other services (e.g.
  `CategoryService`) call after inserting products directly, without duplicating the
  version-key logic.
- **Images:** `product_management.product_images`, uploaded via `uploadProductImage` (multer,
  disk storage under `uploads/products/`, served by the existing `/uploads` static route in
  `Server.ts`). First image on a product is auto-marked `is_primary`; deleting the primary
  image promotes the next-oldest one.
- **Delete is a hard delete** — safe because `order_items.product_id` is a nullable soft
  reference (`ON DELETE SET NULL`, see `005_orders.sql`), so historical orders are unaffected.
- **Optional-field validation:** UUID/string filter fields (`tenant_id`, `category_id`,
  `search`, `slug`) use Joi's `.empty('')` so an empty string sent by a client is treated as
  "not provided" rather than failing UUID/pattern validation. Same fix applied to
  `Auth.Schema.ts`'s `customerRegisterSchema.tenant_id`.

### Category module — `Category.Routes/Controller/Service/Schema.ts`

Same public/vendor split as Products, over `category_management.categories`:

- **Public/Customer** (`/api/v2/categories`, no auth): only `is_active = TRUE` categories
  from active storefronts. Filters: `tenant_id`, `parent_id`, `page`/`limit`.
- **Vendor** (`/api/v1/vendor/categories`, `authenticate` + `authorise(['Vendor'])`): scoped
  to `req.user.tenant_id`, full CRUD, every status visible.
- **Not cached** — category lists are small and change rarely enough that the added
  complexity of a versioned cache (like Products has) wasn't worth it; revisit if catalogue
  sizes grow.
- **`POST /api/v1/vendor/categories/bulk`** — "add an entire category with multiple products
  in one click." `CategoryService.createCategoryWithProducts()` wraps the category insert and
  every product insert in a single DB transaction (all-or-nothing — a duplicate SKU on
  product #3 rolls back the category and the first two products too), then calls
  `productService.invalidateCache()` so the new products aren't hidden behind the 5-minute
  public-listing cache.
- **Delete is a hard delete** — safe because both `categories.parent_id` (self-referential)
  and `products.category_id` are `ON DELETE SET NULL`; deleting a category un-nests its
  children and un-categorizes its products rather than cascading.

---

## Docker

`docker-compose.yml` (repo root) currently defines one service:

- **`redis`** — `redis:7-alpine`, container name `shopforge-redis`, port `6379:6379`,
  AOF persistence (`--appendonly yes`) to a named volume `redis_data`, healthcheck via
  `redis-cli ping`. Matches the default `REDIS_HOST=127.0.0.1` / `REDIS_PORT=6379` in `.env`.

Run via `npm run redis:up` (`docker compose up -d redis`) / `npm run redis:down` /
`npm run redis:logs`. Postgres and the app itself are **not** containerized yet — only the
Redis cache, per KAN-21 follow-up.

---

## Environment Variables

| Variable           | Used In                           | Notes                                                    |
| ------------------ | --------------------------------- | -------------------------------------------------------- |
| `PORT`             | Server.ts                         | Default 4000                                             |
| `SERVER_IP`        | Server.ts                         | Default 0.0.0.0                                          |
| `SWAGGER_IP`       | Src/Index.ts                      | External IP for Swagger server entry                     |
| `NODE_ENV`         | SlackMessageBuilder               | Shown in Slack alerts                                    |
| `JWT_SECRET`       | Auth.Service.ts / authenticate.ts | `djsnodcuos_dcsgv_fhn5647*5%44` in dev                   |
| `DB_HOST`          | db_config.ts                      | `127.0.0.1` in dev                                       |
| `DB_USER`          | db_config.ts                      | `postgres`                                               |
| `DB_PASSWORD`      | db_config.ts                      | —                                                        |
| `DB_PORT`          | db_config.ts                      | `5432`                                                   |
| `DB_DATABASE_NAME` | db_config.ts                      | `ShopForge`                                              |
| `SLACK_URL`        | SlackMessageBuilder               | Incoming webhook URL                                     |
| `REDIS_HOST`       | redis_config.ts                   | `127.0.0.1` in dev (docker-compose service maps to this) |
| `REDIS_PORT`       | redis_config.ts                   | `6379` in dev                                            |
| `REDIS_PASSWORD`   | redis_config.ts                   | Empty in dev (no `requirepass` set on the container)     |
| `ASSETS_URL`       | (future)                          | `http://0.0.0.0:4000/assets`                             |
| `CATEGORY_ASSETS`  | (future)                          | `/category/`                                             |
| `BUSINESS_ASSETS`  | (future)                          | `/business/`                                             |
| `ITEM_ASSETS`      | (future)                          | `/item/`                                                 |
| `APP_SETTINGS`     | (future)                          | `/app_setting/`                                          |

---

## Dev Scripts

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | `concurrently "tsc -w" "nodemon server.js"` — hot reload  |
| `npm run transpile`  | `tsc` once                                                |
| `npm run start`      | Transpile then `node server.js`                           |
| `npm run lint`       | `eslint --ext .ts src`                                    |
| `npm run migrate`    | Transpile + `node MigrateDatabase.js`                     |
| `npm run seed`       | Transpile + `node src/db/seed.js`                         |
| `npm run redis:up`   | `docker compose up -d redis` — starts the Redis container |
| `npm run redis:down` | `docker compose down` — stops and removes it              |
| `npm run redis:logs` | `docker compose logs -f redis`                            |

> TypeScript compiles to CommonJS (`module: commonjs`, `target: es2022`). No `outDir` set in tsconfig —
> compiled `.js` files land next to their `.ts` sources. `sourceMap: true`.

---

## Code Conventions

### TypeScript

- `strict: true`, `noImplicitAny: false`, `esModuleInterop: true`
- No `allowJs` — pure TypeScript
- Type roots: `./node_modules/@types` and `Src/types`

### Naming

- **Folders:** PascalCase (`Src/`, `Configs/`, `Utils/`, `Helpers/`, `Routes/`, etc.)
- **Files:** PascalCase for class-like modules (`ResponseEnhancer.ts`, `SlackMessageBuilder.ts`)
  and for controller handler files (`RegisterCustomer.Controller.ts`), snake_case for configs
  (`db_config.ts`)
- **Exports:** Named exports preferred; `errorNotifier` is a singleton instance export;
  controller files also export a `default` matching the named export for either import style

### ESLint Rules (`.eslint.config.cjs`)

- 2-space indent
- Single quotes
- No trailing spaces
- Max 1 blank line between blocks
- `@typescript-eslint/no-unused-vars` — error, args prefixed with `_` are exempt

### Prettier (`.prettierrc`)

```json
{ "singleQuote": true, "trailingComma": "all" }
```

### Commit Message Format

Custom pattern (not Conventional Commits):

```
type:[KAN-XX] subject
```

- **Types:** `feature` · `fix` · `chore` · `docs` · `test` · `refactor`
- Multiple tickets allowed: `[KAN-1][KAN-2]`
- Max header length: 120 chars
- Enforced by commitlint + husky `commit-msg` hook

### Git Hooks (Husky)

- **pre-commit:** runs `lint-staged` → ESLint fix + Prettier on staged `*.ts`, `*.json`, `*.md`
- **commit-msg:** runs `commitlint` to validate commit format

---

## Planned Architecture

### Multi-tenancy

- Every DB table has `tenant_id` scoping all queries — **except** `users` for `Customer`/`SuperAdmin` roles
- Vendors are tenants; products, categories, and orders belong to a tenant
- **Customer identity is global (platform-wide), confirmed B2C marketplace model.** One Customer account works across every vendor storefront — no per-vendor login. `customer_vendor_links` (many-to-many, `Src/Migrations/007_customer_vendor_links.sql`) tracks which storefronts a customer has registered/shopped on, decoupled from account identity

### Auth Flow

1. `authenticate` middleware: verifies JWT → attaches `{ id, role, tenant_id }` to `req.user`
2. `authorise(roles[])` middleware: enforces RBAC
3. `validateBody(schema)` / `validateQuery(schema)` middleware: Joi validation factories — invalid requests return 400 before reaching controllers
4. Access token (15m) + refresh token (30d, rotated on use) — see "Auth module — refresh tokens + email verification" above

### Roles: `Customer` · `Vendor` · `SuperAdmin`

### Order Flow

- Atomic inventory deduction inside a PostgreSQL transaction
- FIFO queue (index on `created_at ASC`)
- Status state machine: `pending → confirmed → shipped → delivered`
- Slack alert to `#orders` on each new order (non-blocking)

### Caching

- Redis via `ioredis`, running in Docker locally (see Docker section)
- Product listings cached with 5-minute TTL
- Cache invalidated on product mutations (versioned cache-key pattern, see Product module notes)
- Category listings are NOT cached (see Category module notes)

### Chat

- Per-order real-time chat stored in Firebase Firestore (not PostgreSQL)
- `firebase-admin` SDK

### API Versioning

- Existing Slack error logic references `/api/v1/superadmin/login` and `/api/v2/users/login`
- Prefixes are applied centrally in `Src/Routes/index.ts` (see "Routes & Controllers structure" above), not hardcoded per-route

### Response Shape

All responses follow this envelope:

```json
// Success
{ "success": true, "message": "...", "data": { ... } }

// Error
{ "success": false, "message": "...", "data": {} }
```

---

## Dependencies Quick Reference

| Package                      | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `express`                    | HTTP framework                       |
| `pg`                         | PostgreSQL client (Pool)             |
| `ioredis`                    | Redis client                         |
| `firebase-admin`             | Firestore + Firebase services        |
| `jsonwebtoken`               | JWT sign/verify                      |
| `bcrypt`                     | Password hashing                     |
| `joi`                        | Request validation                   |
| `multer`                     | File upload handling                 |
| `axios`                      | HTTP client (used for Slack webhook) |
| `socket.io`                  | WebSocket server                     |
| `node-cron`                  | Cron job scheduling                  |
| `moment` / `moment-timezone` | Date formatting (Slack messages)     |
| `cors`                       | CORS middleware                      |
| `body-parser`                | Request body parsing                 |
| `dotenv`                     | Env var loading                      |
| `swagger-jsdoc`              | OpenAPI spec from JSDoc comments     |
| `swagger-ui-express`         | Swagger UI at `/docs`                |
| `concurrently`               | Run tsc watch + nodemon in parallel  |
| `nodemon`                    | Auto-restart on file changes         |

Node core `crypto` module is used directly (no dependency) for refresh-token generation/hashing.

---

## Git Branch Conventions

- `main` — stable trunk
- `KAN-XX` — feature branches named after Kanban ticket IDs
- Current branches: `main`, `KAN-2`

---

## What Does NOT Exist Yet

These are described in README but not in the codebase:

- `MigrateDatabase.js` / seed runner scripts (`npm run migrate` / `npm run seed` reference
  paths that don't exist yet — migrations/seeds are currently applied manually)
- Firebase config module (`firebase.ts`)
- Orders Routes/Controllers/Services
- Automated email sending (verification is currently a fully manual SuperAdmin review step)
- Logout-all-devices / session-listing for refresh tokens (only single-token revoke exists)
- Tests (Jest + Supertest)
- Full app/Postgres containerization (only Redis runs in Docker so far — see Docker section)
- GitHub Actions workflow

---

## Update Checklist

When adding new modules, update this file:

- [ ] Add file to Directory Layout
- [ ] Document exports and usage pattern
- [ ] List any new env vars
- [ ] Note any new conventions or patterns introduced
- [ ] Add/adjust a `router.use(prefix, ...)` line in `Src/Routes/index.ts` for any new route file
- [ ] Update `FRONTEND_INTEGRATION.md` with the new/changed endpoint(s) — bump its "Last updated" line
