import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /logout (mounted under /api/v2/users, /api/v1/vendor, /api/v1/superadmin)
 * Revokes a single refresh token (logout on one device). Always resolves
 * successfully, even if the token was already invalid — see Auth.Service.logout.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    await authService.logout(req.body.refresh_token);
    res.success('Logged out successfully', {});
  } catch (err: unknown) {
    res.error('Logout failed', err, 500);
  }
};

export default logout;
