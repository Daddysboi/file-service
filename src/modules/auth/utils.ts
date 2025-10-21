import jwt from 'jsonwebtoken';
import { CookieOptions, Response } from 'express';

import config from '../../config/envConfig';
import { HOURS_IN_A_DAY, MILLISECONDS_IN_A_SECOND, MINUTES_IN_AN_HOUR, SECONDS_IN_A_MINUTE } from '../../utils/constants';
import httpStatus from 'http-status';
import AppError from '../../utils/AppError';

interface JwtData {
  [key: string]: any;
}

function generateToken(data: JwtData, expiresMs: number, secret: string = config.jwt.secret): string {
  const expiresInSeconds = Math.floor(Date.now() / MILLISECONDS_IN_A_SECOND) + expiresMs / MILLISECONDS_IN_A_SECOND;
  return jwt.sign({ exp: expiresInSeconds, ...data }, secret);
}

async function verifyToken(token: string): Promise<any> {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (err: any) {
    const isExpired = err.name === 'TokenExpiredError';

    throw new AppError(
      httpStatus.FORBIDDEN,
      isExpired ? 'Your session has expired. Please try again.' : 'Invalid or malformed token.',
      isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      isExpired ? 'retry' : 'redirect',
      true,
      err.stack,
    );
  }
}

function setCookie(res: Response, cookieName: string, cookieValue: string, expiresMs: number, options: CookieOptions = {}): void {
  // Check if headers have already been sent
  if (res.headersSent) {
    return;
  }

  const isProduction = config.env === 'production';
  const defaultOptions: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    expires: new Date(expiresMs),
    ...options,
  };

  res.cookie(cookieName, cookieValue, defaultOptions);
}

function generateExpires(hours: number): number {
  return Math.floor(Date.now() + hours * SECONDS_IN_A_MINUTE * MINUTES_IN_AN_HOUR * MILLISECONDS_IN_A_SECOND);
}

async function generateTokensAndSetCookies(res: Response, id: string, role?: string, isCheckedRemember = false) {
  const accessTokenExpires = generateExpires(config.jwt.accessExpirationMinutes / 60);
  const refreshDuration = isCheckedRemember ? config.jwt.refreshExpirationDays * HOURS_IN_A_DAY : 0;
  const accessToken = generateToken({ id, role }, accessTokenExpires);
  const refreshTokenExpires = generateExpires(refreshDuration);
  const refreshToken = generateToken({ id }, refreshTokenExpires);
  setCookie(res, 'refreshToken', refreshToken, refreshTokenExpires, {
    path: 'auth/refresh-token',
    httpOnly: true,
    secure: true,
    maxAge: isCheckedRemember ? refreshDuration * MINUTES_IN_AN_HOUR * SECONDS_IN_A_MINUTE : undefined,
  });

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires,
    },
    refresh: refreshToken,
  };
}

export { generateToken, generateTokensAndSetCookies, generateExpires, verifyToken, setCookie };
