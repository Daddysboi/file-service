import sharp from 'sharp';
import { Readable } from 'stream';
import { FileCategory } from './file-validation.service';
import logger from '../utils/logger';
import {IMAGE_QUALITY, MAX_IMAGE_DIMENSION, THUMBNAIL_SIZE} from "../utils/constants";

/**
 * Process image file for optimization
 */
export const processImage = async (
  buffer: Buffer,
  options: {
    format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'original';
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    resize?: boolean;
  } = {}
): Promise<Buffer> => {
  try {
    const {
      format = 'original',
      quality = IMAGE_QUALITY,
      maxWidth = MAX_IMAGE_DIMENSION,
      maxHeight = MAX_IMAGE_DIMENSION,
      resize = true,
    } = options;

    let image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (resize && (width > maxWidth || height > maxHeight)) {
      image = image.resize({
        width: width > maxWidth ? maxWidth : undefined,
        height: height > maxHeight ? maxHeight : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (format !== 'original') {
      switch (format) {
        case 'jpeg': image = image.jpeg({ quality }); break;
        case 'png': image = image.png({ quality: Math.floor(quality * 0.8) }); break;
        case 'webp': image = image.webp({ quality }); break;
        case 'avif': image = image.avif({ quality }); break;
      }
    }

    return await image.toBuffer();
  } catch (error) {
    logger.error(`Error processing image: ${error}`);
    return buffer;
  }
};

/**
 * Generate a thumbnail for an image
 */
export const generateThumbnail = async (buffer: Buffer, size: number = THUMBNAIL_SIZE): Promise<Buffer> => {
  try {
    return await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 70 })
      .toBuffer();
  } catch (error) {
    logger.error(`Error generating thumbnail: ${error}`);
    // Returning a placeholder or empty buffer is better than a string which might break binary pipes
    return Buffer.alloc(0);
  }
};

/**
 * Process file based on its category
 */
export const processFile = async (
  buffer: Buffer,
  mimeType: string,
  category: FileCategory,
  options: {
    optimize?: boolean;
    format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'original';
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {}
): Promise<{ buffer: Buffer; mimeType: string }> => {
  const { optimize = true } = options;

  if (!optimize) {
    return { buffer, mimeType };
  }

  if (category === FileCategory.IMAGE && mimeType.startsWith('image/')) {
    const processedBuffer = await processImage(buffer, options);
    let updatedMimeType = mimeType;
    if (options.format && options.format !== 'original') {
      updatedMimeType = `image/${options.format}`;
    }
    return { buffer: processedBuffer, mimeType: updatedMimeType };
  }

  return { buffer, mimeType };
};

/**
 * Create a readable stream from a buffer
 */
export const bufferToStream = (buffer: Buffer): Readable => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

/**
 * Get appropriate content disposition based on file type
 */
export const getContentDisposition = (
  filename: string,
  mimeType: string,
  disposition: 'inline' | 'attachment' = 'inline'
): string => {
  // Force attachment for potentially dangerous file types or archives
  const isDangerous = mimeType.includes('application/zip') ||
                      mimeType.includes('application/x-rar') ||
                      mimeType.includes('application/octet-stream') ||
                      filename.endsWith('.exe') ||
                      filename.endsWith('.bat');

  const finalDisposition = isDangerous ? 'attachment' : disposition;
  
  // RFC 5987 compliant encoding for non-ASCII filenames
  const encodedFilename = encodeURIComponent(filename);
  
  return `${finalDisposition}; filename="${filename.replace(/"/g, '\\"')}"; filename*=UTF-8''${encodedFilename}`;
};
