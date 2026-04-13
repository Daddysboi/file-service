import dotenv from 'dotenv';

dotenv.config();

const envConfig = {
  // Server configuration
  port: process.env.PORT || 8001,
  env: process.env.NODE_ENV || 'development',
  
  // MongoDB configuration
  mongodbUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/file-service',
  
  // Redis configuration
  redisUrl: process.env.REDIS_URL || '',
  clientUrl: process.env.CLIENT_URL || '',

  // AWS configuration
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET || 'file-service',
  
  // Local storage configuration
  localStoragePath: process.env.LOCAL_STORAGE_PATH || '',
  
  // File service configuration
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '50') * 1024 * 1024, // Default 50MB
  defaultStorageType: process.env.DEFAULT_STORAGE_TYPE || 'gridfs', // 'gridfs', 's3', 'local'
  
  // Image processing configuration
  imageOptimizationEnabled: process.env.IMAGE_OPTIMIZATION_ENABLED !== 'false',
  defaultImageQuality: parseInt(process.env.DEFAULT_IMAGE_QUALITY || '80'),
  maxImageDimension: parseInt(process.env.MAX_IMAGE_DIMENSION || '4000'),
  generateThumbnails: process.env.GENERATE_THUMBNAILS !== 'false',
  
  // Caching configuration
  cachingEnabled: process.env.CACHING_ENABLED !== 'false',
  inMemoryCachingEnabled: process.env.IN_MEMORY_CACHING_ENABLED !== 'false',
  cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE || '100') * 1024 * 1024, // Default 100MB
  cacheTTL: parseInt(process.env.CACHE_TTL || '3600'), // Default 1 hour
  
  // Security configuration
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessExpirationMinutes: parseInt(process.env.JWT_ACCESS_EXPIRATION_MINUTES || '30'),
    refreshExpirationDays: parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS || '30'),
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'your-secret-key',
    algorithm: process.env.ENCRYPTION_ALGORITHM || '',
  },
  
  // Rate limiting configuration
  globalRateLimit: parseInt(process.env.GLOBAL_RATE_LIMIT || '500'),
  globalRateLimitWindow: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW || '300'), // 5 minutes in seconds
  uploadRateLimit: parseInt(process.env.UPLOAD_RATE_LIMIT || '20'),
  uploadRateLimitWindow: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW || '60'), // 1 minute in seconds
  
  // Monitoring configuration
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  
  // Clustering configuration
  enableClustering: process.env.ENABLE_CLUSTERING === 'true',
  workerCount: parseInt(process.env.WORKER_COUNT || '0'), // 0 means use CPU count
};

export default envConfig;
