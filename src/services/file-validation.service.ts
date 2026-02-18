import mime from 'mime-types';
import logger from '../utils/logger';
import AppError from '../utils/AppError';
import httpStatus from 'http-status';
import {DEFAULT_MAX_FILE_SIZE, MAX_FILE_SIZE} from "../utils/constants";

// Allowed file types by category
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/plain',
  'text/csv',
];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_ARCHIVE_TYPES = [
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
];

// Combined list of all allowed types
const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_ARCHIVE_TYPES,
];

// File type categories
export enum FileCategory {
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
  ARCHIVE = 'archive',
  OTHER = 'other',
}

/**
 * Determine file category based on MIME type
 * @param mimeType MIME type of the file
 * @returns File category
 */
export const getFileCategory = (mimeType: string): FileCategory => {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return FileCategory.IMAGE;
  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return FileCategory.DOCUMENT;
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return FileCategory.AUDIO;
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return FileCategory.VIDEO;
  if (ALLOWED_ARCHIVE_TYPES.includes(mimeType)) return FileCategory.ARCHIVE;
  return FileCategory.OTHER;
};

/**
 * Get allowed MIME types for a specific category
 * @param category File category
 * @returns Array of allowed MIME types
 */
export const getAllowedTypesForCategory = (category: FileCategory): string[] => {
  switch (category) {
    case FileCategory.IMAGE:
      return ALLOWED_IMAGE_TYPES;
    case FileCategory.DOCUMENT:
      return ALLOWED_DOCUMENT_TYPES;
    case FileCategory.AUDIO:
      return ALLOWED_AUDIO_TYPES;
    case FileCategory.VIDEO:
      return ALLOWED_VIDEO_TYPES;
    case FileCategory.ARCHIVE:
      return ALLOWED_ARCHIVE_TYPES;
    default:
      return ALL_ALLOWED_TYPES;
  }
};

/**
 * Validate file size
 * @param size File size in bytes
 * @param maxSize Maximum allowed size (optional, defaults to DEFAULT_MAX_FILE_SIZE)
 * @throws AppError if file size exceeds the limit
 */
export const validateFileSize = (size: number, maxSize: number = DEFAULT_MAX_FILE_SIZE): void => {
  if (size > maxSize) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `File size exceeds the limit. Maximum allowed size is ${maxSize / (1024 * 1024)}MB.`
    );
  }

  if (size > MAX_FILE_SIZE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `File size exceeds the absolute maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
    );
  }
};

/**
 * Validate file type based on content and extension
 * @param buffer File buffer
 * @param filename Original filename
 * @param allowedTypes Array of allowed MIME types (optional, defaults to ALL_ALLOWED_TYPES)
 * @returns Validated MIME type
 * @throws AppError if file type is not allowed or doesn't match the content
 */
export const validateFileType = async (
  buffer: Buffer,
  filename: string,
  allowedTypes: string[] = ALL_ALLOWED_TYPES
): Promise<string> => {
  // Get MIME type from file extension
  const extensionMimeType = mime.lookup(filename);
  
  // Get MIME type from file content
  const fileTypeModule = await import('file-type');
  const fileTypeResult = await fileTypeModule.fileTypeFromBuffer(buffer);
  const contentMimeType = fileTypeResult?.mime;
  
  // If we couldn't determine the MIME type from content, use the extension MIME type
  const detectedMimeType = contentMimeType || extensionMimeType || 'application/octet-stream';
  
  // Check if the detected MIME type is allowed
  if (!allowedTypes.includes(detectedMimeType)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    );
  }
  
  // If we have both content and extension MIME types, check if they match
  if (contentMimeType && extensionMimeType && contentMimeType !== extensionMimeType) {
    logger.warn(
      `File extension doesn't match content. Extension: ${extensionMimeType}, Content: ${contentMimeType}, Filename: ${filename}`
    );
    
    // Use the content MIME type as it's more reliable
    return contentMimeType;
  }
  
  return detectedMimeType;
};

/**
 * Comprehensive file validation
 * @param file File object from multer
 * @param options Validation options
 * @returns Validated file information
 * @throws AppError if validation fails
 */
export const validateFile = async (
  file: Express.Multer.File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    category?: FileCategory;
  } = {}
): Promise<{
  size: number;
  mimeType: string;
  filename: string;
  category: FileCategory;
}> => {
  const { maxSize, category } = options;
  
  // Determine allowed types based on category or use provided types
  const allowedTypes = options.allowedTypes || 
    (category ? getAllowedTypesForCategory(category) : ALL_ALLOWED_TYPES);
  
  // Validate file size
  validateFileSize(file.size, maxSize);
  
  // Validate file type
  const validatedMimeType = await validateFileType(file.buffer, file.originalname, allowedTypes);
  
  // Determine file category
  const fileCategory = getFileCategory(validatedMimeType);
  
  return {
    size: file.size,
    mimeType: validatedMimeType,
    filename: file.originalname,
    category: fileCategory,
  };
};

/**
 * Sanitize filename to prevent path traversal and other security issues
 * @param filename Original filename
 * @returns Sanitized filename
 */
export const sanitizeFilename = (filename: string): string => {
  // Remove path components
  let sanitized = filename.replace(/^.*[\\\/]/, '');
  
  // Remove special characters
  sanitized = sanitized.replace(/[^\w\s.-]/g, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const extension = sanitized.split('.').pop() || '';
    sanitized = sanitized.substring(0, 255 - extension.length - 1) + '.' + extension;
  }
  
  return sanitized;
};