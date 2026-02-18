import {Request, Response, NextFunction} from 'express';
import httpStatus from 'http-status';
import multer from 'multer';
import AppError from '../../utils/AppError';
import catchAsyncError from '../../utils/catchAsyncError';
import {validateFile, FileCategory, sanitizeFilename} from '../../services/file-validation.service';
import {processFile, generateThumbnail, getContentDisposition} from '../../services/file-processing.service';
import {
    storeFile,
    getFileMetadata,
    retrieveFile,
    deleteFile,
    getPreferredStorageType,
    FileMetadata
} from '../../services/storage.service';
import { StorageType } from '../../types/enums';
import {getFileContentFromCache, setFileContentInCache} from '../../services/cache.service';
import {updateStorageMetrics} from '../../services/monitoring.service';
import envConfig from '../../config/envConfig';
import logger from '../../utils/logger';

// Enhanced multer setup for file handling
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: envConfig.maxFileSize, // Configurable file size limit
        files: 50, // Maximum number of files per request
    },
});

/**
 * Upload a single file
 */
export const uploadSingleHandler = [
    upload.single('file'),
    catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            return next(new AppError(httpStatus.BAD_REQUEST, 'No file uploaded.'));
        }

        try {
            // Sanitize filename
            req.file.originalname = sanitizeFilename(req.file.originalname);

            // Validate file
            const {mimeType, category} = await validateFile(req.file);

            // Process file if needed (e.g., optimize images)
            const {buffer: processedBuffer, mimeType: processedMimeType} = await processFile(
                req.file.buffer,
                mimeType,
                category,
                {
                    optimize: envConfig.imageOptimizationEnabled,
                    format: 'webp', // Convert images to WebP for better compression
                    quality: envConfig.defaultImageQuality,
                    maxWidth: envConfig.maxImageDimension,
                    maxHeight: envConfig.maxImageDimension,
                }
            );

            // Determine best storage type based on file size and category
            const storageType = getPreferredStorageType(processedBuffer.length, category);

            // Store file
            const fileMetadata = await storeFile(
                processedBuffer,
                {
                    filename: req.file.originalname,
                    originalname: req.file.originalname,
                    contentType: processedMimeType,
                    size: processedBuffer.length,
                    category,
                },
                storageType
            );

            // Generate thumbnail for images if enabled
            if (category === FileCategory.IMAGE && envConfig.generateThumbnails) {
                try {
                    const thumbnailBuffer = await generateThumbnail(req.file.buffer);
                    const thumbnailMetadata = await storeFile(
                        thumbnailBuffer,
                        {
                            filename: `thumbnail-${req.file.originalname}`,
                            originalname: `thumbnail-${req.file.originalname}`,
                            contentType: 'image/webp',
                            size: thumbnailBuffer.length,
                            category: FileCategory.IMAGE,
                        },
                        storageType
                    );

                    // Link thumbnail to original file
                    fileMetadata.thumbnailId = thumbnailMetadata.id;
                } catch (error) {
                    logger.error(`Failed to generate thumbnail: ${error}`);
                }
            }

            // Update metrics
            updateStorageMetrics(storageType, processedBuffer.length);

            // Return success response
            res.status(httpStatus.CREATED).json({
                message: 'File uploaded successfully',
                file: {
                    id: fileMetadata.id,
                    filename: fileMetadata.filename,
                    size: fileMetadata.size,
                    contentType: fileMetadata.contentType,
                    category: fileMetadata.category,
                    thumbnailId: fileMetadata.thumbnailId,
                },
            });
        } catch (error) {
            if (error instanceof AppError) {
                return next(error);
            }
            logger.error(`Error uploading file: ${error}`);
            return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload file'));
        }
    }),
];

/**
 * Upload a file from another service
 */
export const uploadServiceHandler = [
    upload.single('file'),
    catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            return next(new AppError(httpStatus.BAD_REQUEST, 'No file uploaded.'));
        }

        // Additional service authentication check
        const serviceApiKey = req.headers['x-api-key'];
        if (!serviceApiKey) {
            return next(new AppError(httpStatus.UNAUTHORIZED, 'Service API key is required'));
        }

        // Here you would validate the API key against allowed services
        // This is a simplified check - in production, use a more robust validation
        if (serviceApiKey !== process.env.SERVICE_API_KEY) {
            return next(new AppError(httpStatus.UNAUTHORIZED, 'Invalid service API key'));
        }

        try {
            // Sanitize filename
            req.file.originalname = sanitizeFilename(req.file.originalname);

            // Validate file with more permissive settings for trusted services
            const {mimeType, category} = await validateFile(req.file, {
                maxSize: envConfig.maxFileSize * 2, // Double the size limit for trusted services
            });

            // Process file if needed
            const {buffer: processedBuffer, mimeType: processedMimeType} = await processFile(
                req.file.buffer,
                mimeType,
                category,
                {
                    optimize: envConfig.imageOptimizationEnabled,
                }
            );

            // For service uploads, use GridFS for durability
            const storageType = StorageType.GRIDFS;

            // Store file
            const fileMetadata = await storeFile(
                processedBuffer,
                {
                    filename: req.file.originalname,
                    originalname: req.file.originalname,
                    contentType: processedMimeType,
                    size: processedBuffer.length,
                    category,
                },
                storageType
            );

            // Update metrics
            updateStorageMetrics(storageType, processedBuffer.length);

            // Return success response
            res.status(httpStatus.CREATED).json({
                message: 'File uploaded successfully from service',
                file: {
                    id: fileMetadata.id,
                    filename: fileMetadata.filename,
                    size: fileMetadata.size,
                    contentType: fileMetadata.contentType,
                    category: fileMetadata.category,
                },
            });
        } catch (error) {
            if (error instanceof AppError) {
                return next(error);
            }
            logger.error(`Error uploading file from service: ${error}`);
            return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload file'));
        }
    }),
];

/**
 * Upload multiple files in a batch
 */
export const uploadBatchHandler = [
    upload.array('files', 50), // Allow up to 50 files in a batch
    catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return next(new AppError(httpStatus.BAD_REQUEST, 'No files uploaded.'));
        }

        try {
            // Process files in parallel with concurrency limit
            const concurrencyLimit = 5; // Process 5 files at a time
            const results: Array<{
                id: string;
                filename: string;
                size: number;
                contentType: string;
                category: FileCategory;
            } | {
                filename: string;
                error: string;
            }> = [];

            // Process files in batches to limit concurrency
            for (let i = 0; i < files.length; i += concurrencyLimit) {
                const batch = files.slice(i, i + concurrencyLimit);
                const batchResults = await Promise.all(
                    batch.map(async (file) => {
                        try {
                            // Sanitize filename
                            file.originalname = sanitizeFilename(file.originalname);

                            // Validate file
                            const {mimeType, category} = await validateFile(file);

                            // Process file
                            const {buffer: processedBuffer, mimeType: processedMimeType} = await processFile(
                                file.buffer,
                                mimeType,
                                category,
                                {
                                    optimize: envConfig.imageOptimizationEnabled,
                                }
                            );

                            // Determine storage type
                            const storageType = getPreferredStorageType(processedBuffer.length, category);

                            // Store file
                            const fileMetadata = await storeFile(
                                processedBuffer,
                                {
                                    filename: file.originalname,
                                    originalname: file.originalname,
                                    contentType: processedMimeType,
                                    size: processedBuffer.length,
                                    category,
                                },
                                storageType
                            );

                            // Update metrics
                            updateStorageMetrics(storageType, processedBuffer.length);

                            return {
                                id: fileMetadata.id,
                                filename: fileMetadata.filename,
                                size: fileMetadata.size,
                                contentType: fileMetadata.contentType,
                                category: fileMetadata.category,
                            };
                        } catch (error) {
                            logger.error(`Error processing file ${file.originalname}: ${error}`);
                            return {
                                filename: file.originalname,
                                error: error instanceof AppError ? error.message : 'Failed to process file',
                            };
                        }
                    })
                );

                results.push(...batchResults);
            }

            // Return success response
            res.status(httpStatus.CREATED).json({
                message: 'Batch upload processed',
                totalFiles: files.length,
                successCount: results.filter(r => !('error' in r)).length,
                errorCount: results.filter(r => 'error' in r).length,
                files: results,
            });
        } catch (error) {
            logger.error(`Error in batch upload: ${error}`);
            return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process batch upload'));
        }
    }),
];

/**
 * Get a file by ID
 */
export const getFileHandler = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const {id} = req.params;
    const {thumbnail, download} = req.query;

    try {
        // Check if this is a thumbnail request
        const fileId = thumbnail === 'true' ? id : id;

        // Try to get file from cache first
        if (envConfig.cachingEnabled) {
            const cachedContent = await getFileContentFromCache(fileId);
            if (cachedContent) {
                // Get metadata for headers
                const metadata = await getFileMetadata(fileId);
                if (metadata) {
                    // Set appropriate headers
                    res.set({
                        'Content-Type': metadata.contentType,
                        'Content-Disposition': getContentDisposition(
                            metadata.filename,
                            metadata.contentType,
                            download === 'true' ? 'attachment' : 'inline'
                        ),
                        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
                        'ETag': `"${fileId}"`,
                    });

                    return res.send(cachedContent);
                }
            }
        }

        // Get file metadata
        const metadata = await getFileMetadata(fileId);
        if (!metadata) {
            return next(new AppError(httpStatus.NOT_FOUND, 'File not found'));
        }

        // If thumbnail was requested but not found, fall back to original
        let targetMetadata: FileMetadata = metadata;
        if (thumbnail === 'true' && metadata.thumbnailId) {
            const thumbnailMetadata = await getFileMetadata(metadata.thumbnailId);
            if (thumbnailMetadata) {
                targetMetadata = thumbnailMetadata;
            }
        }

        // Set appropriate headers
        res.set({
            'Content-Type': targetMetadata.contentType,
            'Content-Disposition': getContentDisposition(
                targetMetadata.filename,
                targetMetadata.contentType,
                download === 'true' ? 'attachment' : 'inline'
            ),
            'Cache-Control': 'public, max-age=86400', // Cache for 1 day
            'ETag': `"${targetMetadata.id}"`,
        });

        // Handle conditional requests
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch.includes(`"${targetMetadata.id}"`)) {
            return res.status(304).end();
        }

        // Get file content
        const fileContent = await retrieveFile(targetMetadata);

        // If it's a stream, pipe it to the response
        if ('pipe' in fileContent) {
            // For streams, we can't cache easily, so just pipe
            fileContent.pipe(res);
        } else {
            // For buffers, we can cache and send
            if (envConfig.cachingEnabled && targetMetadata.size < 5 * 1024 * 1024) { // Only cache files < 5MB
                await setFileContentInCache(targetMetadata.id, fileContent, targetMetadata.size);
            }
            res.send(fileContent);
        }
    } catch (error) {
        logger.error(`Error retrieving file: ${error}`);
        return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve file'));
    }
});

/**
 * Delete a file by ID
 */
export const deleteFileHandler = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const {id} = req.params;

    try {
        // Get file metadata
        const metadata = await getFileMetadata(id);
        if (!metadata) {
            return next(new AppError(httpStatus.NOT_FOUND, 'File not found'));
        }

        // Delete file
        const deleted = await deleteFile(metadata);
        if (!deleted) {
            return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete file'));
        }

        // Return success response
        res.status(httpStatus.OK).json({
            message: 'File deleted successfully',
            id: metadata.id,
        });
    } catch (error) {
        logger.error(`Error deleting file: ${error}`);
        return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete file'));
    }
});
