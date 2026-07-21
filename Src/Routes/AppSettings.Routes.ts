import { Router } from 'express';
import authenticate from '../Middlewares/authenticate';
import authorise from '../Middlewares/authorise';
import validateBody from '../Middlewares/validateBody';
import { updateVendorSettingsSchema } from '../Schemas/AppSettings.Schema';
import { getVendorSettings } from '../Controllers/AppSettings/GetVendorSettings.Controller';
import { updateVendorSettings } from '../Controllers/AppSettings/UpdateVendorSettings.Controller';

// Only defines paths RELATIVE to /api/v1/vendor/settings — the prefix itself
// is applied centrally in Routes/index.ts, matching every other domain router.

// ─── Vendor Settings (mounted at /api/v1/vendor/settings) ─────────────────
// All routes require an authenticated Vendor and are scoped to their own
// tenant_id. Only an allow-listed set of app_settings keys is exposed here —
// see AppSettings.Service.ts VENDOR_SETTING_KEYS — never arbitrary key/value
// writes into the shared app_management.app_settings table.

export const VendorAppSettingsRouter = Router();

/**
 * @openapi
 * /api/v1/vendor/settings:
 *   get:
 *     tags: [Vendor Settings]
 *     summary: Get the vendor's own configurable settings
 *     description: >
 *       Always returns every allow-listed key (slack_orders_hook, currency,
 *       theme_color, low_stock_threshold), with value: null for any key that
 *       has never been set — so a settings form can render without a
 *       separate "what keys exist" lookup.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current settings for the vendor's own tenant }
 *       401: { description: Missing/invalid token }
 *       403: { description: Not a Vendor }
 */
VendorAppSettingsRouter.get(
  '/',
  authenticate,
  authorise(['Vendor']),
  getVendorSettings,
);

/**
 * @openapi
 * /api/v1/vendor/settings:
 *   put:
 *     tags: [Vendor Settings]
 *     summary: Upsert one or more of the vendor's own settings
 *     description: >
 *       Send only the keys you want to change. Setting a key to null or ""
 *       clears the override — e.g. clearing slack_orders_hook makes new-order
 *       Slack alerts fall back to the platform's shared ORDER_SLACK_URL.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slack_orders_hook:   { type: string, format: uri, nullable: true, description: "https:// Slack incoming webhook URL" }
 *               currency:            { type: string, minLength: 3, maxLength: 3, description: "ISO 4217 code, e.g. USD" }
 *               theme_color:         { type: string, description: "6-digit hex colour, e.g. #1a56db" }
 *               low_stock_threshold: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: Updated settings for the vendor's own tenant }
 *       400: { description: Validation error or no valid keys provided }
 *       401: { description: Missing/invalid token }
 *       403: { description: Not a Vendor }
 */
VendorAppSettingsRouter.put(
  '/',
  authenticate,
  authorise(['Vendor']),
  validateBody(updateVendorSettingsSchema),
  updateVendorSettings,
);
