import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** DELETE /api/v1/vendor/products/:id */
export const deleteProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    await productService.deleteProduct(req.params.id, tenantId);
    res.success('Product deleted successfully', {});
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to delete product',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default deleteProduct;
