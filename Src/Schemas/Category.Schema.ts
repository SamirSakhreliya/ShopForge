import Joi from 'joi';
import { createProductSchema } from './Product.Schema';

// ─── Create / Update (Vendor) ───────────────────────────────────────────────

export const createCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  slug: Joi.string()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100)
    .optional()
    .empty('')
    .messages({
      'string.pattern.base':
        'slug must be lowercase, alphanumeric, and hyphen-separated',
    }), // auto-generated from name if omitted
  description: Joi.string().allow('').optional(),
  image_url: Joi.string().uri().optional().empty(''),
  parent_id: Joi.string().uuid().optional().empty(''), // one level of nesting supported (see 003_categories.sql)
  sort_order: Joi.number().integer().optional().default(0),
  is_active: Joi.boolean().optional().default(true),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  slug: Joi.string()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100)
    .optional()
    .empty('')
    .messages({
      'string.pattern.base':
        'slug must be lowercase, alphanumeric, and hyphen-separated',
    }),
  description: Joi.string().allow('').optional(),
  image_url: Joi.string().uri().allow(null).optional().empty(''),
  parent_id: Joi.string().uuid().allow(null).optional().empty(''),
  sort_order: Joi.number().integer().optional(),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field must be provided to update' });

// ─── Listing filters — Public / Customer view ──────────────────────────────
// Only active categories from active storefronts, mirroring the Products module.

export const publicListCategoryQuerySchema = Joi.object({
  tenant_id: Joi.string().uuid().optional().empty(''),
  parent_id: Joi.string().uuid().optional().empty(''),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

// ─── Listing filters — Vendor view ──────────────────────────────────────────

export const vendorListCategoryQuerySchema = Joi.object({
  parent_id: Joi.string().uuid().optional().empty(''),
  is_active: Joi.boolean().optional(), // omit = all statuses
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

// ─── Bulk: create a category with its initial products in one call ────────
// "Add an entire category with multiple products in one click" — atomic:
// either everything is created, or nothing is (see Category.Service.ts).

export const createCategoryWithProductsSchema = Joi.object({
  category: createCategorySchema.required(),
  products: Joi.array().items(createProductSchema).min(1).required().messages({
    'array.min': 'At least one product is required',
  }),
});
