import { Request, Response } from 'express';
import { orderService } from '../../Services/Order.Service';

/** GET /api/v1/vendor/orders — the vendor's own orders (FIFO, oldest first) */
export const listVendor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const filters = req.query as unknown as Parameters<
      typeof orderService.listVendorOrders
    >[1];
    const result = await orderService.listVendorOrders(tenantId, filters);
    res.success('Orders retrieved successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to list orders', err, e.statusCode ?? 500);
  }
};

export default listVendor;
