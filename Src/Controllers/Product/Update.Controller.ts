import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** PUT /api/v1/vendor/products/:id — update a product owned by the vendor */
export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const product = await productService.updateProduct(
      req.params.id,
      tenantId,
      req.body,
    );
    res.success('Product updated successfully', { product });
  } catch (err: unknown) {
    const e = err as {
      statusCode?: number;
      message?: string;
      code?: string;
      constraint?: string;
    };
    if (e.code === '23505') {
      const msg = e.constraint?.includes('sku')
        ? 'SKU is already in use'
        : 'A product with this slug already exists';
      res.error(msg, err, 409);
    } else {
      res.error(
        e.message ?? 'Failed to update product',
        err,
        e.statusCode ?? 500,
      );
    }
  }
};

export default update;
