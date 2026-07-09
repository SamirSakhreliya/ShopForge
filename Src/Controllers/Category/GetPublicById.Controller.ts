import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/** GET /api/v2/categories/:id — public category detail */
export const getPublicById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const category = await categoryService.getPublicCategoryById(req.params.id);
    res.success('Category retrieved successfully', { category });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Category not found', err, e.statusCode ?? 500);
  }
};

export default getPublicById;
