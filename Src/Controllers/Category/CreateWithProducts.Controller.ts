import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/**
 * POST /api/v1/vendor/categories/bulk
 * Creates a category and its initial products in one atomic call — the
 * "add an entire category with multiple products in one click" workflow.
 */
export const createWithProducts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const result = await categoryService.createCategoryWithProducts(
      tenantId,
      req.body,
    );
    res.success('Category and products created successfully', result, 201);
  } catch (err: unknown) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === '23505') {
      const msg = e.constraint?.includes('sku')
        ? 'One of the products has a SKU already in use'
        : 'A category or product with this slug already exists';
      res.error(msg, err, 409);
    } else {
      res.error('Failed to create category with products', err, 500);
    }
  }
};

export default createWithProducts;
