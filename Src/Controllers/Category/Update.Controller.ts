import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/** PUT /api/v1/vendor/categories/:id — update a category owned by the vendor */
export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const category = await categoryService.updateCategory(
      req.params.id,
      tenantId,
      req.body,
    );
    res.success('Category updated successfully', { category });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string; code?: string };
    if (e.code === '23505') {
      res.error('A category with this slug already exists', err, 409);
    } else {
      res.error(
        e.message ?? 'Failed to update category',
        err,
        e.statusCode ?? 500,
      );
    }
  }
};

export default update;
