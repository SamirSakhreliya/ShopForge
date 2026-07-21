import { Request, Response } from 'express';
import { appSettingsService } from '../../Services/AppSettings.Service';

/** GET /api/v1/vendor/settings — the vendor's own configurable settings */
export const getVendorSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const settings = await appSettingsService.getVendorSettings(tenantId);
    res.success('Settings retrieved successfully', { settings });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to retrieve settings',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default getVendorSettings;
