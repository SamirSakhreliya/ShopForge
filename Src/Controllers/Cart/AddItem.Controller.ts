import { Request, Response } from 'express';
import { cartService } from '../../Services/Cart.Service';

/** POST /api/v2/cart/items — add a product to the cart (merges quantity if already present) */
export const addItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const item = await cartService.addItem(customerId, req.body);
    res.success('Item added to cart', { item }, 201);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to add item to cart',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default addItem;
