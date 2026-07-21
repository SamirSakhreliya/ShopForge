import { Request, Response } from 'express';
import { orderService } from '../../Services/Order.Service';

/** GET /api/v2/orders/:id — one of the customer's own orders, with items + status history */
export const getCustomerById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const order = await orderService.getCustomerOrderById(
      req.params.id,
      customerId,
    );
    res.success('Order retrieved successfully', { order });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to retrieve order',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default getCustomerById;
