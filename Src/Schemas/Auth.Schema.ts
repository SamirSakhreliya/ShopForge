import Joi from 'joi';

// ─── Customer ───────────────────────────────────────────────────────────────

// Customer identity is global (one account across every vendor storefront).
// tenant_id is optional here — if the customer is signing up while browsing
// a specific vendor's storefront, passing it creates a customer_vendor_links
// row so that vendor sees them as a known customer immediately.
export const customerRegisterSchema = Joi.object({
  first_name: Joi.string().min(1).max(80).required(),
  last_name: Joi.string().min(1).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  tenant_id: Joi.string().uuid().optional(), // optional: storefront to auto-link on signup
  phone: Joi.string().max(30).optional(),
});

// Customer login is global — one account works across all storefronts.
export const customerLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// ─── Vendor ──────────────────────────────────────────────────────────────────

export const vendorRegisterSchema = Joi.object({
  // User fields
  first_name: Joi.string().min(1).max(80).required(),
  last_name: Joi.string().min(1).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().max(30).optional(),
  // Tenant / storefront fields
  store_name: Joi.string().min(2).max(120).required(),
  store_slug: Joi.string()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(2)
    .max(80)
    .required()
    .messages({
      'string.pattern.base':
        'store_slug must be lowercase, alphanumeric, and hyphen-separated',
    }),
  contact_email: Joi.string().email().required(), // storefront contact email (can differ from login email)
  contact_phone: Joi.string().max(30).optional(),
  business_address: Joi.string().optional(),
});

export const vendorLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// ─── SuperAdmin ───────────────────────────────────────────────────────────────

export const superAdminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
