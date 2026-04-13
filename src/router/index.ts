import express, { Request, Response, NextFunction } from 'express';
import authRouter from '../modules/auth/routes';
import fileRouter from '../modules/file/file.routes';
import httpStatus from 'http-status';
import AppError from '../utils/AppError';
import { healthCheck } from '../handlers/healthcheck';

const apiV1Router = express.Router();

const routerConfig = (app: express.Express): void => {
  app.get('/', healthCheck);

  apiV1Router.use('/auth', authRouter);
  apiV1Router.use('/files', fileRouter);
  app.use('/api/v1', apiV1Router);

  // Catch-all 404 handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Silently ignore common browser probes to avoid noisy error logs
    if (req.path === '/favicon.ico' || req.path.startsWith('/.well-known')) {
      return res.status(httpStatus.NOT_FOUND).end();
    }

    next(new AppError(httpStatus.NOT_FOUND, 'Not found'));
  });
};

export default routerConfig;
