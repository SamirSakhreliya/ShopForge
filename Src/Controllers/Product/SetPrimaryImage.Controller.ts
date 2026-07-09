import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** PATCH /api/v1/vendor/products/:id/images/:imageId/primary */
export const setPrimaryImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const result = await productService.setPrimaryImage(
      req.params.id,
      req.params.imageId,
      tenantId,
    );
    res.success('Primary image updated successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to update primary image',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default setPrimaryImage;
