import { Router } from 'express';
import authenticate from '../Middlewares/authenticate';
import authorise from '../Middlewares/authorise';
import validateBody from '../Middlewares/validateBody';
import {
  addCartItemSchema,
  updateCartItemSchema,
} from '../Schemas/Cart.Schema';
import { getCart } from '../Controllers/Cart/GetCart.Controller';
import { addItem } from '../Controllers/Cart/AddItem.Controller';
import { updateItem } from '../Controllers/Cart/UpdateItem.Controller';
import { removeItem } from '../Controllers/Cart/RemoveItem.Controller';
import { clearCart } from '../Controllers/Cart/ClearCart.Controller';

// Only defines paths RELATIVE to /api/v2/cart — the prefix itself is applied
// centrally in Routes/index.ts, matching the convention set by Product/
// Category routers.

// ─── Customer Cart (mounted at /api/v2/cart) ───────────────────────────────
// All routes require an authenticated Customer. The cart is global to the
// customer (not tenant-scoped) — it's what lets a single cart hold items
// from multiple different vendor storefronts at once.

export const CustomerCartRouter = Router();

/**
 * @openapi
 * /api/v2/cart:
 *   get:
 *     tags: [Customer Cart]
 *     summary: View the logged-in customer's cart, grouped by vendor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Cart contents (items + per-vendor grouping + subtotal) }
 *       401: { description: Missing/invalid token }
 */
CustomerCartRouter.get('/', authenticate, authorise(['Customer']), getCart);

/**
 * @openapi
 * /api/v2/cart:
 *   delete:
 *     tags: [Customer Cart]
 *     summary: Empty the customer's entire cart
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Cart cleared }
 *       401: { description: Missing/invalid token }
 */
CustomerCartRouter.delete(
  '/',
  authenticate,
  authorise(['Customer']),
  clearCart,
);

/**
 * @openapi
 * /api/v2/cart/items:
 *   post:
 *     tags: [Customer Cart]
 *     summary: Add a product to the cart
 *     description: >
 *       If the product is already in the cart, the quantities are merged
 *       (not duplicated as a second line). Validated against live stock —
 *       the authoritative, race-free check happens again at checkout.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id]
 *             properties:
 *               product_id: { type: string, format: uuid }
 *               quantity:   { type: integer, minimum: 1, default: 1 }
 *     responses:
 *       201: { description: Item added (or merged) into the cart }
 *       404: { description: Product not found, inactive, or storefront not active }
 *       409: { description: Requested quantity exceeds available stock }
 */
CustomerCartRouter.post(
  '/items',
  authenticate,
  authorise(['Customer']),
  validateBody(addCartItemSchema),
  addItem,
);

/**
 * @openapi
 * /api/v2/cart/items/{productId}:
 *   put:
 *     tags: [Customer Cart]
 *     summary: Set the quantity of a product already in the cart
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Cart item updated }
 *       404: { description: Item not found in cart }
 *       409: { description: Requested quantity exceeds available stock }
 */
CustomerCartRouter.put(
  '/items/:productId',
  authenticate,
  authorise(['Customer']),
  validateBody(updateCartItemSchema),
  updateItem,
);

/**
 * @openapi
 * /api/v2/cart/items/{productId}:
 *   delete:
 *     tags: [Customer Cart]
 *     summary: Remove a single product line from the cart
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Item removed from cart }
 *       404: { description: Item not found in cart }
 */
CustomerCartRouter.delete(
  '/items/:productId',
  authenticate,
  authorise(['Customer']),
  removeItem,
);
