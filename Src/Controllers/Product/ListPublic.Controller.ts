import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** GET /api/v2/products — public catalogue browse with filters */
export const listPublic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filters = req.query as unknown as Parameters<
      typeof productService.listPublicProducts
    >[0];
    const result = await productService.listPublicProducts(filters);
    res.success('Products retrieved successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to list products', err, e.statusCode ?? 500);
  }
};

export default listPublic;
