import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /verify-email/requests/:id/reject (mounted under /api/v1/superadmin)
 * Rejects a pending request. is_email_verified stays FALSE; the user may
 * submit a new request later (only PENDING requests are unique-constrained).
 */
export const rejectEmailVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.rejectVerification(
      req.params.id,
      req.user!.id,
      req.body.note,
    );
    res.success('Email verification rejected', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to reject verification',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default rejectEmailVerification;
