import { Router } from 'express';
import {
  CustomerAuthRouter,
  VendorAuthRouter,
  SuperAdminAuthRouter,
} from './Auth.Routes';
import { PublicProductRouter, VendorProductRouter } from './Product.Routes';
import { PublicCategoryRouter, VendorCategoryRouter } from './Category.Routes';
import testRoutes from './Test.Routes';

/**
 * Central route table — the single place that maps a URL prefix (api/v1 vs
 * api/v2, resource segment) onto a domain router. Domain router files
 * (Auth.Routes.ts, Product.Routes.ts, Category.Routes.ts, ...) only define
 * paths RELATIVE to their own resource — no prefix should ever be hardcoded
 * in those files.
 *
 * Adding a new feature module: create its router file exporting one Router
 * per prefix group, import it here, and add one router.use(prefix, ...) line.
 */
const router = Router();

// ─── Auth ───────────────────────────────────────────────────────────────────
router.use('/api/v2/users', CustomerAuthRouter);
router.use('/api/v1/vendor', VendorAuthRouter);
router.use('/api/v1/superadmin', SuperAdminAuthRouter);

// ─── Products (KAN-21) ──────────────────────────────────────────────────────
router.use('/api/v2/products', PublicProductRouter);
router.use('/api/v1/vendor/products', VendorProductRouter);

// ─── Categories ──────────────────────────────────────────────────────────────
router.use('/api/v2/categories', PublicCategoryRouter);
router.use('/api/v1/vendor/categories', VendorCategoryRouter);

// ─── RBAC smoke-test routes (legacy, self-contained absolute paths) ───────
// NOTE: Test.Routes.ts declares its own stub `GET /api/v2/products` for RBAC
// testing. It is shadowed by PublicProductRouter above since that's
// registered first and Express matches in registration order — kept for
// reference but effectively dead now that the real Products module exists.
router.use(testRoutes);

export default router;
