import logger from './logger';
import AppError from './AppError';
import httpStatus from 'http-status';

/**
 * Create an object composed of the picked object properties.
 * @param {Object} object - The source object from which properties will be picked.
 * @param {Array} keys - The array of keys to pick from the object.
 * @returns {Record<string, any>} - A new object with only the picked properties.
 */

const pick = <T extends object, K extends keyof T>(object: T, keys: K[]): Record<K, T[K]> => {
  if (object === null || object === undefined) {
    throw new AppError(httpStatus.BAD_REQUEST, 'The object to pick properties from cannot be null or undefined.');
  }

  return keys.reduce((obj, key) => {
    if (key in object) {
      obj[key] = object[key];
    } else {
      // Explicitly convert key to a string
      logger.warn(`Warning: Key "${String(key)}" does not exist on the provided object.`);
    }
    return obj;
  }, {} as Record<K, T[K]>);
};

export { pick };
