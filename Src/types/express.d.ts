import 'express';

declare global {
  namespace Express {
    interface Response {
      success(message: string, data?: unknown, statusCode?: number): void;
      error(message: string, error?: unknown, statusCode?: number): void;
    }

    interface Request {
      preferred_language?: string;
      user?: {
        id: string;
        role: string;
        tenant_id: string | null;
      };
    }
  }
}
