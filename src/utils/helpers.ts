import httpStatus from 'http-status';
import AppError from './AppError';
import { UserRequest } from '../validators/validateAccessControl';
import { CHARS } from './constants';

/**
 * function to generate otp and expiry time
 * @returns otp [int]
 * @returns expiryTime [string]
 */
const generateOtp = async () => {
  const min = 90000;
  const max = 10000;

  const otp = Math.floor(Math.random() * min + max);
  const currentTime = new Date();
  const newTime = new Date(currentTime.getTime() + 15 * 60000); // 20 minutes in milliseconds

  return {
    otp,
    newTime,
  };
};

export const generatePrefixedCode = (prefix: string): string => {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}`;
};

export const generateRandomNumber = (length: number): string => {
  return String(Math.floor(Math.random() * Math.pow(10, length))).padStart(length, '0');
};

/**
 * Generates a random alphanumeric string of the specified length
 * @param length - The length of the string to generate
 * @returns A random alphanumeric string
 */
const generateRandomString = (length = 8): string => {
  return Array.from({ length }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
};

const generateIdentifier = async (model: any, prefix = 'TR-', length = 3): Promise<string> => {
  let identifier = '';
  let isUnique = false;

  while (!isUnique) {
    const randomNumber = generateRandomNumber(length);
    identifier = `${prefix}${randomNumber}`;
    const existingDoc = await model.findOne({ identifier });
    if (!existingDoc) isUnique = true;
  }

  return identifier;
};

/**
 * Safely parses a JSON string or returns the input as-is if it's already an object or array.
 * @param input - The input to parse (can be a string, object, or array).
 * @returns The parsed object or array, or the original input if it's not a string.
 * @throws AppError if the input is an invalid JSON string.
 */
const safeJsonParse = <T = any>(input: string | object | any[]): T => {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as T;
    } catch (error) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid JSON format');
    }
  }
  return input as T;
};

const getClientIp = (req: UserRequest): string | undefined => {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.trim();
  }

  return req.ip;
};

const calculateExpiresIn = (expiresAt: Date): number => {
  const now = Math.floor(Date.now() / 1000);
  const expires = Math.floor(expiresAt.getTime() / 1000);
  return Math.max(0, expires - now);
};

export { generateOtp, generateRandomString, generateIdentifier, safeJsonParse, getClientIp, calculateExpiresIn };
