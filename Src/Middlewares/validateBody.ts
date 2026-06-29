import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

/**
 * Factory middleware — validates req.body against a Joi schema.
 * Passes a 400 error via res.error on failure; calls next() on success.
 */
const validateBody =
  (schema: Schema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      res.error(message, error, 400);
      return;
    }
    next();
  };

export default validateBody;
