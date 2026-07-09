import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/** GET /api/v1/vendor/categories/:id — one of the vendor's own categories */
export const getVendorById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const category = await categoryService.getVendorCategoryById(
      req.params.id,
      tenantId,
    );
    res.success('Category retrieved successfully', { category });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Category not found', err, e.statusCode ?? 500);
  }
};

export default getVendorById;
