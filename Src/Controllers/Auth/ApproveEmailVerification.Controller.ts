import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /verify-email/requests/:id/approve (mounted under /api/v1/superadmin)
 * Approves a pending request and flips users.is_email_verified to TRUE.
 */
export const approveEmailVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.approveVerification(
      req.params.id,
      req.user!.id,
    );
    res.success('Email verification approved', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to approve verification',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default approveEmailVerification;
