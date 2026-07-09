import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/** GET /api/v1/vendor/categories — vendor's own categories with filters */
export const listVendor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const filters = req.query as unknown as Parameters<
      typeof categoryService.listVendorCategories
    >[1];
    const result = await categoryService.listVendorCategories(
      tenantId,
      filters,
    );
    res.success('Categories retrieved successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to list categories',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default listVendor;
