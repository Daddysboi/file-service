import express from 'express';
import mongoose from 'mongoose';
import logger from '../utils/logger';

export const healthCheck = async (_req: express.Request, res: express.Response) => {
  const dbConnectionStatus = mongoose.connection.readyState === 1;

  if (dbConnectionStatus) {
    logger.info('Database is connected');
  } else {
    logger.warn('Database is not connected');
  }

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    dbConnection: dbConnectionStatus,
    timestamp: new Date(),
    message: 'Welcome to E Commerce API',
  });
};
