import { Request, Response } from 'express';
import { authService } from '../../Services/Auth.Service';

/**
 * POST /api/v1/vendor/register
 * Register a new Vendor — creates a tenant (storefront) + vendor user in one transaction.
 */
export const registerVendor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.registerVendor(req.body);
    res.success('Vendor registered successfully', result, 201);
  } catch (err: unknown) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === '23505') {
      // Distinguish email vs slug collision
      const msg = e.constraint?.includes('slug')
        ? 'Store slug is already taken'
        : 'Email already registered as a Vendor';
      res.error(msg, err, 409);
    } else {
      res.error('Registration failed', err, 500);
    }
  }
};

export default registerVendor;
