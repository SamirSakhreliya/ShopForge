import Joi from 'joi';

// ─── Sort options shared by public + vendor listings ───────────────────────
const SORT_OPTIONS = ['price_asc', 'price_desc', 'newest', 'featured'] as const;

// ─── Create / Update (Vendor) ───────────────────────────────────────────────

export const createProductSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  slug: Joi.string()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(200)
    .optional()
    .empty('')
    .messages({
      'string.pattern.base':
        'slug must be lowercase, alphanumeric, and hyphen-separated',
    }), // auto-generated from name if omitted
  description: Joi.string().allow('').optional(),
  category_id: Joi.string().uuid().optional().empty(''),
  price: Joi.number().positive().precision(2).required(),
  compare_price: Joi.number().positive().precision(2).optional(),
  cost_price: Joi.number().positive().precision(2).optional(),
  stock_quantity: Joi.number().integer().min(0).optional().default(0),
  sku: Joi.string().max(100).optional(),
  barcode: Joi.string().max(100).optional(),
  weight_grams: Joi.number().integer().positive().optional(),
  is_active: Joi.boolean().optional().default(true),
  is_featured: Joi.boolean().optional().default(false),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  slug: Joi.string()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(200)
    .optional()
    .empty('')
    .messages({
      'string.pattern.base':
        'slug must be lowercase, alphanumeric, and hyphen-separated',
    }),
  description: Joi.string().allow('').optional(),
  category_id: Joi.string().uuid().allow(null).optional().empty(''),
  price: Joi.number().positive().precision(2).optional(),
  compare_price: Joi.number().positive().precision(2).allow(null).optional(),
  cost_price: Joi.number().positive().precision(2).allow(null).optional(),
  stock_quantity: Joi.number().integer().min(0).optional(),
  sku: Joi.string().max(100).allow(null).optional(),
  barcode: Joi.string().max(100).allow(null).optional(),
  weight_grams: Joi.number().integer().positive().allow(null).optional(),
  is_active: Joi.boolean().optional(),
  is_featured: Joi.boolean().optional(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field must be provided to update' });

// ─── Listing filters — Public / Customer view ──────────────────────────────
// Only active products from active storefronts; no cost_price / inactive items.
// All filters are optional — calling with no query params at all returns the
// full public catalogue (paginated, newest first).

export const publicListQuerySchema = Joi.object({
  tenant_id: Joi.string().uuid().optional().empty(''), // browse a single storefront's catalogue
  category_id: Joi.string().uuid().optional().empty(''),
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
  search: Joi.string().max(200).optional().empty(''),
  sort: Joi.string()
    .valid(...SORT_OPTIONS)
    .optional()
    .default('newest'),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

// ─── Listing filters — Vendor view ──────────────────────────────────────────
// Vendor sees their own tenant's full catalogue: inactive items, stock, cost.

export const vendorListQuerySchema = Joi.object({
  category_id: Joi.string().uuid().optional().empty(''),
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
  search: Joi.string().max(200).optional().empty(''),
  is_active: Joi.boolean().optional(), // omit = all statuses
  is_featured: Joi.boolean().optional(),
  sort: Joi.string()
    .valid(...SORT_OPTIONS, 'stock_low', 'stock_high')
    .optional()
    .default('newest'),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});
