/**
 * Test.Routes.ts
 *
 * Lightweight RBAC smoke-test routes — used to verify that authenticate +
 * authorise middleware enforce role gates correctly. Replace with real
 * feature routes as they are built.
 */
import { Router, Request, Response } from 'express';
import authenticate from '../Middlewares/authenticate';
import authorise from '../Middlewares/authorise';

const router = Router();

// ─── Any authenticated user ─────────────────────────────────────────────────

/**
 * @openapi
 * /api/v2/me:
 *   get:
 *     tags: [RBAC Test]
 *     summary: Return the authenticated user's identity (any role)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User identity }
 *       401: { description: No / invalid token }
 */
router.get('/api/v2/me', authenticate, (req: Request, res: Response): void => {
  res.success('Authenticated', { user: req.user });
});

// ─── Customer only ───────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v2/users/profile:
 *   get:
 *     tags: [RBAC Test]
 *     summary: Customer profile (Customer role only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile data }
 *       401: { description: Unauthenticated }
 *       403: { description: Wrong role }
 */
router.get(
  '/api/v2/users/profile',
  authenticate,
  authorise(['Customer']),
  (req: Request, res: Response): void => {
    res.success('Customer profile', { user: req.user });
  },
);

// ─── Vendor only ─────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/vendor/dashboard:
 *   get:
 *     tags: [RBAC Test]
 *     summary: Vendor dashboard (Vendor role only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard data }
 *       401: { description: Unauthenticated }
 *       403: { description: Wrong role }
 */
router.get(
  '/api/v1/vendor/dashboard',
  authenticate,
  authorise(['Vendor']),
  (req: Request, res: Response): void => {
    res.success('Vendor dashboard', { user: req.user });
  },
);

// ─── SuperAdmin only ─────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/superadmin/dashboard:
 *   get:
 *     tags: [RBAC Test]
 *     summary: SuperAdmin dashboard (SuperAdmin role only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard data }
 *       401: { description: Unauthenticated }
 *       403: { description: Wrong role }
 */
router.get(
  '/api/v1/superadmin/dashboard',
  authenticate,
  authorise(['SuperAdmin']),
  (req: Request, res: Response): void => {
    res.success('SuperAdmin dashboard', { user: req.user });
  },
);

// ─── Customer + Vendor (no SuperAdmin) ───────────────────────────────────────

/**
 * @openapi
 * /api/v2/products:
 *   get:
 *     tags: [RBAC Test]
 *     summary: Product listing (Customer and Vendor only — no SuperAdmin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Products }
 *       401: { description: Unauthenticated }
 *       403: { description: Wrong role }
 */
router.get(
  '/api/v2/products',
  authenticate,
  authorise(['Customer', 'Vendor']),
  (req: Request, res: Response): void => {
    res.success('Products (stub)', { items: [], requested_by: req.user });
  },
);

export default router;
