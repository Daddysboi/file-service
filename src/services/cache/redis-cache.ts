
import { createClient } from 'redis';
import logger from '../../utils/logger';
import envConfig from '../../config/envConfig';
import { CACHE_TTL } from '../../utils/constants';

let redisClient: ReturnType<typeof createClient> | null = null;

export const initRedisClient = async () => {
  if (envConfig.redisUrl) {
    try {
      redisClient = createClient({
        url: envConfig.redisUrl,
      });

      redisClient.on('error', (err) => {
        logger.error(`Redis client error: ${err}`);
      });

      redisClient.on('connect', () => {
        logger.info('Redis client connected');
      });

      await redisClient.connect();
    } catch (error) {
      logger.error(`Failed to initialize Redis client: ${error}`);
      redisClient = null;
    }
  }
};

export const getFromRedisCache = async (key: string): Promise<any | null> => {
  if (redisClient) {
    try {
      const result = await redisClient.get(key);
      if (result) {
        logger.debug(`Cache hit (Redis) for key: ${key}`);
        return JSON.parse(result);
      }
    } catch (error) {
      logger.error(`Redis error when getting key ${key}: ${error}`);
    }
  }
  return null;
};

export const setInRedisCache = async (key: string, value: any, ttl: number = CACHE_TTL): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), { EX: ttl });
    } catch (error) {
      logger.error(`Redis error when setting key ${key}: ${error}`);
    }
  }
};

export const delFromRedisCache = async (key: string): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Redis error when deleting key ${key}: ${error}`);
    }
  }
};

export const flushRedisCache = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.flushAll();
    } catch (error) {
      logger.error(`Redis error when flushing cache: ${error}`);
    }
  }
};
