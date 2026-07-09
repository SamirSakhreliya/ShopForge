import { Request, Response } from 'express';
import { categoryService } from '../../Services/Category.Service';

/** GET /api/v2/categories — public catalogue browse with filters */
export const listPublic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filters = req.query as unknown as Parameters<
      typeof categoryService.listPublicCategories
    >[0];
    const result = await categoryService.listPublicCategories(filters);
    res.success('Categories retrieved successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to list categories',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default listPublic;
