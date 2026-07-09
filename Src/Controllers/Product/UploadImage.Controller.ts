import { Request, Response } from 'express';
import { productService } from '../../Services/Product.Service';

/** POST /api/v1/vendor/products/:id/images (multipart, field name "image") */
export const uploadImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.file) {
      res.error('No image file provided', null, 400);
      return;
    }
    const tenantId = req.user!.tenant_id as string;
    const url = `/uploads/products/${req.file.filename}`;
    const image = await productService.addProductImage(
      req.params.id,
      tenantId,
      url,
      req.body.alt_text,
    );
    res.success('Image uploaded successfully', { image }, 201);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to upload image', err, e.statusCode ?? 500);
  }
};

export default uploadImage;
