import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

/**
 * Factory middleware — validates + coerces req.query against a Joi schema
 * (e.g. converts "20" -> 20 for numeric filters). Mirrors validateBody.ts.
 * Passes a 400 error via res.error on failure; calls next() on success.
 */
const validateQuery =
  (schema: Schema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      convert: true,
    });
    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      res.error(message, error, 400);
      return;
    }
    req.query = value;
    next();
  };

export default validateQuery;
