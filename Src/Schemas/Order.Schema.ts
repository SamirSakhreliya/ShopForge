import Joi from 'joi';

// ─── Shared enums — mirror order_management.order_status / payment_method
// (005_orders.sql) ────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

const PAYMENT_METHODS = [
  'card',
  'cash_on_delivery',
  'wallet',
  'bank_transfer',
] as const;

// ─── Checkout (Customer) ────────────────────────────────────────────────────
// Splits the customer's cart into one order per vendor — see Order.Service.ts
// checkout(). Shipping fields are business-required here even though the
// orders table itself allows them to be NULL (shipping_* columns have no
// NOT NULL constraint — see 005_orders.sql).

export const checkoutSchema = Joi.object({
  shipping_name: Joi.string().min(1).max(120).required(),
  shipping_phone: Joi.string().min(1).max(30).required(),
  shipping_address: Joi.string().min(1).required(),
  shipping_city: Joi.string().min(1).max(80).required(),
  shipping_country: Joi.string().length(2).uppercase().required().messages({
    'string.length': 'shipping_country must be an ISO 3166-1 alpha-2 code',
  }),
  shipping_zip: Joi.string().min(1).max(20).required(),
  payment_method: Joi.string()
    .valid(...PAYMENT_METHODS)
    .optional()
    .default('cash_on_delivery'),
  notes: Joi.string().allow('').optional(),
});

// ─── Listing filters — Vendor / Customer order views ───────────────────────

export const vendorListOrdersQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .optional(),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

export const customerListOrdersQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .optional(),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

// ─── Order status transition (Vendor) ───────────────────────────────────────
// Allowed from/to transitions are enforced in Order.Service.ts, not here —
// this schema only validates shape, not state-machine legality (that depends
// on the order's CURRENT status, which Joi can't see).

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .required(),
  note: Joi.string().allow('').optional(),
  tracking_number: Joi.string().max(120).optional().empty(''), // relevant when status -> 'shipped'
});
