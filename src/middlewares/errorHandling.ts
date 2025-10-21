import express, { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import AppError from '../utils/AppError';
import logger from '../utils/logger';
import config from '../config/envConfig';

export const errorConverter = (err: any, req: Request, _res: Response, next: NextFunction) => {
  let error: AppError;

  if (err instanceof AppError) {
    error = err;
  } else {
    let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
    let message = err.message || httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
    let isOperational = false;

    if (err.name === 'CastError') {
      statusCode = httpStatus.BAD_REQUEST;
      message = `Invalid ${err.path}: ${err.value}`;
      isOperational = true;
    } else if (err.name === 'ValidationError') {
      statusCode = httpStatus.BAD_REQUEST;
      message = err.message;
      isOperational = true;
    } else if (err.code === 11000) {
      // Mongoose duplicate key error
      const duplicateKey = Object.keys(err.keyValue)[0];
      statusCode = httpStatus.CONFLICT;
      message = `Duplicate field value: ${duplicateKey} already exists`;
      isOperational = true;
    } else if (err.name === 'JsonWebTokenError') {
      statusCode = httpStatus.UNAUTHORIZED;
      message = 'Invalid token';
      isOperational = true;
    } else if (err.name === 'TokenExpiredError') {
      statusCode = httpStatus.UNAUTHORIZED;
      message = 'Token expired';
      isOperational = true;
    } else if (err instanceof SyntaxError && err.message.includes('JSON')) {
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Invalid JSON payload';
      isOperational = true;
    }

    error = new AppError(statusCode, message, undefined, undefined, isOperational, err.stack);
  }

  // Log the error
  const logData: Record<string, unknown> = {
    statusCode: error.statusCode,
    message: error.message,
    isOperational: error.isOperational,
    ...(error.errorCode && { errorCode: error.errorCode }),
    ...(error.action && { action: error.action }),
  };

  if (config.env !== 'production') {
    logData.stack = error.stack;
    logData.request = {
      method: req.method,
      path: req.path,
      body: req.body,
      params: req.params,
      query: req.query,
    };
  }

  logger.error('Error occurred', logData);

  next(error);
};

export const errorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  // Check if headers have already been sent
  if (res.headersSent) return;

  let { statusCode, message } = err;

  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR] as string;
  }

  const response = {
    code: statusCode,
    message,
    ...(config.env !== 'production' && { stack: err.stack }),
    ...(err.errorCode && { errorCode: err.errorCode }),
    ...(err.action && { action: err.action }),
  };

  res.status(statusCode).send(response);
};

export const globalErrorHandler = (app: express.Express) => {
  app.use(errorConverter);
  app.use(errorHandler);
};
