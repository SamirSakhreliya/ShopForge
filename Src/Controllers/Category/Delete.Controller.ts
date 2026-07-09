import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/** DELETE /api/v1/vendor/categories/:id */
export const deleteCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    await categoryService.deleteCategory(req.params.id, tenantId);
    res.success('Category deleted successfully', {});
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to delete category',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default deleteCategory;
