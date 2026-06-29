import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

/**
 * authenticate — verifies the Bearer JWT in the Authorization header.
 * On success: attaches decoded { id, role, tenant_id } to req.user and calls next().
 * On failure: returns 401 via res.error.
 */
const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.error('No token provided', null, 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
      tenant_id: string | null;
    };

    req.user = {
      id: decoded.id,
      role: decoded.role,
      tenant_id: decoded.tenant_id,
    };

    next();
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e.name === 'TokenExpiredError') {
      res.error('Token expired', err, 401);
    } else {
      res.error('Invalid token', err, 401);
    }
  }
};

export default authenticate;
