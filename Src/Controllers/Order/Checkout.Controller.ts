import { Request, Response } from 'express';
import { orderService } from '../../Services/Order.Service';

/**
 * POST /api/v2/orders/checkout — checks out the customer's entire cart.
 * Splits into one order per vendor if the cart spans multiple storefronts;
 * response data is always an array of created orders (length 1 if the cart
 * only had one vendor's items).
 */
export const checkout = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const orders = await orderService.checkout(customerId, req.body);
    res.success('Order placed successfully', { orders }, 201);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to place order', err, e.statusCode ?? 500);
  }
};

export default checkout;
