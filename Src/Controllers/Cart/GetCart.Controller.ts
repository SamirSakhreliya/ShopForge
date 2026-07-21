import { Request, Response } from 'express';
import { cartService } from '../../Services/Cart.Service';

/** GET /api/v2/cart — the logged-in customer's cart, grouped by vendor */
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const cart = await cartService.getCart(customerId);
    res.success('Cart retrieved successfully', cart);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to retrieve cart', err, e.statusCode ?? 500);
  }
};

export default getCart;
