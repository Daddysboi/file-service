import crypto from 'node:crypto';
import config from '../config/envConfig';
import AppError from './AppError';
import httpStatus from 'http-status';

const secretKey = config.encryption.key;
const iv = crypto.randomBytes(16);

if (!secretKey || secretKey.length !== 64) {
  throw new AppError(httpStatus.FORBIDDEN, 'Encryption key must be set and must be 64 characters long');
}

const algorithm = config.encryption.algorithm;
if (!algorithm) {
  throw new AppError(httpStatus.FORBIDDEN, 'Encryption algorithm must be a valid string');
}

const encrypt = (text: string) => {
  const keyBuffer = Buffer.from(secretKey, 'hex');

  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    iv: iv.toString('hex'),
    encrypted: encrypted,
  };
};

const decrypt = (encryptedText: string, iv: string) => {
  const decipher = crypto.createDecipheriv(config.encryption.algorithm, Buffer.from(secretKey, 'hex'), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

export { encrypt, decrypt };
