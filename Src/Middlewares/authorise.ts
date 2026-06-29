import { Request, Response, NextFunction } from 'express';

type Role = 'Customer' | 'Vendor' | 'SuperAdmin';

/**
 * authorise — RBAC guard factory.
 * Call after authenticate. Returns 403 if req.user.role is not in the allowed list.
 *
 * Usage:
 *   router.get('/admin', authenticate, authorise(['SuperAdmin']), handler)
 *   router.get('/store', authenticate, authorise(['Customer', 'Vendor']), handler)
 */
const authorise =
  (roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.error('Unauthorized', null, 401);
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      res.error(
        `Access denied. Requires one of: ${roles.join(', ')}`,
        null,
        403,
      );
      return;
    }

    next();
  };

export default authorise;
