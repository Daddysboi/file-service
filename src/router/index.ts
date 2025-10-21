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

  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(httpStatus.NOT_FOUND, 'Not found'));
  });
};

export default routerConfig;
