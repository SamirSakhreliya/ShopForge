import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/** POST /api/v1/vendor/categories — create a category in the vendor's own tenant */
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const category = await categoryService.createCategory(tenantId, req.body);
    res.success('Category created successfully', { category }, 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      res.error('A category with this slug already exists', err, 409);
    } else {
      res.error('Failed to create category', err, 500);
    }
  }
};

export default create;
