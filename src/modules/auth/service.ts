import AppError from '../../utils/AppError';
import httpStatus from 'http-status';
import { generateTokensAndSetCookies, verifyToken } from './utils';

import { GenerateAuthTokensArgs } from './types';
import { Response } from 'express';

async function generateAuthTokens(res: Response, { id, role, isCheckedRemember }: GenerateAuthTokensArgs) {
  return await generateTokensAndSetCookies(res, id, role, isCheckedRemember);
}

async function refreshAuthToken(res: Response, refreshToken: string): Promise<any> {
  let decoded: any;
  try {
    decoded = await verifyToken(refreshToken);
  } catch (error) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const { id, role } = decoded; // Assuming decoded token contains id and role
  if (!id || !role) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token payload');
  }

  return await generateTokensAndSetCookies(res, id, role);
}

const verify = async (token: string): Promise<void> => {
  if (!token) {
    throw new AppError(httpStatus.NOT_FOUND, 'Token not found or expired.');
  }

  try {
    const decoded = await verifyToken(token);

    if (!decoded?.id) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired token.');
    }
    // No user database interaction needed here, just token verification
  } catch (error) {
    const isExpired = (error as any)?.errorCode === 'TOKEN_EXPIRED';

    if (isExpired) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Token expired.');
    }

    throw error;
  }
};

export const authService = {
  generateAuthTokens,
  refreshAuthToken,
  verify,
};
