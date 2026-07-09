import { Router } from 'express';
import authenticate from '../Middlewares/authenticate';
import authorise from '../Middlewares/authorise';
import validateBody from '../Middlewares/validateBody';
import validateQuery from '../Middlewares/validateQuery';
import {
  customerRegisterSchema,
  customerLoginSchema,
  vendorRegisterSchema,
  vendorLoginSchema,
  superAdminLoginSchema,
  refreshTokenSchema,
  verificationStatusQuerySchema,
  rejectVerificationSchema,
} from '../Schemas/Auth.Schema';
import { registerCustomer } from '../Controllers/Auth/RegisterCustomer.Controller';
import { loginCustomer } from '../Controllers/Auth/LoginCustomer.Controller';
import { registerVendor } from '../Controllers/Auth/RegisterVendor.Controller';
import { loginVendor } from '../Controllers/Auth/LoginVendor.Controller';
import { loginSuperAdmin } from '../Controllers/Auth/LoginSuperAdmin.Controller';
import { refreshToken } from '../Controllers/Auth/RefreshToken.Controller';
import { logout } from '../Controllers/Auth/Logout.Controller';
import { requestEmailVerification } from '../Controllers/Auth/RequestEmailVerification.Controller';
import { listEmailVerificationRequests } from '../Controllers/Auth/ListEmailVerificationRequests.Controller';
import { approveEmailVerification } from '../Controllers/Auth/ApproveEmailVerification.Controller';
import { rejectEmailVerification } from '../Controllers/Auth/RejectEmailVerification.Controller';

// Each router below only defines paths RELATIVE to its own resource segment.
// The actual URL prefix (/api/v2/users, /api/v1/vendor, /api/v1/superadmin)
// is applied centrally in Routes/index.ts — keep that file in sync with any
// path added/removed here.

// ─── Customer Auth  (mounted at /api/v2/users) ─────────────────────────────

export const CustomerAuthRouter = Router();

/**
 * @openapi
 * /api/v2/users/register:
 *   post:
 *     tags: [Customer Auth]
 *     summary: Register a new Customer (global account, platform-wide)
 *     description: >
 *       Customer identity is global — one account works across every vendor
 *       storefront. tenant_id is optional; pass it if the customer is signing
 *       up while browsing a specific vendor's storefront, to immediately
 *       create a customer_vendor_links relationship with that vendor.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email, password]
 *             properties:
 *               first_name:  { type: string, maxLength: 80 }
 *               last_name:   { type: string, maxLength: 80 }
 *               email:       { type: string, format: email }
 *               password:    { type: string, minLength: 8 }
 *               tenant_id:   { type: string, format: uuid, description: "Optional: vendor storefront ID to auto-link on signup (tenants_management.tenants.id)" }
 *               phone:       { type: string, maxLength: 30 }
 *     responses:
 *       201: { description: Customer created }
 *       400: { description: Validation error }
 *       404: { description: Storefront not found or not active (only if tenant_id was supplied) }
 *       409: { description: Email already registered }
 */
CustomerAuthRouter.post(
  '/register',
  validateBody(customerRegisterSchema),
  registerCustomer,
);

/**
 * @openapi
 * /api/v2/users/login:
 *   post:
 *     tags: [Customer Auth]
 *     summary: Login as Customer (global account)
 *     description: >
 *       Email uniqueness is platform-wide. One account logs in and shops
 *       across every vendor storefront — no tenant_id needed. Returns a
 *       short-lived access token (15m) plus a refresh token (30d) — see
 *       POST /api/v2/users/refresh below.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:     { type: string, format: email }
 *               password:  { type: string }
 *     responses:
 *       200: { description: Access token + refresh token + user returned }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
CustomerAuthRouter.post(
  '/login',
  validateBody(customerLoginSchema),
  loginCustomer,
);

/**
 * @openapi
 * /api/v2/users/refresh:
 *   post:
 *     tags: [Customer Auth]
 *     summary: Exchange a refresh token for a new access + refresh token pair
 *     description: Refresh tokens rotate on every use — the old one is revoked immediately.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: New access token + refresh token + user returned }
 *       401: { description: Invalid, expired, or already-used refresh token }
 *       403: { description: Account deactivated }
 */
CustomerAuthRouter.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  refreshToken,
);

/**
 * @openapi
 * /api/v2/users/logout:
 *   post:
 *     tags: [Customer Auth]
 *     summary: Revoke a refresh token (logout on one device)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: Logged out (always succeeds) }
 */
CustomerAuthRouter.post('/logout', validateBody(refreshTokenSchema), logout);

/**
 * @openapi
 * /api/v2/users/verify-email/request:
 *   post:
 *     tags: [Customer Auth]
 *     summary: Request email verification (Customer)
 *     description: >
 *       Queues a manual verification request for SuperAdmin review — no
 *       email is sent yet. Fails if already verified or a pending request
 *       already exists.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Verification requested }
 *       400: { description: Email already verified }
 *       409: { description: A pending request already exists }
 */
CustomerAuthRouter.post(
  '/verify-email/request',
  authenticate,
  authorise(['Customer']),
  requestEmailVerification,
);

// ─── Vendor Auth  (mounted at /api/v1/vendor) ──────────────────────────────

export const VendorAuthRouter = Router();

/**
 * @openapi
 * /api/v1/vendor/register:
 *   post:
 *     tags: [Vendor Auth]
 *     summary: Register a new Vendor (creates storefront tenant + vendor user in one transaction)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email, password, store_name, store_slug, contact_email]
 *             properties:
 *               first_name:       { type: string, maxLength: 80 }
 *               last_name:        { type: string, maxLength: 80 }
 *               email:            { type: string, format: email, description: "Vendor login email" }
 *               password:         { type: string, minLength: 8 }
 *               phone:            { type: string, maxLength: 30 }
 *               store_name:       { type: string, maxLength: 120, description: "Display name of the storefront" }
 *               store_slug:       { type: string, maxLength: 80, description: "URL-safe identifier e.g. my-store" }
 *               contact_email:    { type: string, format: email, description: "Storefront contact email (can differ from login)" }
 *               contact_phone:    { type: string, maxLength: 30 }
 *               business_address: { type: string }
 *     responses:
 *       201: { description: Vendor + tenant created }
 *       400: { description: Validation error }
 *       409: { description: Email or slug already taken }
 */
VendorAuthRouter.post(
  '/register',
  validateBody(vendorRegisterSchema),
  registerVendor,
);

/**
 * @openapi
 * /api/v1/vendor/login:
 *   post:
 *     tags: [Vendor Auth]
 *     summary: Login as Vendor
 *     description: Returns a short-lived access token (15m) plus a refresh token (30d) — see POST /api/v1/vendor/refresh below.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Access token + refresh token + user returned }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
VendorAuthRouter.post('/login', validateBody(vendorLoginSchema), loginVendor);

/**
 * @openapi
 * /api/v1/vendor/refresh:
 *   post:
 *     tags: [Vendor Auth]
 *     summary: Exchange a refresh token for a new access + refresh token pair
 *     description: Refresh tokens rotate on every use — the old one is revoked immediately.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: New access token + refresh token + user returned }
 *       401: { description: Invalid, expired, or already-used refresh token }
 *       403: { description: Account deactivated }
 */
VendorAuthRouter.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  refreshToken,
);

/**
 * @openapi
 * /api/v1/vendor/logout:
 *   post:
 *     tags: [Vendor Auth]
 *     summary: Revoke a refresh token (logout on one device)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: Logged out (always succeeds) }
 */
VendorAuthRouter.post('/logout', validateBody(refreshTokenSchema), logout);

/**
 * @openapi
 * /api/v1/vendor/verify-email/request:
 *   post:
 *     tags: [Vendor Auth]
 *     summary: Request email verification (Vendor)
 *     description: >
 *       Queues a manual verification request for SuperAdmin review — no
 *       email is sent yet. Fails if already verified or a pending request
 *       already exists.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Verification requested }
 *       400: { description: Email already verified }
 *       409: { description: A pending request already exists }
 */
VendorAuthRouter.post(
  '/verify-email/request',
  authenticate,
  authorise(['Vendor']),
  requestEmailVerification,
);

// ─── SuperAdmin Auth  (mounted at /api/v1/superadmin) ──────────────────────

export const SuperAdminAuthRouter = Router();

/**
 * @openapi
 * /api/v1/superadmin/login:
 *   post:
 *     tags: [SuperAdmin Auth]
 *     summary: Login as SuperAdmin
 *     description: >
 *       SuperAdmin has no tenant. Email is globally unique (partial index
 *       WHERE role = 'SuperAdmin'). Returns a short-lived access token (15m)
 *       plus a refresh token (30d) — see POST /api/v1/superadmin/refresh below.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Access token + refresh token + user returned }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
SuperAdminAuthRouter.post(
  '/login',
  validateBody(superAdminLoginSchema),
  loginSuperAdmin,
);

/**
 * @openapi
 * /api/v1/superadmin/refresh:
 *   post:
 *     tags: [SuperAdmin Auth]
 *     summary: Exchange a refresh token for a new access + refresh token pair
 *     description: Refresh tokens rotate on every use — the old one is revoked immediately.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: New access token + refresh token + user returned }
 *       401: { description: Invalid, expired, or already-used refresh token }
 *       403: { description: Account deactivated }
 */
SuperAdminAuthRouter.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  refreshToken,
);

/**
 * @openapi
 * /api/v1/superadmin/logout:
 *   post:
 *     tags: [SuperAdmin Auth]
 *     summary: Revoke a refresh token (logout on one device)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: Logged out (always succeeds) }
 */
SuperAdminAuthRouter.post('/logout', validateBody(refreshTokenSchema), logout);

/**
 * @openapi
 * /api/v1/superadmin/verify-email/requests:
 *   get:
 *     tags: [SuperAdmin Auth]
 *     summary: List email verification requests (manual review queue)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *         description: Omit to return every status
 *     responses:
 *       200: { description: List of verification requests, newest first }
 */
SuperAdminAuthRouter.get(
  '/verify-email/requests',
  authenticate,
  authorise(['SuperAdmin']),
  validateQuery(verificationStatusQuerySchema),
  listEmailVerificationRequests,
);

/**
 * @openapi
 * /api/v1/superadmin/verify-email/requests/{id}/approve:
 *   post:
 *     tags: [SuperAdmin Auth]
 *     summary: Approve a pending email verification request
 *     description: Sets the requesting user's is_email_verified to TRUE.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Approved }
 *       404: { description: Pending request not found }
 */
SuperAdminAuthRouter.post(
  '/verify-email/requests/:id/approve',
  authenticate,
  authorise(['SuperAdmin']),
  approveEmailVerification,
);

/**
 * @openapi
 * /api/v1/superadmin/verify-email/requests/{id}/reject:
 *   post:
 *     tags: [SuperAdmin Auth]
 *     summary: Reject a pending email verification request
 *     description: is_email_verified stays FALSE; the user may submit a new request later.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string, maxLength: 500 }
 *     responses:
 *       200: { description: Rejected }
 *       404: { description: Pending request not found }
 */
SuperAdminAuthRouter.post(
  '/verify-email/requests/:id/reject',
  authenticate,
  authorise(['SuperAdmin']),
  validateBody(rejectVerificationSchema),
  rejectEmailVerification,
);
