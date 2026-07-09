import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /verify-email/request (mounted under /api/v2/users and /api/v1/vendor)
 * Customer or Vendor requests email verification. No email is actually sent
 * yet — this just queues a request for SuperAdmin to review manually.
 */
export const requestEmailVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const request = await authService.requestEmailVerification(req.user!.id);
    res.success(
      'Verification requested — awaiting SuperAdmin review',
      { request },
      201,
    );
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(
      e.message ?? 'Failed to request verification',
      err,
      e.statusCode ?? 500,
    );
  }
};

export default requestEmailVerification;
