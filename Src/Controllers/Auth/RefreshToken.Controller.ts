import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /refresh (mounted under /api/v2/users, /api/v1/vendor, /api/v1/superadmin)
 * Exchanges a valid refresh token for a new access + refresh token pair.
 * Shared across all roles — validity only depends on the refresh_tokens row.
 */
export const refreshToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.refreshAccessToken(req.body.refresh_token);
    res.success('Token refreshed successfully', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Failed to refresh token', err, e.statusCode ?? 500);
  }
};

export default refreshToken;
