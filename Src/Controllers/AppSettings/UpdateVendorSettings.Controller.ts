import { Request, Response } from 'express';
import { appSettingsService } from '../../Services/AppSettings.Service';

/**
 * PUT /api/v1/vendor/settings — upsert one or more of the vendor's own
 * settings (e.g. slack_orders_hook, currency, theme_color, low_stock_threshold).
 * Sending a key with value null/"" clears the override.
 */
export const updateVendorSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const settings = await appSettingsService.updateVendorSettings(
      tenantId,
      req.body,
    );
    res.success('Settings updated successfully', { settings });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to update settings',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default updateVendorSettings;
