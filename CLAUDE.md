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

**Status:** Foundation phase — server bootstrap, DB config, response helpers, and Slack
error notifier are implemented. Routes, controllers, services, and middleware are **not yet
created** (see Planned Structure below).

---

## Directory Layout

```
ShopForge/
├── Server.ts                          # HTTP server entry point — creates app, binds port
├── Src/
│   ├── Index.ts                       # Server class — Express middleware config + Swagger setup
│   ├── Configs/
│   │   └── db_config.ts               # PostgreSQL Pool export (named: `pool`)
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

## Entry Points

### `Server.ts` (root)

- Loads `.env`, creates Express app, configures CORS (all origins allowed for now)
- Serves `/uploads` as static files (local uploads folder — dev only, not S3)
- Instantiates `new Server(app)` from `Src/Index.ts`
- Creates `http.createServer(app)` and listens on `PORT` / `SERVER_IP` from env
- Default: `PORT=4000`, `SERVER_IP=0.0.0.0`

### `Src/Index.ts` — `Server` class

- Constructor calls `this.config(app)` then `this.setupSwagger(app)`
- `config()`: sets `express.json({ limit: '5mb' })`, `bodyParser.json`, `bodyParser.urlencoded`, global error handler (returns 500 JSON)
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

---

## Environment Variables

| Variable           | Used In                       | Notes                                  |
| ------------------ | ----------------------------- | -------------------------------------- |
| `PORT`             | Server.ts                     | Default 4000                           |
| `SERVER_IP`        | Server.ts                     | Default 0.0.0.0                        |
| `SWAGGER_IP`       | Src/Index.ts                  | External IP for Swagger server entry   |
| `NODE_ENV`         | SlackMessageBuilder           | Shown in Slack alerts                  |
| `JWT_SECRET`       | (middleware, not yet created) | `djsnodcuos_dcsgv_fhn5647*5%44` in dev |
| `DB_HOST`          | db_config.ts                  | `127.0.0.1` in dev                     |
| `DB_USER`          | db_config.ts                  | `postgres`                             |
| `DB_PASSWORD`      | db_config.ts                  | —                                      |
| `DB_PORT`          | db_config.ts                  | `5432`                                 |
| `DB_DATABASE_NAME` | db_config.ts                  | `ShopForge`                            |
| `SLACK_URL`        | SlackMessageBuilder           | Incoming webhook URL                   |
| `ASSETS_URL`       | (future)                      | `http://0.0.0.0:4000/assets`           |
| `CATEGORY_ASSETS`  | (future)                      | `/category/`                           |
| `BUSINESS_ASSETS`  | (future)                      | `/business/`                           |
| `ITEM_ASSETS`      | (future)                      | `/item/`                               |
| `APP_SETTINGS`     | (future)                      | `/app_setting/`                        |

---

## Dev Scripts

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | `concurrently "tsc -w" "nodemon server.js"` — hot reload |
| `npm run transpile` | `tsc` once                                               |
| `npm run start`     | Transpile then `node server.js`                          |
| `npm run lint`      | `eslint --ext .ts src`                                   |
| `npm run migrate`   | Transpile + `node MigrateDatabase.js`                    |
| `npm run seed`      | Transpile + `node src/db/seed.js`                        |

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
- **Files:** PascalCase for class-like modules (`ResponseEnhancer.ts`, `SlackMessageBuilder.ts`),
  snake_case for configs (`db_config.ts`)
- **Exports:** Named exports preferred; `errorNotifier` is a singleton instance export

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

- Every DB table has `tenant_id` scoping all queries
- Vendors are tenants; customers and products belong to a tenant

### Auth Flow (to be built)

1. `authenticate` middleware: verifies JWT → attaches `{ id, role, tenant_id }` to `req.user`
2. `authorise(roles[])` middleware: enforces RBAC
3. `validateBody(schema)` middleware: Joi schema validation factory — invalid requests return 400 before reaching controllers

### Roles: `Customer` · `Vendor` · `SuperAdmin`

### Order Flow

- Atomic inventory deduction inside a PostgreSQL transaction
- FIFO queue (index on `created_at ASC`)
- Status state machine: `pending → confirmed → shipped → delivered`
- Slack alert to `#orders` on each new order (non-blocking)

### Caching

- Redis via `ioredis`
- Product listings cached with 5-minute TTL
- Cache invalidated on product mutations

### Chat

- Per-order real-time chat stored in Firebase Firestore (not PostgreSQL)
- `firebase-admin` SDK

### API Versioning

- Existing Slack error logic references `/api/v1/superadmin/login` and `/api/v2/users/login`
- Plan routes accordingly under `/api/v1/` and `/api/v2/`

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

---

## Git Branch Conventions

- `main` — stable trunk
- `KAN-XX` — feature branches named after Kanban ticket IDs
- Current branches: `main`, `KAN-2`

---

## What Does NOT Exist Yet

These are described in README but not in the codebase:

- Routes / Controllers / Services / Schemas / Middlewares folders
- `MigrateDatabase.js` / migration files / seed files
- Redis config module (`redis.ts`)
- Firebase config module (`firebase.ts`)
- Authentication middleware
- Any actual API endpoints
- Tests (Jest + Supertest)
- Docker / docker-compose files
- GitHub Actions workflow

---

## Update Checklist

When adding new modules, update this file:

- [ ] Add file to Directory Layout
- [ ] Document exports and usage pattern
- [ ] List any new env vars
- [ ] Note any new conventions or patterns introduced
