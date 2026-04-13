import express, { Express } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { dbConnection } from './config/dbConnection';
import { globalErrorHandler } from './middlewares/errorHandling';
import corsConfig from './config/corsConfig';
import envConfig from './config/envConfig';
import { rateLimiter } from './config/rateLimit';
import { initializeGridFS } from './config/gridfs';
import serverConfig from './config/server';
import routerConfig from './router';

dotenv.config();
const port = envConfig.port;
const app: Express = express();

const start = async () => {
  await dbConnection();
  initializeGridFS();
  app.set('trust proxy', 1);
  app.set('port', port);
  app.use(cors(corsConfig));
  app.use(cookieParser());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: false }));
  
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: false,
  }));

  rateLimiter(app);
  routerConfig(app);
  globalErrorHandler(app);
  serverConfig(app);
};

start();
