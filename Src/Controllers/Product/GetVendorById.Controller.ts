import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** GET /api/v1/vendor/products/:id — one of the vendor's own products */
export const getVendorById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const product = await productService.getVendorProductById(
      req.params.id,
      tenantId,
    );
    res.success('Product retrieved successfully', { product });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Product not found', err, e.statusCode ?? 500);
  }
};

export default getVendorById;
