import { Request, Response } from 'express';
import { cartService } from '../../Services/Cart.Service';

/** DELETE /api/v2/cart — empty the customer's entire cart */
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const result = await cartService.clearCart(customerId);
    res.success('Cart cleared', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to clear cart', err, e.statusCode ?? 500);
  }
};

export default clearCart;
