export const MILLISECONDS_IN_A_SECOND = 1000;
export const SECONDS_IN_A_MINUTE = 60;
export const MINUTES_IN_AN_HOUR = 60;
export const HOURS_IN_A_DAY = 24;
export const MILLISECONDS_IN_A_DAY = MILLISECONDS_IN_A_SECOND * SECONDS_IN_A_MINUTE * MINUTES_IN_AN_HOUR * HOURS_IN_A_DAY;

export const EMAIL_VALIDATION_REGEX = /\S+@\S+\.\S+/;
export const CENTS_PER_UNIT = 100;

export const CERTIFICATE_PREFIX = 'CERT';
export const CODE_LENGTH = 8;
export const CERTIFICATE_EXPIRY_DAYS = 365;

export const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

export const CACHE_TTL = 3600; // 1 hour in seconds
export const CACHE_CHECK_PERIOD = 600; // 10 minutes in seconds// 100MB in bytes
export const FILE_METADATA_PREFIX = 'file:meta:';
export const FILE_CONTENT_PREFIX = 'file:content:';

export const IMAGE_QUALITY = 80; // Default JPEG/WebP quality (0-100)
export const MAX_IMAGE_DIMENSION = 4000; // Maximum dimension for images
export const THUMBNAIL_SIZE = 200; // Thumbnail size in pixels

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default