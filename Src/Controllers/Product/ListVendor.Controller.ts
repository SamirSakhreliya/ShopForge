import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** GET /api/v1/vendor/products — vendor's own catalogue with filters */
export const listVendor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const filters = req.query as unknown as Parameters<
      typeof productService.listVendorProducts
    >[1];
    const result = await productService.listVendorProducts(tenantId, filters);
    res.success('Products retrieved successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to list products', err, e.statusCode ?? 500);
  }
};

export default listVendor;
