import { z } from 'zod';
import { AppError } from './errorHandler.js';

export const validateRequest = (schema: { body?: any; query?: any; params?: any }) =>
  (req: any, res: any, next: any) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return next(new AppError('invalid input', 400));
      }
      next(err);
    }
  };
