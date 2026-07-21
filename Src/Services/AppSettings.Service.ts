import { pool } from '../Configs/db_config';

// ─── Allow-listed, vendor-settable keys ────────────────────────────────────
// app_management.app_settings is a shared key-value table (006_app_settings.sql)
// that also holds platform-wide rows (tenant_id = NULL, SuperAdmin-only). This
// service only ever reads/writes rows scoped to the calling vendor's own
// tenant_id, and only for these known keys — never an arbitrary key supplied
// by the request (enforced again at the Joi layer, see AppSettings.Schema.ts).
export const VENDOR_SETTING_KEYS = [
  'slack_orders_hook',
  'currency',
  'theme_color',
  'low_stock_threshold',
] as const;

export type VendorSettingKey = (typeof VENDOR_SETTING_KEYS)[number];

// is_public mirrors the seed data in 005_seed_orders.sql: currency/theme_color
// are safe for public storefront APIs to read; the Slack hook and internal
// stock threshold are not.
const SETTING_METADATA: Record<
  VendorSettingKey,
  { description: string; is_public: boolean }
> = {
  slack_orders_hook: {
    description:
      'Slack webhook URL for new-order alerts (overrides the shared ORDER_SLACK_URL)',
    is_public: false,
  },
  currency: {
    description: 'Storefront currency code',
    is_public: true,
  },
  theme_color: {
    description: 'Primary brand colour (hex)',
    is_public: true,
  },
  low_stock_threshold: {
    description: 'Alert when stock falls below this qty',
    is_public: false,
  },
};

type VendorSettingsUpdate = Partial<
  Record<VendorSettingKey, string | number | null>
>;

class AppSettingsService {
  /**
   * Returns every allow-listed setting for the vendor's own tenant, including
   * keys that have never been set (value: null) — so the frontend can render
   * a full settings form without a separate "what keys exist" lookup.
   */
  async getVendorSettings(tenantId: string) {
    const result = await pool.query(
      `SELECT key, value, is_public, updated_at
       FROM app_management.app_settings
       WHERE tenant_id = $1 AND key = ANY($2::text[])`,
      [tenantId, VENDOR_SETTING_KEYS as unknown as string[]],
    );

    const byKey = new Map(result.rows.map((row) => [row.key, row]));

    return VENDOR_SETTING_KEYS.map((key) => {
      const existing = byKey.get(key);
      return {
        key,
        value: existing?.value ?? null,
        description: SETTING_METADATA[key].description,
        is_public: SETTING_METADATA[key].is_public,
        updated_at: existing?.updated_at ?? null,
      };
    });
  }

  /**
   * Upserts one or more allow-listed settings for the vendor's own tenant,
   * atomically (all keys land, or none do). A value of null/empty string
   * clears the override so lookups (e.g. OrderNotifier.resolveWebhookUrl())
   * fall back to their shared default instead.
   */
  async updateVendorSettings(tenantId: string, updates: VendorSettingsUpdate) {
    const entries = Object.entries(updates).filter(([key]) =>
      (VENDOR_SETTING_KEYS as readonly string[]).includes(key),
    ) as [VendorSettingKey, string | number | null][];

    if (entries.length === 0) {
      throw {
        statusCode: 400,
        message: 'No valid settings provided to update',
      };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [key, rawValue] of entries) {
        const value =
          rawValue === null || rawValue === '' ? null : String(rawValue);
        const { description, is_public } = SETTING_METADATA[key];

        await client.query(
          `INSERT INTO app_management.app_settings (tenant_id, key, value, description, is_public)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [tenantId, key, value, description, is_public],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.getVendorSettings(tenantId);
  }
}

export const appSettingsService = new AppSettingsService();
