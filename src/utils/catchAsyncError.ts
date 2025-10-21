import { Request, Response, NextFunction } from 'express';

/**
 * catchAsync:
 * A higher-order function for wrapping asynchronous Express route handlers.
 * - It takes an async route/controller function (`fn`) as input.
 * - It executes the function and automatically catches any errors.
 * - If an error occurs, it forwards it to Express's `next()` error handler.
 *
 * This removes the need for repetitive try...catch blocks in controllers.
 *
 * Example:
 *   app.get('/users', catchAsync(async (req, res) => {
 *       const users = await Model.find();
 *       res.json(users);
 *   }));
 */

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | void | undefined>;

const catchAsyncError =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default catchAsyncError;
