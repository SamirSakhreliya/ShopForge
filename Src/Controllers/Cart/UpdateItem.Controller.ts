import { Request, Response } from 'express';
import { cartService } from '../../Services/Cart.Service';

/** PUT /api/v2/cart/items/:productId — set the quantity of a cart line */
export const updateItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const { productId } = req.params;
    const { quantity } = req.body;
    const item = await cartService.updateItemQuantity(
      customerId,
      productId,
      quantity,
    );
    res.success('Cart item updated', { item });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to update cart item',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default updateItem;
