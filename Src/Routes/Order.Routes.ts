import { Router } from 'express';
import authenticate from '../Middlewares/authenticate';
import authorise from '../Middlewares/authorise';
import validateBody from '../Middlewares/validateBody';
import validateQuery from '../Middlewares/validateQuery';
import {
  checkoutSchema,
  vendorListOrdersQuerySchema,
  customerListOrdersQuerySchema,
  updateOrderStatusSchema,
} from '../Schemas/Order.Schema';
import { checkout } from '../Controllers/Order/Checkout.Controller';
import { listCustomer } from '../Controllers/Order/ListCustomer.Controller';
import { getCustomerById } from '../Controllers/Order/GetCustomerById.Controller';
import { listVendor } from '../Controllers/Order/ListVendor.Controller';
import { getVendorById } from '../Controllers/Order/GetVendorById.Controller';
import { updateStatus } from '../Controllers/Order/UpdateStatus.Controller';

// Each router below only defines paths RELATIVE to its own resource segment.
// The actual URL prefix (/api/v2/orders vs /api/v1/vendor/orders) is applied
// centrally in Routes/index.ts — matches the Product/Category convention.

// ─── Customer Orders (mounted at /api/v2/orders) ──────────────────────────
// All routes require an authenticated Customer, scoped to their own orders
// (never another customer's, and not scoped to a single vendor — a
// customer's order history spans every storefront they've bought from).

export const CustomerOrderRouter = Router();

/**
 * @openapi
 * /api/v2/orders/checkout:
 *   post:
 *     tags: [Customer Orders]
 *     summary: Check out the customer's entire cart
 *     description: >
 *       If the cart holds items from multiple vendors, this creates ONE
 *       ORDER PER VENDOR atomically in a single DB transaction (all-or-
 *       nothing — a stock failure on one vendor's line rolls back every
 *       order that would have been created). Response `data.orders` is
 *       always an array, even when only one vendor is involved.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shipping_name, shipping_phone, shipping_address, shipping_city, shipping_country, shipping_zip]
 *             properties:
 *               shipping_name:    { type: string, maxLength: 120 }
 *               shipping_phone:   { type: string, maxLength: 30 }
 *               shipping_address: { type: string }
 *               shipping_city:    { type: string, maxLength: 80 }
 *               shipping_country: { type: string, minLength: 2, maxLength: 2, description: "ISO 3166-1 alpha-2" }
 *               shipping_zip:     { type: string, maxLength: 20 }
 *               payment_method:   { type: string, enum: [card, cash_on_delivery, wallet, bank_transfer], default: cash_on_delivery }
 *               notes:            { type: string }
 *     responses:
 *       201: { description: One or more orders placed (one per vendor in the cart) }
 *       400: { description: Cart is empty or validation error }
 *       409: { description: A product in the cart is no longer available or out of stock }
 */
CustomerOrderRouter.post(
  '/checkout',
  authenticate,
  authorise(['Customer']),
  validateBody(checkoutSchema),
  checkout,
);

/**
 * @openapi
 * /api/v2/orders:
 *   get:
 *     tags: [Customer Orders]
 *     summary: The logged-in customer's order history across every vendor
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Paginated order list, newest first }
 *       401: { description: Missing/invalid token }
 */
CustomerOrderRouter.get(
  '/',
  authenticate,
  authorise(['Customer']),
  validateQuery(customerListOrdersQuerySchema),
  listCustomer,
);

/**
 * @openapi
 * /api/v2/orders/{id}:
 *   get:
 *     tags: [Customer Orders]
 *     summary: Get one of the customer's own orders (items + status history)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Order detail }
 *       404: { description: Not found or not owned by this customer }
 */
CustomerOrderRouter.get(
  '/:id',
  authenticate,
  authorise(['Customer']),
  getCustomerById,
);

// ─── Vendor Orders (mounted at /api/v1/vendor/orders) ─────────────────────
// All routes require an authenticated Vendor and are scoped to their own
// tenant — a vendor only ever sees orders placed against their storefront.

export const VendorOrderRouter = Router();

/**
 * @openapi
 * /api/v1/vendor/orders:
 *   get:
 *     tags: [Vendor Orders]
 *     summary: List the vendor's own orders (FIFO — oldest first)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Paginated order list, oldest first (fair FIFO processing queue) }
 *       401: { description: Missing/invalid token }
 *       403: { description: Not a Vendor }
 */
VendorOrderRouter.get(
  '/',
  authenticate,
  authorise(['Vendor']),
  validateQuery(vendorListOrdersQuerySchema),
  listVendor,
);

/**
 * @openapi
 * /api/v1/vendor/orders/{id}:
 *   get:
 *     tags: [Vendor Orders]
 *     summary: Get one of the vendor's own orders (items + status history)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Order detail (includes internal_notes, vendor-only) }
 *       404: { description: Not found or not owned by this vendor }
 */
VendorOrderRouter.get(
  '/:id',
  authenticate,
  authorise(['Vendor']),
  getVendorById,
);

/**
 * @openapi
 * /api/v1/vendor/orders/{id}/status:
 *   patch:
 *     tags: [Vendor Orders]
 *     summary: Transition an order to a new status
 *     description: >
 *       Enforces the order state machine: pending -> confirmed -> processing
 *       -> shipped -> delivered, with cancellation allowed from pending/
 *       confirmed/processing (not after shipping), and refunded only from
 *       delivered. Illegal transitions return 400. Cancelling restocks every
 *       line item back onto the product(s).
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
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:          { type: string, enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded] }
 *               note:            { type: string, description: "Recorded on order_status_history; also becomes cancelled_reason when status = cancelled" }
 *               tracking_number: { type: string, description: "Set when status = shipped" }
 *     responses:
 *       200: { description: Order status updated }
 *       400: { description: Illegal state transition or validation error }
 *       404: { description: Not found or not owned by this vendor }
 */
VendorOrderRouter.patch(
  '/:id/status',
  authenticate,
  authorise(['Vendor']),
  validateBody(updateOrderStatusSchema),
  updateStatus,
);
