import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * GET /verify-email/requests (mounted under /api/v1/superadmin)
 * Optional ?status=pending|approved|rejected filter; defaults to all.
 */
export const listEmailVerificationRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await authService.listVerificationRequests(status);
    res.success('Verification requests retrieved successfully', { requests });
  } catch (err: unknown) {
    res.error('Failed to list verification requests', err, 500);
  }
};

export default listEmailVerificationRequests;
