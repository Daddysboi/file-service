
import NodeCache from 'node-cache';
import logger from '../../utils/logger';
import envConfig from '../../config/envConfig';
import { CACHE_CHECK_PERIOD, CACHE_TTL } from '../../utils/constants';

let memoryCache: NodeCache | null = null;

if (envConfig.inMemoryCachingEnabled) {
  memoryCache = new NodeCache({
    stdTTL: CACHE_TTL,
    checkperiod: CACHE_CHECK_PERIOD,
    useClones: false,
  });
}

export const getFromMemoryCache = (key: string): any | null => {
  if (memoryCache) {
    const result = memoryCache.get(key);
    if (result) {
      logger.debug(`Cache hit (memory) for key: ${key}`);
      return result;
    }
  }
  return null;
};

export const setInMemoryCache = (key: string, value: any, ttl: number = CACHE_TTL): void => {
  if (memoryCache) {
    memoryCache.set(key, value, ttl);
  }
};

export const delFromMemoryCache = (key: string): void => {
  if (memoryCache) {
    memoryCache.del(key);
  }
};

export const flushMemoryCache = (): void => {
  if (memoryCache) {
    memoryCache.flushAll();
  }
};
