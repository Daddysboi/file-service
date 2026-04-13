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

/**
 * Store file in local filesystem
 */
const storeFileLocally = async (
  buffer: Buffer,
  metadata: Omit<FileMetadata, 'id' | 'storageType' | 'path'>
): Promise<string> => {
  try {
    ensureLocalStorageDir();
    const uniqueFilename = `${uuidv4()}-${sanitizeFilename(metadata.originalname)}`;
    const filePath = path.join(LOCAL_STORAGE_DIR, uniqueFilename);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  } catch (error) {
    logger.error(`Error storing file locally: ${error}`);
    throw error;
  }
};

/**
 * Store file using the specified storage type
 */
export const storeFile = async (
  buffer: Buffer,
  metadata: Omit<FileMetadata, 'id' | 'storageType' | 'uploadDate' | 'path'>,
  storageType: StorageType = StorageType.GRIDFS
): Promise<FileMetadata> => {
  try {
    const uploadDate = new Date();

    switch (storageType) {
      case StorageType.GRIDFS: {
        const fileId = await storeFileInGridFS(buffer, { ...metadata, uploadDate });
        const fileMetadata: FileMetadata = {
          id: fileId.toHexString(),
          ...metadata,
          uploadDate,
          storageType: StorageType.GRIDFS,
        };

        await FileMetadataModel.create({ ...fileMetadata, _id: fileMetadata.id });
        await setFileMetadataInCache(fileMetadata.id, fileMetadata);
        return fileMetadata;
      }

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

        await FileMetadataModel.create({ ...fileMetadata, _id: fileMetadata.id });
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
 */
const retrieveFileFromGridFS = (id: string) => {
  if (!id) throw new Error('Cannot retrieve file from GridFS with undefined ID');
  try {
    const bucket = getGridFSBucket();
    return bucket.openDownloadStream(new ObjectId(id));
  } catch (error) {
    logger.error(`Error retrieving file from GridFS for ID ${id}: ${error}`);
    throw error;
  }
};

/**
 * Retrieve file from local filesystem
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
 */
export const getFileMetadata = async (id: string): Promise<FileMetadata | null> => {
  try {
    const cachedMetadata = await getFileMetadataFromCache(id);
    if (cachedMetadata) return cachedMetadata as FileMetadata;

    // Use .lean() but manually map _id to id because lean objects don't have virtuals
    const dbMetadata = await FileMetadataModel.findById(id).lean();
    if (dbMetadata) {
      const metadata = {
        ...dbMetadata,
        id: dbMetadata._id.toString()
      } as unknown as FileMetadata;
      
      await setFileMetadataInCache(id, metadata);
      return metadata;
    }

    // Try fallback to GridFS directly
    try {
      const bucket = getGridFSBucket();
      const files = await bucket.find({ _id: new ObjectId(id) }).toArray();

      if (files.length === 0) return null;

      const file = files[0];
      const metadata: FileMetadata = {
        id: file._id.toHexString(),
        filename: file.filename,
        originalname: file.metadata?.originalname || file.filename,
        contentType: file.metadata?.contentType || 'application/octet-stream',
        size: file.length,
        category: file.metadata?.category || FileCategory.OTHER,
        uploadDate: file.uploadDate,
        storageType: StorageType.GRIDFS,
        thumbnailId: file.metadata?.thumbnailId,
        processingOptions: file.metadata?.processingOptions,
      };

      await FileMetadataModel.create({ ...metadata, _id: metadata.id });
      await setFileMetadataInCache(id, metadata);
      return metadata;
    } catch (gridFsError) {
      return null;
    }
  } catch (error) {
    logger.error(`Error retrieving file metadata: ${error}`);
    return null;
  }
};

/**
 * Retrieve file content
 */
export const retrieveFile = async (metadata: FileMetadata): Promise<Readable> => {
  try {
    switch (metadata.storageType) {
      case StorageType.GRIDFS:
        return retrieveFileFromGridFS(metadata.id);

      case StorageType.LOCAL:
        if (!metadata.path) throw new Error('Missing file path in metadata');
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
 */
export const deleteFile = async (metadata: FileMetadata): Promise<boolean> => {
  try {
    switch (metadata.storageType) {
      case StorageType.GRIDFS:
        const bucket = getGridFSBucket();
        await bucket.delete(new ObjectId(metadata.id));
        break;

      case StorageType.LOCAL:
        if (!metadata.path) throw new Error('Missing file path in metadata');
        await fs.promises.unlink(metadata.path);
        break;

      default:
        throw new Error(`Unsupported storage type: ${metadata.storageType}`);
    }

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

    await FileMetadataModel.findByIdAndDelete(metadata.id);
    await invalidateFileCache(metadata.id);
    return true;
  } catch (error) {
    logger.error(`Error deleting file: ${error}`);
    return false;
  }
};

/**
 * Get preferred storage type
 */
export const getPreferredStorageType = (_size: number, category: FileCategory): StorageType => {
  if (envConfig.localStoragePath && category === FileCategory.OTHER) {
    return StorageType.LOCAL;
  }
  return StorageType.GRIDFS;
};
