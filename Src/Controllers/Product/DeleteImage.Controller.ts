import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** DELETE /api/v1/vendor/products/:id/images/:imageId */
export const deleteImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    await productService.deleteProductImage(
      req.params.id,
      req.params.imageId,
      tenantId,
    );
    res.success('Image deleted successfully', {});
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to delete image', err, e.statusCode ?? 500);
  }
};

export default deleteImage;
