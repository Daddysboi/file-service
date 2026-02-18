
import envConfig from '../../config/envConfig';
import {
  getFromMemoryCache,
  setInMemoryCache,
  delFromMemoryCache,
  flushMemoryCache,
} from './in-memory-cache';
import {
  getFromRedisCache,
  setInRedisCache,
  delFromRedisCache,
  flushRedisCache,
} from './redis-cache';
import { FILE_CONTENT_PREFIX, FILE_METADATA_PREFIX } from '../../utils/constants';
import logger from '../../utils/logger';

export const getFileMetadataFromCache = async (fileId: string): Promise<any | null> => {
  const memoryKey = `${FILE_METADATA_PREFIX}${fileId}`;
  const redisKey = `${FILE_METADATA_PREFIX}${fileId}`;

  if (envConfig.inMemoryCachingEnabled) {
    const memoryResult = getFromMemoryCache(memoryKey);
    if (memoryResult) {
      return memoryResult;
    }
  }

  if (envConfig.redisUrl) {
    const redisResult = await getFromRedisCache(redisKey);
    if (redisResult) {
      if (envConfig.inMemoryCachingEnabled) {
        setInMemoryCache(memoryKey, redisResult);
      }
      return redisResult;
    }
  }

  logger.debug(`Cache miss for file metadata: ${fileId}`);
  return null;
};

export const setFileMetadataInCache = async (fileId: string, metadata: any): Promise<void> => {
  const memoryKey = `${FILE_METADATA_PREFIX}${fileId}`;
  const redisKey = `${FILE_METADATA_PREFIX}${fileId}`;

  if (envConfig.inMemoryCachingEnabled) {
    setInMemoryCache(memoryKey, metadata);
  }

  if (envConfig.redisUrl) {
    await setInRedisCache(redisKey, metadata);
  }
};

export const getFileContentFromCache = (fileId: string): Buffer | null => {
  const memoryKey = `${FILE_CONTENT_PREFIX}${fileId}`;

  if (envConfig.inMemoryCachingEnabled) {
    const memoryResult = getFromMemoryCache(memoryKey);
    if (memoryResult) {
      return memoryResult as Buffer;
    }
  }

  logger.debug(`Cache miss for file content: ${fileId}`);
  return null;
};

export const setFileContentInCache = (fileId: string, content: Buffer, size: number): void => {
  const memoryKey = `${FILE_CONTENT_PREFIX}${fileId}`;
  const MAX_CACHEABLE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  if (size > MAX_CACHEABLE_FILE_SIZE) {
    logger.debug(`File too large to cache: ${fileId} (${size} bytes)`);
    return;
  }

  if (envConfig.inMemoryCachingEnabled) {
    setInMemoryCache(memoryKey, content);
    logger.debug(`Cached file content: ${fileId} (${size} bytes)`);
  }
};

export const invalidateFileCache = async (fileId: string): Promise<void> => {
  const metadataMemoryKey = `${FILE_METADATA_PREFIX}${fileId}`;
  const contentMemoryKey = `${FILE_CONTENT_PREFIX}${fileId}`;
  const redisKey = `${FILE_METADATA_PREFIX}${fileId}`;

  if (envConfig.inMemoryCachingEnabled) {
    delFromMemoryCache(metadataMemoryKey);
    delFromMemoryCache(contentMemoryKey);
  }

  if (envConfig.redisUrl) {
    await delFromRedisCache(redisKey);
  }

  logger.debug(`Invalidated cache for file: ${fileId}`);
};

export const clearAllCaches = async (): Promise<void> => {
  if (envConfig.inMemoryCachingEnabled) {
    flushMemoryCache();
  }

  if (envConfig.redisUrl) {
    await flushRedisCache();
  }

  logger.info('All caches cleared');
};
