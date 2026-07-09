import { Router } from 'express';
import authenticate from '../Middlewares/authenticate';
import authorise from '../Middlewares/authorise';
import validateBody from '../Middlewares/validateBody';
import validateQuery from '../Middlewares/validateQuery';
import uploadProductImage from '../Middlewares/uploadProductImage';
import {
  createProductSchema,
  updateProductSchema,
  publicListQuerySchema,
  vendorListQuerySchema,
} from '../Schemas/Product.Schema';
import { listPublic } from '../Controllers/Product/ListPublic.Controller';
import { getPublicById } from '../Controllers/Product/GetPublicById.Controller';
import { listVendor } from '../Controllers/Product/ListVendor.Controller';
import { getVendorById } from '../Controllers/Product/GetVendorById.Controller';
import { create } from '../Controllers/Product/Create.Controller';
import { update } from '../Controllers/Product/Update.Controller';
import { deleteProduct } from '../Controllers/Product/Delete.Controller';
import { uploadImage } from '../Controllers/Product/UploadImage.Controller';
import { deleteImage } from '../Controllers/Product/DeleteImage.Controller';
import { setPrimaryImage } from '../Controllers/Product/SetPrimaryImage.Controller';

// Each router below only defines paths RELATIVE to its own resource segment.
// The actual URL prefix (/api/v2/products vs /api/v1/vendor/products) is
// applied centrally in Routes/index.ts — keep that file in sync with any
// path added/removed here.

// ─── Public / Customer Catalogue  (mounted at /api/v2/products) ───────────
// No auth required — this is the customer-facing storefront browse.

export const PublicProductRouter = Router();

/**
 * @openapi
 * /api/v2/products:
 *   get:
 *     tags: [Customer Catalogue]
 *     summary: Browse the public product catalogue (filters + pagination)
 *     description: >
 *       Returns only active products belonging to active storefronts.
 *       Excludes cost_price and any vendor-only fields. Cached in Redis
 *       for 5 minutes per unique filter combination.
 *     parameters:
 *       - in: query
 *         name: tenant_id
 *         schema: { type: string, format: uuid }
 *         description: Browse a single storefront's catalogue
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: min_price
 *         schema: { type: number }
 *       - in: query
 *         name: max_price
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches product name or description (ILIKE)
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [price_asc, price_desc, newest, featured], default: newest }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Paginated product list }
 *       400: { description: Invalid filter parameters }
 */
PublicProductRouter.get('/', validateQuery(publicListQuerySchema), listPublic);

/**
 * @openapi
 * /api/v2/products/{id}:
 *   get:
 *     tags: [Customer Catalogue]
 *     summary: Get a single product's public detail
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Product detail with images }
 *       404: { description: Product not found, inactive, or storefront not active }
 */
PublicProductRouter.get('/:id', getPublicById);

// ─── Vendor Catalogue  (mounted at /api/v1/vendor/products) ───────────────
// All routes require an authenticated Vendor and are scoped to their own tenant.

export const VendorProductRouter = Router();

/**
 * @openapi
 * /api/v1/vendor/products:
 *   get:
 *     tags: [Vendor Catalogue]
 *     summary: List the vendor's own products (all statuses, filters + pagination)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: min_price
 *         schema: { type: number }
 *       - in: query
 *         name: max_price
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *         description: Omit to return every status
 *       - in: query
 *         name: is_featured
 *         schema: { type: boolean }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [price_asc, price_desc, newest, featured, stock_low, stock_high], default: newest }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Paginated product list (includes cost_price, sku, stock) }
 *       401: { description: Missing/invalid token }
 *       403: { description: Not a Vendor }
 */
VendorProductRouter.get(
  '/',
  authenticate,
  authorise(['Vendor']),
  validateQuery(vendorListQuerySchema),
  listVendor,
);

/**
 * @openapi
 * /api/v1/vendor/products/{id}:
 *   get:
 *     tags: [Vendor Catalogue]
 *     summary: Get one of the vendor's own products
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Product detail with images }
 *       404: { description: Not found or not owned by this vendor }
 */
VendorProductRouter.get(
  '/:id',
  authenticate,
  authorise(['Vendor']),
  getVendorById,
);

/**
 * @openapi
 * /api/v1/vendor/products:
 *   post:
 *     tags: [Vendor Catalogue]
 *     summary: Create a new product in the vendor's own storefront
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               name:           { type: string, maxLength: 200 }
 *               slug:           { type: string, description: "Auto-generated from name if omitted" }
 *               description:    { type: string }
 *               category_id:    { type: string, format: uuid }
 *               price:          { type: number }
 *               compare_price:  { type: number }
 *               cost_price:     { type: number }
 *               stock_quantity: { type: integer, default: 0 }
 *               sku:            { type: string }
 *               barcode:        { type: string }
 *               weight_grams:   { type: integer }
 *               is_active:      { type: boolean, default: true }
 *               is_featured:    { type: boolean, default: false }
 *     responses:
 *       201: { description: Product created }
 *       400: { description: Validation error }
 *       409: { description: Slug or SKU already in use for this storefront }
 */
VendorProductRouter.post(
  '/',
  authenticate,
  authorise(['Vendor']),
  validateBody(createProductSchema),
  create,
);

/**
 * @openapi
 * /api/v1/vendor/products/{id}:
 *   put:
 *     tags: [Vendor Catalogue]
 *     summary: Update a product owned by the vendor (partial update)
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
 *       200: { description: Product updated }
 *       404: { description: Not found or not owned by this vendor }
 *       409: { description: Slug or SKU already in use for this storefront }
 */
VendorProductRouter.put(
  '/:id',
  authenticate,
  authorise(['Vendor']),
  validateBody(updateProductSchema),
  update,
);

/**
 * @openapi
 * /api/v1/vendor/products/{id}:
 *   delete:
 *     tags: [Vendor Catalogue]
 *     summary: Delete a product owned by the vendor
 *     description: >
 *       Hard delete. Safe against historical orders — order_items.product_id
 *       is a nullable soft reference (ON DELETE SET NULL).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Product deleted }
 *       404: { description: Not found or not owned by this vendor }
 */
VendorProductRouter.delete(
  '/:id',
  authenticate,
  authorise(['Vendor']),
  deleteProduct,
);

// ─── Product Images (vendor only) ──────────────────────────────────────────

/**
 * @openapi
 * /api/v1/vendor/products/{id}/images:
 *   post:
 *     tags: [Vendor Catalogue]
 *     summary: Upload a product image (multipart/form-data, field name "image")
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:    { type: string, format: binary }
 *               alt_text: { type: string }
 *     responses:
 *       201: { description: Image uploaded (first image for a product is auto-marked primary) }
 *       400: { description: No file provided or invalid file type }
 *       404: { description: Product not found or not owned by this vendor }
 */
VendorProductRouter.post(
  '/:id/images',
  authenticate,
  authorise(['Vendor']),
  uploadProductImage.single('image'),
  uploadImage,
);

/**
 * @openapi
 * /api/v1/vendor/products/{id}/images/{imageId}:
 *   delete:
 *     tags: [Vendor Catalogue]
 *     summary: Delete a product image
 *     description: If the deleted image was primary, the next oldest image (if any) is promoted.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Image deleted }
 *       404: { description: Image not found }
 */
VendorProductRouter.delete(
  '/:id/images/:imageId',
  authenticate,
  authorise(['Vendor']),
  deleteImage,
);

/**
 * @openapi
 * /api/v1/vendor/products/{id}/images/{imageId}/primary:
 *   patch:
 *     tags: [Vendor Catalogue]
 *     summary: Set an image as the product's primary (thumbnail) image
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Primary image updated }
 *       404: { description: Image not found }
 */
VendorProductRouter.patch(
  '/:id/images/:imageId/primary',
  authenticate,
  authorise(['Vendor']),
  setPrimaryImage,
);
