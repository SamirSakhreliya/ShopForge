import Joi from 'joi';

// ─── Vendor-settable keys ───────────────────────────────────────────────────
// Restricted to an allow-list rather than accepting arbitrary key/value pairs
// — app_management.app_settings is a shared table (it also holds
// platform-wide rows with tenant_id = NULL), so vendors must not be able to
// write arbitrary keys into it. This list matches what's already seeded per
// tenant in 005_seed_orders.sql (see AppSettings.Service.ts SETTING_METADATA
// for the is_public/description pairing of each key).

export const updateVendorSettingsSchema = Joi.object({
  slack_orders_hook: Joi.string()
    .uri({ scheme: ['https'] })
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'slack_orders_hook must be a valid https:// URL',
    }),
  currency: Joi.string().length(3).uppercase().optional().messages({
    'string.length': 'currency must be a 3-letter ISO 4217 code (e.g. USD)',
  }),
  theme_color: Joi.string()
    .pattern(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .messages({
      'string.pattern.base':
        'theme_color must be a 6-digit hex colour (e.g. #1a56db)',
    }),
  low_stock_threshold: Joi.number().integer().min(0).optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one setting must be provided to update',
  });
