import { Request, Response } from 'express';
import { orderService } from '../../Services/Order.Service';

/** GET /api/v2/orders — the logged-in customer's order history across every vendor */
export const listCustomer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const filters = req.query as unknown as Parameters<
      typeof orderService.listCustomerOrders
    >[1];
    const result = await orderService.listCustomerOrders(customerId, filters);
    res.success('Orders retrieved successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to list orders', err, e.statusCode ?? 500);
  }
};

export default listCustomer;
