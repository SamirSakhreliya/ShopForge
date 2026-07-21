import { Request, Response } from 'express';
import { orderService } from '../../Services/Order.Service';

/** GET /api/v1/vendor/orders/:id — one of the vendor's own orders, with items + status history */
export const getVendorById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const order = await orderService.getVendorOrderById(
      req.params.id,
      tenantId,
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

export default getVendorById;
