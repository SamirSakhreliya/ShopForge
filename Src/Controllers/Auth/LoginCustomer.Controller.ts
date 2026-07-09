import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /api/v2/users/login
 * Login for Customers. Global identity — email is unique platform-wide, one
 * account shops across every vendor storefront.
 */
export const loginCustomer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.loginCustomer(req.body);
    res.success('Login successful', result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.error(e.message ?? 'Login failed', err, e.statusCode ?? 500);
  }
};

export default loginCustomer;
