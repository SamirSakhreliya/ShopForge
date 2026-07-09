import { Router } from 'express';
import authenticate from '../Middlewares/authenticate';
import authorise from '../Middlewares/authorise';
import validateBody from '../Middlewares/validateBody';
import validateQuery from '../Middlewares/validateQuery';
import {
  createCategorySchema,
  updateCategorySchema,
  publicListCategoryQuerySchema,
  vendorListCategoryQuerySchema,
  createCategoryWithProductsSchema,
} from '../Schemas/Category.Schema';
import { listPublic } from '../Controllers/Category/ListPublic.Controller';
import { getPublicById } from '../Controllers/Category/GetPublicById.Controller';
import { listVendor } from '../Controllers/Category/ListVendor.Controller';
import { getVendorById } from '../Controllers/Category/GetVendorById.Controller';
import { create } from '../Controllers/Category/Create.Controller';
import { update } from '../Controllers/Category/Update.Controller';
import { deleteCategory } from '../Controllers/Category/Delete.Controller';
import { createWithProducts } from '../Controllers/Category/CreateWithProducts.Controller';

// Each router below only defines paths RELATIVE to its own resource segment.
// The actual URL prefix (/api/v2/categories vs /api/v1/vendor/categories) is
// applied centrally in Routes/index.ts — keep that file in sync with any
// path added/removed here.

// ─── Public / Customer Catalogue  (mounted at /api/v2/categories) ─────────

export const PublicCategoryRouter = Router();

/**
 * @openapi
 * /api/v2/categories:
 *   get:
 *     tags: [Customer Catalogue]
 *     summary: Browse the public category list (filters + pagination)
 *     description: Returns only active categories belonging to active storefronts.
 *     parameters:
 *       - in: query
 *         name: tenant_id
 *         schema: { type: string, format: uuid }
 *         description: Browse a single storefront's categories
 *       - in: query
 *         name: parent_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Paginated category list }
 *       400: { description: Invalid filter parameters }
 */
PublicCategoryRouter.get(
  '/',
  validateQuery(publicListCategoryQuerySchema),
  listPublic,
);

/**
 * @openapi
 * /api/v2/categories/{id}:
 *   get:
 *     tags: [Customer Catalogue]
 *     summary: Get a single category's public detail
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Category detail }
 *       404: { description: Category not found, inactive, or storefront not active }
 */
PublicCategoryRouter.get('/:id', getPublicById);

// ─── Vendor Catalogue  (mounted at /api/v1/vendor/categories) ─────────────
// All routes require an authenticated Vendor and are scoped to their own tenant.

export const VendorCategoryRouter = Router();

/**
 * @openapi
 * /api/v1/vendor/categories:
 *   get:
 *     tags: [Vendor Catalogue]
 *     summary: List the vendor's own categories (all statuses, filters + pagination)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: parent_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *         description: Omit to return every status
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Paginated category list }
 *       401: { description: Missing/invalid token }
 *       403: { description: Not a Vendor }
 */
VendorCategoryRouter.get(
  '/',
  authenticate,
  authorise(['Vendor']),
  validateQuery(vendorListCategoryQuerySchema),
  listVendor,
);

/**
 * @openapi
 * /api/v1/vendor/categories/{id}:
 *   get:
 *     tags: [Vendor Catalogue]
 *     summary: Get one of the vendor's own categories
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Category detail }
 *       404: { description: Not found or not owned by this vendor }
 */
VendorCategoryRouter.get(
  '/:id',
  authenticate,
  authorise(['Vendor']),
  getVendorById,
);

/**
 * @openapi
 * /api/v1/vendor/categories:
 *   post:
 *     tags: [Vendor Catalogue]
 *     summary: Create a new category in the vendor's own storefront
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, maxLength: 100 }
 *               slug:        { type: string, description: "Auto-generated from name if omitted" }
 *               description: { type: string }
 *               image_url:   { type: string, format: uri }
 *               parent_id:   { type: string, format: uuid, description: "One level of nesting supported" }
 *               sort_order:  { type: integer, default: 0 }
 *               is_active:   { type: boolean, default: true }
 *     responses:
 *       201: { description: Category created }
 *       400: { description: Validation error }
 *       409: { description: Slug already in use for this storefront }
 */
VendorCategoryRouter.post(
  '/',
  authenticate,
  authorise(['Vendor']),
  validateBody(createCategorySchema),
  create,
);

/**
 * @openapi
 * /api/v1/vendor/categories/bulk:
 *   post:
 *     tags: [Vendor Catalogue]
 *     summary: Create a category with multiple products in one atomic call
 *     description: >
 *       "Add an entire category with multiple products in one click." Category
 *       and every product are created in a single DB transaction — either all
 *       of it lands, or none of it does.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, products]
 *             properties:
 *               category:
 *                 type: object
 *                 required: [name]
 *                 properties:
 *                   name:        { type: string, maxLength: 100 }
 *                   slug:        { type: string }
 *                   description: { type: string }
 *                   image_url:   { type: string, format: uri }
 *                   parent_id:   { type: string, format: uuid }
 *                   sort_order:  { type: integer, default: 0 }
 *                   is_active:   { type: boolean, default: true }
 *               products:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [name, price]
 *                   properties:
 *                     name:           { type: string, maxLength: 200 }
 *                     slug:           { type: string }
 *                     description:    { type: string }
 *                     price:          { type: number }
 *                     compare_price:  { type: number }
 *                     cost_price:     { type: number }
 *                     stock_quantity: { type: integer, default: 0 }
 *                     sku:            { type: string }
 *                     barcode:        { type: string }
 *                     weight_grams:   { type: integer }
 *                     is_active:      { type: boolean, default: true }
 *                     is_featured:    { type: boolean, default: false }
 *     responses:
 *       201: { description: Category + products created }
 *       400: { description: Validation error }
 *       409: { description: Slug or SKU already in use for this storefront }
 */
VendorCategoryRouter.post(
  '/bulk',
  authenticate,
  authorise(['Vendor']),
  validateBody(createCategoryWithProductsSchema),
  createWithProducts,
);

/**
 * @openapi
 * /api/v1/vendor/categories/{id}:
 *   put:
 *     tags: [Vendor Catalogue]
 *     summary: Update a category owned by the vendor (partial update)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, description: "Any subset of the create fields" }
 *     responses:
 *       200: { description: Category updated }
 *       404: { description: Not found or not owned by this vendor }
 *       409: { description: Slug already in use for this storefront }
 */
VendorCategoryRouter.put(
  '/:id',
  authenticate,
  authorise(['Vendor']),
  validateBody(updateCategorySchema),
  update,
);

/**
 * @openapi
 * /api/v1/vendor/categories/{id}:
 *   delete:
 *     tags: [Vendor Catalogue]
 *     summary: Delete a category owned by the vendor
 *     description: >
 *       Hard delete. Safe against child categories and products —
 *       categories.parent_id and products.category_id are both
 *       ON DELETE SET NULL (see 003/004_*.sql migrations).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Category deleted }
 *       404: { description: Not found or not owned by this vendor }
 */
VendorCategoryRouter.delete(
  '/:id',
  authenticate,
  authorise(['Vendor']),
  deleteCategory,
);
