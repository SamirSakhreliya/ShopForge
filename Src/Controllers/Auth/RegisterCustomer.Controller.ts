import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /api/v2/users/register
 * Register a new Customer. Identity is global (one account across every
 * vendor storefront); pass tenant_id to auto-link to a storefront on signup.
 */
export const registerCustomer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = await authService.registerCustomer(req.body);
    res.success('Customer registered successfully', { user }, 201);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string; code?: string };
    if (e.statusCode === 404) {
      res.error(e.message ?? 'Not found', err, 404);
    } else if (e.code === '23505') {
      res.error('Email already registered', err, 409);
    } else {
      res.error('Registration failed', err, 500);
    }
  }
};

export default registerCustomer;
