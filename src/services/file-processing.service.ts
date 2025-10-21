import sharp from 'sharp';
import { Readable } from 'stream';
import { FileCategory } from './file-validation.service';
import logger from '../utils/logger';

// Configuration
const IMAGE_QUALITY = 80; // Default JPEG/WebP quality (0-100)
const MAX_IMAGE_DIMENSION = 4000; // Maximum dimension for images
const THUMBNAIL_SIZE = 200; // Thumbnail size in pixels

/**
 * Process image file for optimization
 * @param buffer Original image buffer
 * @param options Processing options
 * @returns Processed image buffer
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

    // Initialize Sharp with the input buffer
    let image = sharp(buffer);

    // Get image metadata
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Resize if needed and requested
    if (resize && (width > maxWidth || height > maxHeight)) {
      image = image.resize({
        width: width > maxWidth ? maxWidth : undefined,
        height: height > maxHeight ? maxHeight : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
      logger.debug(`Resizing image from ${width}x${height} to fit within ${maxWidth}x${maxHeight}`);
    }

    // Convert format if requested
    if (format !== 'original') {
      switch (format) {
        case 'jpeg':
          image = image.jpeg({ quality });
          break;
        case 'png':
          image = image.png({ quality: Math.floor(quality * 0.8) }); // PNG quality is 0-100 but works differently
          break;
        case 'webp':
          image = image.webp({ quality });
          break;
        case 'avif':
          image = image.avif({ quality });
          break;
      }
      logger.debug(`Converting image to ${format} format with quality ${quality}`);
    }

    // Process and return the buffer
    return await image.toBuffer();
  } catch (error) {
    logger.error(`Error processing image: ${error}`);
    // Return original buffer if processing fails
    return buffer;
  }
};

/**
 * Generate a thumbnail for an image
 * @param buffer Original image buffer
 * @param size Thumbnail size (default: THUMBNAIL_SIZE)
 * @returns Thumbnail buffer
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
    // Return a minimal thumbnail if generation fails
    return Buffer.from('thumbnail-generation-failed');
  }
};

/**
 * Process file based on its category
 * @param buffer Original file buffer
 * @param mimeType File MIME type
 * @param category File category
 * @param options Processing options
 * @returns Processed file buffer and updated MIME type
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
  // Default to optimization enabled
  const { optimize = true } = options;

  // Skip processing if optimization is disabled
  if (!optimize) {
    return { buffer, mimeType };
  }

  // Process based on file category
  switch (category) {
    case FileCategory.IMAGE:
      // Process images
      if (mimeType.startsWith('image/')) {
        const processedBuffer = await processImage(buffer, options);
        
        // Update MIME type if format was changed
        let updatedMimeType = mimeType;
        if (options.format && options.format !== 'original') {
          updatedMimeType = `image/${options.format}`;
        }
        
        return { buffer: processedBuffer, mimeType: updatedMimeType };
      }
      break;
      
    // Add processing for other file types as needed
    // case FileCategory.DOCUMENT:
    // case FileCategory.AUDIO:
    // case FileCategory.VIDEO:
    // case FileCategory.ARCHIVE:
  }

  // Return original buffer and MIME type if no processing was done
  return { buffer, mimeType };
};

/**
 * Create a readable stream from a buffer
 * @param buffer Buffer to convert to stream
 * @returns Readable stream
 */
export const bufferToStream = (buffer: Buffer): Readable => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

/**
 * Get appropriate content disposition based on file type
 * @param filename Filename
 * @param mimeType MIME type
 * @param disposition Requested disposition ('inline' or 'attachment')
 * @returns Content-Disposition header value
 */
export const getContentDisposition = (
  filename: string,
  mimeType: string,
  disposition: 'inline' | 'attachment' = 'inline'
): string => {
  // Force attachment for potentially dangerous file types
  if (
    mimeType.includes('application/') &&
    !mimeType.includes('pdf') &&
    disposition === 'inline'
  ) {
    disposition = 'attachment';
  }
  
  // Encode the filename for HTTP headers
  const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape);
  
  return `${disposition}; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`;
};