import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

import { pick } from '../utils/pick';
import httpStatus from 'http-status';

/**
 * Middleware for validating multiple parts of a request (params, query, body) using Zod schemas.
 * Returns a 400 error with structured validation errors if validation fails.
 */
const validate =
  (schema: { params?: ZodSchema; query?: ZodSchema; body?: ZodSchema }) =>
  (req: Request, res: Response, next: NextFunction): Response | void => {
    const { params, query, body } = schema;

    const validSchema = pick({ params, query, body }, ['params', 'query', 'body']);
    const object = pick(req, ['params', 'query', 'body'].filter((key) => key in validSchema) as (keyof Request)[]);

    try {
      // Parse and assign validated data back to request
      if (params && object.params) Object.assign(req.params, params.parse(object.params));
      if (query && object.query) Object.assign(req.query, query.parse(object.query));
      if (body && object.body) Object.assign(req.body, body.parse(object.body));

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
      }

      return next(error); // Pass other errors to the error handling middleware
    }
  };

export default validate;
