import { Router } from 'express';
import { authController } from '../Controllers/Auth.Controller';
import validateBody from '../Middlewares/validateBody';
import {
  customerRegisterSchema,
  customerLoginSchema,
  vendorRegisterSchema,
  vendorLoginSchema,
  superAdminLoginSchema,
} from '../Schemas/Auth.Schema';

const router = Router();

// ─── Customer Auth  (/api/v2/users) ────────────────────────────────────────

/**
 * @openapi
 * /api/v2/users/register:
 *   post:
 *     tags: [Customer Auth]
 *     summary: Register a new Customer on a vendor's storefront
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email, password, tenant_id]
 *             properties:
 *               first_name:  { type: string, maxLength: 80 }
 *               last_name:   { type: string, maxLength: 80 }
 *               email:       { type: string, format: email }
 *               password:    { type: string, minLength: 8 }
 *               tenant_id:   { type: string, format: uuid, description: "Vendor storefront ID (tenants_management.tenants.id)" }
 *               phone:       { type: string, maxLength: 30 }
 *     responses:
 *       201: { description: Customer created }
 *       400: { description: Validation error }
 *       404: { description: Storefront not found or not active }
 *       409: { description: Email already registered on this storefront }
 */
router.post(
  '/api/v2/users/register',
  validateBody(customerRegisterSchema),
  authController.registerCustomer,
);

/**
 * @openapi
 * /api/v2/users/login:
 *   post:
 *     tags: [Customer Auth]
 *     summary: Login as Customer (scoped to a storefront)
 *     description: >
 *       Email uniqueness is per-storefront. tenant_id is required to identify
 *       which storefront the customer belongs to.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, tenant_id]
 *             properties:
 *               email:     { type: string, format: email }
 *               password:  { type: string }
 *               tenant_id: { type: string, format: uuid }
 *     responses:
 *       200: { description: JWT + user returned }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
router.post(
  '/api/v2/users/login',
  validateBody(customerLoginSchema),
  authController.loginCustomer,
);

// ─── Vendor Auth  (/api/v1/vendor) ─────────────────────────────────────────

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
router.post(
  '/api/v1/vendor/register',
  validateBody(vendorRegisterSchema),
  authController.registerVendor,
);

/**
 * @openapi
 * /api/v1/vendor/login:
 *   post:
 *     tags: [Vendor Auth]
 *     summary: Login as Vendor
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
 *       200: { description: JWT + user returned }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
router.post(
  '/api/v1/vendor/login',
  validateBody(vendorLoginSchema),
  authController.loginVendor,
);

// ─── SuperAdmin Auth  (/api/v1/superadmin) ─────────────────────────────────

/**
 * @openapi
 * /api/v1/superadmin/login:
 *   post:
 *     tags: [SuperAdmin Auth]
 *     summary: Login as SuperAdmin
 *     description: SuperAdmin has no tenant. Email is globally unique (partial index WHERE role = 'SuperAdmin').
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
 *       200: { description: JWT + user returned }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
router.post(
  '/api/v1/superadmin/login',
  validateBody(superAdminLoginSchema),
  authController.loginSuperAdmin,
);

export default router;
