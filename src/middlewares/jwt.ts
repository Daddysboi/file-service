import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';

import logger from '../utils/logger';
import { verifyToken } from '../modules/auth/utils';
import { UserRequest } from '../validators/validateAccessControl';
import AppError from '../utils/AppError';

export const authenticateJWT = async (req: UserRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(400).json({
      message: 'Authentication header is missing. Please provide the Authorization header with a token.',
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      message: 'Token is missing. You are not authorized.',
    });
  }

  try {
    const decodedToken: any = await verifyToken(token);

    req.user = decodedToken;
    next();
  } catch (err) {
    logger.error('Failed authentication attempt: ' + (err instanceof Error ? err.message : 'Unknown error'));
    return next(new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized access: Invalid or expired token'));
  }
};
