import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /api/v1/superadmin/login
 * Login for SuperAdmins.
 */
export const loginSuperAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.loginSuperAdmin(req.body);
    res.success('Login successful', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Login failed', err, e.statusCode ?? 500);
  }
};

export default loginSuperAdmin;
