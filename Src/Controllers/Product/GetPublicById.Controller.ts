import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** GET /api/v2/products/:id — public product detail */
export const getPublicById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const product = await productService.getPublicProductById(req.params.id);
    res.success('Product retrieved successfully', { product });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Product not found', err, e.statusCode ?? 500);
  }
};

export default getPublicById;
