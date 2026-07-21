import { Request, Response } from 'express';
import { orderService } from '../../Services/Order.Service';

/**
 * PATCH /api/v1/vendor/orders/:id/status — vendor advances (or cancels) an
 * order. Enforced state machine — see ORDER_TRANSITIONS in Order.Service.ts.
 */
export const updateStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id as string;
    const vendorUserId = req.user!.id;
    const order = await orderService.updateOrderStatus(
      req.params.id,
      tenantId,
      vendorUserId,
      req.body,
    );
    res.success('Order status updated', { order });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to update order status',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default updateStatus;
