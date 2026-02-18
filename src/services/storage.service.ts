import { ObjectId } from 'mongodb';
import { getGridFSBucket } from '../config/gridfs';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import envConfig from '../config/envConfig';
import { FileCategory } from './file-validation.service';
import { sanitizeFilename } from './file-validation.service';
import { getFileMetadataFromCache, setFileMetadataInCache, invalidateFileCache } from './cache.service';
import { FileMetadataModel } from '../models/file.model';

import { StorageType } from '../types/enums';

// File metadata interface
export interface FileMetadata {
  id: string;
  filename: string;
  originalname: string;
  contentType: string;
  size: number;
  category: FileCategory;
  uploadDate: Date;
  storageType: StorageType;
  path?: string; // For local storage
  // S3-related fields (bucket, key) have been removed
  thumbnailId?: string; // ID of the thumbnail file
  processingOptions?: any; // Any processing options applied
}

// Local storage directory
const LOCAL_STORAGE_DIR = envConfig.localStoragePath || path.join(process.cwd(), 'uploads');

// Ensure local storage directory exists
const ensureLocalStorageDir = () => {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    logger.info(`Created local storage directory: ${LOCAL_STORAGE_DIR}`);
  }
};

/**
 * Store file in GridFS
 * @param buffer File buffer
 * @param metadata File metadata
 * @returns File ID
 */
const storeFileInGridFS = (buffer: Buffer, metadata: Omit<FileMetadata, 'id' | 'storageType'>): Promise<ObjectId> => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    const uploadStream = bucket.openUploadStream(metadata.filename, {
      metadata: {
        ...metadata,
        contentType: metadata.contentType,
      },
    });

    readableStream
      .pipe(uploadStream)
      .on('error', (error) => {
        logger.error(`Error storing file in GridFS: ${error}`);
        reject(error);
      })
      .on('finish', () => {
        resolve(uploadStream.id);
      });
  });
};

// S3 storage functionality has been removed to avoid AWS costs

/**
 * Store file in local filesystem
 * @param buffer File buffer
 * @param metadata File metadata
 * @returns File path
 */
const storeFileLocally = async (
  buffer: Buffer,
  metadata: Omit<FileMetadata, 'id' | 'storageType' | 'path'>
): Promise<string> => {
  try {
    ensureLocalStorageDir();

    // Create a unique filename to avoid collisions
    const uniqueFilename = `${uuidv4()}-${sanitizeFilename(metadata.originalname)}`;
    const filePath = path.join(LOCAL_STORAGE_DIR, uniqueFilename);

    // Write file to disk
    await fs.promises.writeFile(filePath, buffer);
    logger.debug(`File stored locally: ${filePath}`);

    return filePath;
  } catch (error) {
    logger.error(`Error storing file locally: ${error}`);
    throw error;
  }
};

/**
 * Store file using the specified storage type
 * @param buffer File buffer
 * @param metadata File metadata (without id and storageType)
 * @param storageType Storage type to use
 * @returns Complete file metadata with ID
 */
export const storeFile = async (
  buffer: Buffer,
  metadata: Omit<FileMetadata, 'id' | 'storageType' | 'uploadDate' | 'path'>,
  storageType: StorageType = StorageType.GRIDFS
): Promise<FileMetadata> => {
  try {
    // Set upload date
    const uploadDate = new Date();

    // Store file based on storage type
    switch (storageType) {
      case StorageType.GRIDFS: {
        const fileId = await storeFileInGridFS(buffer, { ...metadata, uploadDate });
        const fileMetadata: FileMetadata = {
          id: fileId.toHexString(),
          ...metadata,
          uploadDate,
          storageType: StorageType.GRIDFS,
        };

        // Save metadata to database
        await FileMetadataModel.create({ ...fileMetadata, _id: fileMetadata.id });

        // Cache metadata
        await setFileMetadataInCache(fileMetadata.id, fileMetadata);

        return fileMetadata;
      }

      // S3 storage case has been removed to avoid AWS costs

      case StorageType.LOCAL: {
        const filePath = await storeFileLocally(buffer, { ...metadata, uploadDate });
        const fileId = uuidv4();
        const fileMetadata: FileMetadata = {
          id: fileId,
          ...metadata,
          uploadDate,
          storageType: StorageType.LOCAL,
          path: filePath,
        };

        // Save metadata to database
        await FileMetadataModel.create({ ...fileMetadata, _id: fileMetadata.id });

        // Cache metadata
        await setFileMetadataInCache(fileMetadata.id, fileMetadata);

        return fileMetadata;
      }

      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error) {
    logger.error(`Error storing file: ${error}`);
    throw error;
  }
};

/**
 * Retrieve file from GridFS
 * @param id File ID
 * @returns GridFS download stream
 */
const retrieveFileFromGridFS = (id: string) => {
  try {
    const bucket = getGridFSBucket();
    return bucket.openDownloadStream(new ObjectId(id));
  } catch (error) {
    logger.error(`Error retrieving file from GridFS: ${error}`);
    throw error;
  }
};

// S3 retrieval functionality has been removed to avoid AWS costs

/**
 * Retrieve file from local filesystem
 * @param filePath Path to the file
 * @returns File buffer
 */
const retrieveFileFromLocal = async (filePath: string): Promise<Buffer> => {
  try {
    return await fs.promises.readFile(filePath);
  } catch (error) {
    logger.error(`Error retrieving file from local filesystem: ${error}`);
    throw error;
  }
};

/**
 * Retrieve file metadata
 * @param id File ID
 * @returns File metadata
 */
export const getFileMetadata = async (id: string): Promise<FileMetadata | null> => {
  try {
    // Try to get metadata from cache first
    const cachedMetadata = await getFileMetadataFromCache(id);
    if (cachedMetadata) {
      return cachedMetadata as FileMetadata;
    }

    // If not in cache, retrieve from database
    const dbMetadata = await FileMetadataModel.findById(id).lean();
    if (dbMetadata) {
      // Cache metadata for future requests
      await setFileMetadataInCache(id, dbMetadata as FileMetadata);
      return dbMetadata as FileMetadata;
    }

    // If not in database, try to retrieve from GridFS (for legacy or direct GridFS entries)
    const bucket = getGridFSBucket();
    const files = await bucket.find({ _id: new ObjectId(id) }).toArray();

    if (files.length === 0) {
      return null;
    }

    const file = files[0];
    const metadata: FileMetadata = {
      id: file._id.toHexString(),
      filename: file.filename,
      originalname: file.metadata?.originalname || file.filename,
      contentType: file.metadata?.contentType || 'application/octet-stream',
      size: file.length,
      category: file.metadata?.category || FileCategory.OTHER,
      uploadDate: file.uploadDate,
      storageType: StorageType.GRIDFS, // Assuming GridFS if found here
      thumbnailId: file.metadata?.thumbnailId,
      processingOptions: file.metadata?.processingOptions,
    };

    // Save to database if found in GridFS but not in our metadata collection
    await FileMetadataModel.create({ ...metadata, _id: metadata.id });

    // Cache metadata for future requests
    await setFileMetadataInCache(id, metadata);

    return metadata;
  } catch (error) {
    logger.error(`Error retrieving file metadata: ${error}`);
    return null;
  }
};

/**
 * Retrieve file content
 * @param metadata File metadata
 * @returns File content as stream or buffer
 */
export const retrieveFile = async (metadata: FileMetadata): Promise<Readable | Buffer> => {
  try {
    switch (metadata.storageType) {
      case StorageType.GRIDFS:
        return retrieveFileFromGridFS(metadata.id);

      // S3 case has been removed to avoid AWS costs

      case StorageType.LOCAL:
        if (!metadata.path) {
          throw new Error('Missing file path in metadata');
        }
        const localBuffer = await retrieveFileFromLocal(metadata.path);
        const localStream = new Readable();
        localStream.push(localBuffer);
        localStream.push(null);
        return localStream;

      default:
        throw new Error(`Unsupported storage type: ${metadata.storageType}`);
    }
  } catch (error) {
    logger.error(`Error retrieving file: ${error}`);
    throw error;
  }
};

/**
 * Delete file
 * @param metadata File metadata
 * @returns True if deletion was successful
 */
export const deleteFile = async (metadata: FileMetadata): Promise<boolean> => {
  try {
    switch (metadata.storageType) {
      case StorageType.GRIDFS:
        const bucket = getGridFSBucket();
        await bucket.delete(new ObjectId(metadata.id));
        break;

      // S3 case has been removed to avoid AWS costs

      case StorageType.LOCAL:
        if (!metadata.path) {
          throw new Error('Missing file path in metadata');
        }
        await fs.promises.unlink(metadata.path);
        break;

      default:
        throw new Error(`Unsupported storage type: ${metadata.storageType}`);
    }

    // Delete thumbnail if exists
    if (metadata.thumbnailId) {
      try {
        const thumbnailMetadata = await getFileMetadata(metadata.thumbnailId);
        if (thumbnailMetadata) {
          await deleteFile(thumbnailMetadata);
          await invalidateFileCache(metadata.thumbnailId);
        }
      } catch (error) {
        logger.warn(`Error deleting thumbnail: ${error}`);
      }
    }

    // Delete metadata from database
    await FileMetadataModel.findByIdAndDelete(metadata.id);

    // Invalidate cache
    await invalidateFileCache(metadata.id);

    return true;
  } catch (error) {
    logger.error(`Error deleting file: ${error}`);
    return false;
  }
};

/**
 * Get preferred storage type based on file metadata and configuration
 * @param size File size in bytes
 * @param category File category
 * @returns Preferred storage type
 */
export const getPreferredStorageType = (_size: number, category: FileCategory): StorageType => {
  // Use local storage for temporary files if configured
  if (envConfig.localStoragePath && category === FileCategory.OTHER) {
    return StorageType.LOCAL;
  }

  // Default to GridFS
  return StorageType.GRIDFS;
};
