import NodeCache from 'node-cache';
import { createClient } from 'redis';
import logger from '../utils/logger';
import envConfig from '../config/envConfig';

// Configuration
const CACHE_TTL = 3600; // 1 hour in seconds
const CACHE_CHECK_PERIOD = 600; // 10 minutes in seconds
const FILE_METADATA_PREFIX = 'file:meta:';
const FILE_CONTENT_PREFIX = 'file:content:';

// In-memory cache for small files and metadata
const memoryCache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: CACHE_CHECK_PERIOD,
  useClones: false, // Don't clone objects for better performance
  // The 'maxSize' and 'sizeCalculation' options are not supported by node-cache directly.
  // The cache will only be limited by TTL.
});

// Redis client for distributed caching
let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Initialize Redis client if Redis URL is provided
 */
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

/**
 * Get file metadata from cache
 * @param fileId File ID
 * @returns File metadata or null if not in cache
 */
export const getFileMetadataFromCache = async (fileId: string): Promise<any | null> => {
  const memoryKey = `${FILE_METADATA_PREFIX}${fileId}`;

  // Try memory cache first
  const memoryResult = memoryCache.get(memoryKey);
  if (memoryResult) {
    logger.debug(`Cache hit (memory) for file metadata: ${fileId}`);
    return memoryResult;
  }

  // Try Redis if available
  if (redisClient) {
    try {
      const redisKey = `${FILE_METADATA_PREFIX}${fileId}`;
      const redisResult = await redisClient.get(redisKey);

      if (redisResult) {
        const parsedResult = JSON.parse(redisResult);
        // Store in memory cache for faster access next time
        memoryCache.set(memoryKey, parsedResult);
        logger.debug(`Cache hit (Redis) for file metadata: ${fileId}`);
        return parsedResult;
      }
    } catch (error) {
      logger.error(`Redis error when getting file metadata: ${error}`);
    }
  }

  logger.debug(`Cache miss for file metadata: ${fileId}`);
  return null;
};

/**
 * Set file metadata in cache
 * @param fileId File ID
 * @param metadata File metadata
 */
export const setFileMetadataInCache = async (fileId: string, metadata: any): Promise<void> => {
  const memoryKey = `${FILE_METADATA_PREFIX}${fileId}`;

  // Set in memory cache
  memoryCache.set(memoryKey, metadata);

  // Set in Redis if available
  if (redisClient) {
    try {
      const redisKey = `${FILE_METADATA_PREFIX}${fileId}`;
      await redisClient.set(redisKey, JSON.stringify(metadata), {
        EX: CACHE_TTL,
      });
    } catch (error) {
      logger.error(`Redis error when setting file metadata: ${error}`);
    }
  }
};

/**
 * Get file content from cache (only for small files)
 * @param fileId File ID
 * @returns File content as Buffer or null if not in cache
 */
export const getFileContentFromCache = async (fileId: string): Promise<Buffer | null> => {
  const memoryKey = `${FILE_CONTENT_PREFIX}${fileId}`;

  // Try memory cache first
  const memoryResult = memoryCache.get(memoryKey);
  if (memoryResult) {
    logger.debug(`Cache hit (memory) for file content: ${fileId}`);
    return memoryResult as Buffer;
  }

  // We don't store file content in Redis due to size concerns
  logger.debug(`Cache miss for file content: ${fileId}`);
  return null;
};

/**
 * Set file content in cache (only for small files)
 * @param fileId File ID
 * @param content File content as Buffer
 * @param size File size in bytes
 */
export const setFileContentInCache = async (fileId: string, content: Buffer, size: number): Promise<void> => {
  // Only cache small files (< 5MB)
  const MAX_CACHEABLE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  if (size > MAX_CACHEABLE_FILE_SIZE) {
    logger.debug(`File too large to cache: ${fileId} (${size} bytes)`);
    return;
  }

  const memoryKey = `${FILE_CONTENT_PREFIX}${fileId}`;

  // Set in memory cache
  memoryCache.set(memoryKey, content);
  logger.debug(`Cached file content: ${fileId} (${size} bytes)`);
};

/**
 * Invalidate file in cache
 * @param fileId File ID
 */
export const invalidateFileCache = async (fileId: string): Promise<void> => {
  const metadataMemoryKey = `${FILE_METADATA_PREFIX}${fileId}`;
  const contentMemoryKey = `${FILE_CONTENT_PREFIX}${fileId}`;

  // Remove from memory cache
  memoryCache.del(metadataMemoryKey);
  memoryCache.del(contentMemoryKey);

  // Remove from Redis if available
  if (redisClient) {
    try {
      const redisKey = `${FILE_METADATA_PREFIX}${fileId}`;
      await redisClient.del(redisKey);
    } catch (error) {
      logger.error(`Redis error when invalidating file cache: ${error}`);
    }
  }

  logger.debug(`Invalidated cache for file: ${fileId}`);
};

/**
 * Clear all caches
 */
export const clearAllCaches = async (): Promise<void> => {
  // Clear memory cache
  memoryCache.flushAll();

  // Clear Redis cache if available
  if (redisClient) {
    try {
      await redisClient.flushAll();
    } catch (error) {
      logger.error(`Redis error when clearing all caches: ${error}`);
    }
  }

  logger.info('All caches cleared');
};