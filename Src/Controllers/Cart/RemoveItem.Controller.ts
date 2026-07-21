import { Request, Response } from 'express';
import { cartService } from '../../Services/Cart.Service';

/** DELETE /api/v2/cart/items/:productId — remove one line from the cart */
export const removeItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const { productId } = req.params;
    const result = await cartService.removeItem(customerId, productId);
    res.success('Item removed from cart', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to remove item from cart',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default removeItem;
