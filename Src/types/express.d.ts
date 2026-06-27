import 'express';

declare global {
  namespace Express {
    interface Response {
      success(message: string, data?: unknown, statusCode?: number): void;
      error(message: string, error?: unknown, statusCode?: number): void;
    }

    interface Request {
      // Add custom properties here if needed
      preferred_language?: string; // Example of adding a `user` property
    }
  }
}
