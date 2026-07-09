import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** POST /api/v1/vendor/products — create a product in the vendor's own tenant */
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const product = await productService.createProduct(tenantId, req.body);
    res.success('Product created successfully', { product }, 201);
  } catch (err: unknown) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === '23505') {
      const msg = e.constraint?.includes('sku')
        ? 'SKU is already in use'
        : 'A product with this slug already exists';
      res.error(msg, err, 409);
    } else {
      res.error('Failed to create product', err, 500);
    }
  }
};

export default create;
