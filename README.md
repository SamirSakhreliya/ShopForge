<div align="center">

<img src="https://img.shields.io/badge/ShopForge-v1.0.0-1A3C5E?style=for-the-badge" alt="ShopForge version 1.0.0"/>

# ShopForge

### Multi-Tenant SaaS Marketplace Backend

A production-grade REST API platform where vendors run independent storefronts, customers place real-time orders, and support runs through live chat — all monitored via Slack.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Docker](https://img.shields.io/badge/Docker-Containerised-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![AWS](https://img.shields.io/badge/AWS-EC2%20%7C%20RDS%20%7C%20S3-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![License](https://img.shields.io/badge/License-MIT-22C55E)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development (Docker)](#local-development-docker)
  - [Manual Setup](#manual-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)

---

## Overview

ShopForge is a multi-tenant marketplace backend — think of it as the engine that powers an Amazon-style platform where independent vendors each manage their own storefront in complete isolation from one another.

**Why this project?**

It consolidates three real-world production patterns into a single cohesive system:

| Pattern                                       | Inspired by                | What it demonstrates                                             |
| --------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| Multi-tenant order queue with FIFO processing | PoS system architecture    | PostgreSQL schema design, transactional integrity, multi-tenancy |
| Real-time customer–vendor support chat        | Chat platform architecture | Firebase Firestore, real-time integration                        |
| Slack-based order alerts + error monitoring   | Service booking platform   | Webhook integration, production observability                    |

On top of these, the project introduces **Docker containerisation**, **AWS deployment**, and a **GitHub Actions CI/CD pipeline** — turning it into a fully production-deployable system.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│              Web App · Mobile App · Admin Portal             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                       API Gateway                            │
│            JWT Auth · Rate Limiting · Routing                │
│                  Node.js + Express.js                        │
└───────┬────────────┬────────────┬──────────────┬────────────┘
        │            │            │              │
┌───────▼──┐  ┌──────▼─────┐ ┌───▼──────┐ ┌────▼──────────┐
│  Order   │  │ Inventory  │ │  Chat    │ │ Notifications │
│ Service  │  │ & Catalog  │ │ Service  │ │   Service     │
│  (FIFO)  │  │            │ │(Firebase)│ │ (Slack API)   │
└───────┬──┘  └──────┬─────┘ └───┬──────┘ └───────────────┘
        │            │            │
┌───────▼────────────▼──┐  ┌─────▼──────────┐
│      PostgreSQL        │  │    Firebase     │
│  Orders · Users        │  │  Firestore      │
│  Products · Inventory  │  │  (Chat msgs)    │
└───────────────────────┘  └────────────────┘
        │
┌───────▼───────────────┐
│        Redis           │
│  Sessions · Catalog   │
│  Cache (5 min TTL)    │
└───────────────────────┘
```

**Request flow:**

1. Client sends a request with a Bearer token
2. `authenticate` middleware verifies JWT, attaches `{ id, role, tenant_id }` to `req.user`
3. `authorise(roles)` middleware enforces role-based access
4. `validateBody(schema)` middleware runs Joi validation — invalid payloads never reach controllers
5. Controller calls the appropriate service; service interacts with PostgreSQL / Redis / Firebase
6. On order creation, Slack webhook fires asynchronously (non-blocking)
7. Any unhandled error reaches the global error middleware, which posts to the `#errors` Slack channel before returning a 500

---

## Features

### Phase 1 — Foundation

- [x] Multi-tenant database schema with `tenant_id` isolation on all tables
- [x] JWT authentication with role-based access control (Customer · Vendor · SuperAdmin)
- [x] Global Joi validation middleware — consistent error shapes across all endpoints
- [x] Separate registration and onboarding flows per role

### Phase 2 — Marketplace Core

- [x] Product catalog CRUD per vendor (categories, SKUs, stock levels)
- [x] Order placement with atomic inventory deduction inside a PostgreSQL transaction
- [x] FIFO order queue with status state machine (pending → confirmed → shipped → delivered)
- [x] Slack order notifications — `#orders` channel alert on every new order
- [x] Slack error alerting — `#errors` channel for unhandled exceptions with stack traces
- [x] Redis caching for product listings (5 min TTL, auto-invalidated on product mutations)

### Phase 3 — Support Chat & Admin

- [x] Per-order real-time customer–vendor chat via Firebase Firestore
- [x] Message reporting and vendor block system
- [x] SuperAdmin dashboard APIs (vendor management, platform stats, flagged reports)
- [x] Vendor analytics endpoints (revenue, top products, cancellation rate by date range)

### Phase 4 — Infrastructure

- [x] Docker multi-stage build (node:20-alpine, under 300MB)
- [x] docker-compose for full local dev stack (app + PostgreSQL + Redis)
- [x] AWS deployment: EC2 + RDS PostgreSQL + ElastiCache Redis + S3
- [x] GitHub Actions CI/CD: lint → test → Docker build → ECR push → EC2 deploy
- [x] CloudWatch logging + `/health` endpoint with DB and Redis connectivity checks
- [x] Swagger / OpenAPI docs at `/api-docs`

---

## Tech Stack

| Layer      | Technology                    | Purpose                                              |
| ---------- | ----------------------------- | ---------------------------------------------------- |
| Runtime    | Node.js 20 + TypeScript 5     | Type-safe backend with modern JS features            |
| Framework  | Express.js                    | HTTP routing and middleware pipeline                 |
| Primary DB | PostgreSQL 15                 | Relational data — orders, users, products, inventory |
| Cache      | Redis 7                       | Product catalog caching, session storage             |
| Real-time  | Firebase Firestore            | Chat message storage and real-time delivery          |
| Validation | Joi                           | Schema-based request body validation                 |
| Auth       | JWT + bcrypt                  | Stateless authentication, hashed passwords           |
| Payments   | Stripe                        | Secure payment processing (Phase 3 extension)        |
| Alerts     | Slack Webhooks                | Order notifications and error monitoring             |
| Container  | Docker + docker-compose       | Reproducible local and production environments       |
| Cloud      | AWS EC2, RDS, ElastiCache, S3 | Production hosting and managed services              |
| CI/CD      | GitHub Actions + ECR          | Automated build, test, and deploy pipeline           |
| Docs       | Swagger UI (swagger-jsdoc)    | Interactive API documentation                        |
| Testing    | Jest + Supertest              | Unit and integration tests                           |

---

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Docker + Docker Compose](https://docs.docker.com/get-docker/)
- A [Firebase project](https://console.firebase.google.com) with Firestore enabled
- A [Slack app](https://api.slack.com/apps) with two Incoming Webhook URLs (`#orders`, `#errors`)

### Local Development (Docker)

The fastest way to run the full stack locally — no need to install PostgreSQL or Redis separately.

```bash
# 1. Clone the repository
git clone https://github.com/samir-sakhreliya/shopforge.git
cd shopforge

# 2. Copy the environment file and fill in your values
cp .env.example .env

# 3. Start the full stack (app + PostgreSQL + Redis)
docker-compose up --build

# 4. Run database migrations (in a separate terminal)
docker-compose exec app npm run migrate

# 5. Seed development data (2 vendors, 5 products each, 3 customers)
docker-compose exec app npm run seed
```

The API will be available at `http://localhost:3000`
Swagger docs will be available at `http://localhost:3000/api-docs`

### Manual Setup

If you prefer running without Docker:

```bash
# Install dependencies
npm install

# Set up your .env (see Environment Variables section below)
cp .env.example .env

# Run database migrations
npm run migrate

# Seed development data
npm run seed

# Start the development server with hot reload
npm run dev
```

---

## Environment Variables

Create a `.env` file in the root of the project. **Never commit this file.**

```env
# ── Application ───────────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ── PostgreSQL ─────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:password@localhost:5432/shopforge

# ── Redis ──────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── JWT ────────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# ── Firebase ───────────────────────────────────────────────────
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── Slack ──────────────────────────────────────────────────────
SLACK_ORDERS_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
SLACK_ERRORS_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ

# ── AWS (production only) ──────────────────────────────────────
AWS_REGION=ap-south-1
AWS_S3_BUCKET=shopforge-uploads
```

> **Tip:** See `.env.example` in the repo for the full reference with descriptions for each variable.

---

## API Reference

Interactive docs are available at `/api-docs` when the server is running.

### Authentication

| Method | Endpoint                  | Role   | Description             |
| ------ | ------------------------- | ------ | ----------------------- |
| `POST` | `/auth/register/customer` | Public | Register a new customer |
| `POST` | `/auth/register/vendor`   | Public | Register a new vendor   |
| `POST` | `/auth/login`             | Public | Login and receive a JWT |

### Products

| Method   | Endpoint               | Role     | Description                |
| -------- | ---------------------- | -------- | -------------------------- |
| `GET`    | `/products`            | Customer | Browse all active products |
| `GET`    | `/products/:id`        | Customer | Get product detail         |
| `POST`   | `/vendor/products`     | Vendor   | Create a product           |
| `PATCH`  | `/vendor/products/:id` | Vendor   | Update a product           |
| `DELETE` | `/vendor/products/:id` | Vendor   | Deactivate a product       |

### Orders

| Method  | Endpoint                    | Role     | Description            |
| ------- | --------------------------- | -------- | ---------------------- |
| `POST`  | `/orders`                   | Customer | Place a new order      |
| `GET`   | `/orders`                   | Customer | View own order history |
| `PATCH` | `/orders/:id/cancel`        | Customer | Cancel a pending order |
| `GET`   | `/vendor/orders`            | Vendor   | View FIFO order queue  |
| `PATCH` | `/vendor/orders/:id/status` | Vendor   | Advance order status   |

### Support Chat

| Method | Endpoint                     | Role             | Description      |
| ------ | ---------------------------- | ---------------- | ---------------- |
| `POST` | `/chat/:orderId/message`     | Customer, Vendor | Send a message   |
| `GET`  | `/chat/:orderId/messages`    | Customer, Vendor | Get chat history |
| `POST` | `/chat/:orderId/report`      | Customer         | Report a message |
| `POST` | `/vendor/blocks/:customerId` | Vendor           | Block a customer |

### Admin

| Method  | Endpoint                     | Role       | Description               |
| ------- | ---------------------------- | ---------- | ------------------------- |
| `GET`   | `/admin/vendors`             | SuperAdmin | List all vendors          |
| `PATCH` | `/admin/vendors/:id/suspend` | SuperAdmin | Suspend a vendor          |
| `GET`   | `/admin/stats`               | SuperAdmin | Platform-wide metrics     |
| `GET`   | `/admin/reports`             | SuperAdmin | View flagged chat reports |

### Health

| Method | Endpoint  | Description                            |
| ------ | --------- | -------------------------------------- |
| `GET`  | `/health` | Returns DB + Redis connectivity status |

---

## Database Schema

Core tables and relationships:

```
tenants (vendors)
  └── users          (customers + vendor accounts, scoped by tenant_id)
  └── products       (catalog, scoped by tenant_id)
      └── categories
      └── inventory
  └── orders         (scoped by tenant_id)
      └── order_items
  └── chat_sessions  (per order, scoped by tenant_id)
      └── chat_messages (stored in Firebase Firestore)
  └── reports        (flagged messages)
  └── vendor_blocks  (blocked customer relationships)
```

Full ERD diagram is available in `/docs/erd.png`.

Key design decisions:

- **`tenant_id` on every table** — all queries are scoped; cross-tenant leakage is architecturally impossible at the query level
- **Inventory deducted inside a PostgreSQL transaction** — concurrent orders for the same product cannot both succeed if stock is insufficient
- **Orders use `created_at ASC` indexing** — FIFO queue retrieval is O(log n) not O(n)
- **Chat messages in Firestore, not PostgreSQL** — offloads real-time delivery complexity to Firebase while keeping structured business data in PostgreSQL

---

## CI/CD Pipeline

Every push to `main` triggers the following GitHub Actions workflow:

```
push to main
      │
      ▼
  ┌─────────┐     ┌──────────┐     ┌───────────────┐     ┌──────────────┐
  │  Lint   │────▶│  Tests   │────▶│  Docker Build │────▶│  ECR Push    │
  │ ESLint  │     │  Jest    │     │  (multi-stage)│     │  (tagged     │
  │Prettier │     │Supertest │     │               │     │  with SHA)   │
  └─────────┘     └──────────┘     └───────────────┘     └──────┬───────┘
                                                                 │
                                                          ┌──────▼───────┐
                                                          │  SSH Deploy  │
                                                          │  to EC2      │
                                                          │  (zero-down  │
                                                          │  time swap)  │
                                                          └──────────────┘
```

A failed lint check or test suite blocks the deployment — broken code never reaches production.

Pipeline definition: `.github/workflows/deploy.yml`

---

## Deployment

ShopForge is deployed on AWS using the following architecture:

```
Internet → Nginx (EC2, port 80/443)
              └── Node.js app (Docker, port 3000)
                    ├── AWS RDS PostgreSQL
                    ├── AWS ElastiCache Redis
                    └── Firebase Firestore (external)
```

**AWS services used:**

| Service                      | Purpose               | Tier          |
| ---------------------------- | --------------------- | ------------- |
| EC2 `t2.micro`               | Application host      | Free tier     |
| RDS `db.t3.micro`            | PostgreSQL 15         | Free tier     |
| ElastiCache `cache.t3.micro` | Redis 7               | Free tier     |
| S3                           | Product image uploads | Pay-as-you-go |
| ECR                          | Docker image registry | Pay-as-you-go |
| CloudWatch                   | Logs and monitoring   | Free tier     |

Live URL: `https://shopforge.samir.dev` _(update once deployed)_

---

## Project Structure

```
shopforge/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD pipeline
├── docs/
│   └── erd.png                 # Database ERD diagram
├── src/
│   ├── config/
│   │   ├── db.ts               # PostgreSQL connection pool
│   │   ├── redis.ts            # Redis connection
│   │   ├── firebase.ts         # Firebase Admin SDK
│   │   └── swagger.ts          # OpenAPI spec setup
│   ├── middlewares/
│   │   ├── authenticate.ts     # JWT verification
│   │   ├── authorise.ts        # Role-based access control
│   │   ├── validateBody.ts     # Joi validation factory
│   │   └── error.middleware.ts # Global error handler + Slack alert
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── product.routes.ts
│   │   ├── order.routes.ts
│   │   ├── chat.routes.ts
│   │   └── admin.routes.ts
│   ├── controllers/            # Route handlers (thin layer)
│   ├── services/               # Business logic
│   │   ├── order.service.ts
│   │   ├── cache.service.ts    # Redis helpers
│   │   ├── slack.service.ts    # Order + error alerts
│   │   └── chat.service.ts     # Firebase Firestore
│   ├── schemas/                # Joi validation schemas
│   ├── migrations/             # SQL migration files
│   ├── seeds/                  # Development seed data
│   └── app.ts                  # Express app entry point
├── tests/
│   ├── unit/                   # Service and schema unit tests
│   └── integration/            # API endpoint tests (Supertest)
├── Dockerfile                  # Multi-stage production build
├── docker-compose.yml          # Local dev stack
├── .env.example                # Environment variable reference
└── README.md
```

---

## Roadmap

- [ ] Stripe payment gateway integration
- [ ] WebSocket fallback for chat (where Firestore is restricted)
- [ ] Rate limiting per vendor (prevent API abuse)
- [ ] Product image upload to S3
- [ ] Email notifications via AWS SES
- [ ] Kubernetes deployment manifest (EKS)

---

<div align="center">

Built by **Samir Sakhreliya** · [LinkedIn](https://linkedin.com/in/samir-sakhreliya) · [GitHub](https://github.com/samir-sakhreliya)

_Backend Engineer · Node.js · TypeScript · PostgreSQL · AWS_

</div>
