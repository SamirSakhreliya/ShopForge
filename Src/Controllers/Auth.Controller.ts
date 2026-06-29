import { Request, Response } from 'express';
import { authService } from '../Services/Auth.Service';

class AuthController {
  /**
   * POST /api/v2/users/register
   * Register a new Customer on a vendor's storefront.
   */
  registerCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await authService.registerCustomer(req.body);
      res.success('Customer registered successfully', { user }, 201);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string; code?: string };
      if (e.statusCode === 404) {
        res.error(e.message ?? 'Not found', err, 404);
      } else if (e.code === '23505') {
        res.error('Email already registered on this storefront', err, 409);
      } else {
        res.error('Registration failed', err, 500);
      }
    }
  };

  /**
   * POST /api/v1/vendor/register
   * Register a new Vendor — creates a tenant (storefront) + vendor user in one transaction.
   */
  registerVendor = async (req: Request, res: Response): Promise<void> => {
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

  /**
   * POST /api/v2/users/login
   * Login for Customers. Requires tenant_id — email is unique per storefront, not globally.
   */
  loginCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await authService.loginCustomer(req.body);
      res.success('Login successful', result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.error(e.message ?? 'Login failed', err, e.statusCode ?? 500);
    }
  };

  /**
   * POST /api/v1/vendor/login
   * Login for Vendors.
   */
  loginVendor = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await authService.loginVendor(req.body);
      res.success('Login successful', result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.error(e.message ?? 'Login failed', err, e.statusCode ?? 500);
    }
  };

  /**
   * POST /api/v1/superadmin/login
   * Login for SuperAdmins.
   */
  loginSuperAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await authService.loginSuperAdmin(req.body);
      res.success('Login successful', result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.error(e.message ?? 'Login failed', err, e.statusCode ?? 500);
    }
  };
}

export const authController = new AuthController();
