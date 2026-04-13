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
import {getFileContentFromCache, setFileContentInCache, setFileMetadataInCache} from '../../services/cache.service';
import {updateStorageMetrics} from '../../services/monitoring.service';
import { FileMetadataModel } from '../../models/file.model';
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

                    // Link thumbnail to original file and SAVE to database
                    fileMetadata.thumbnailId = thumbnailMetadata.id;
                    await FileMetadataModel.findByIdAndUpdate(fileMetadata.id, { 
                        thumbnailId: thumbnailMetadata.id 
                    });
                    
                    // Update cache
                    await setFileMetadataInCache(fileMetadata.id, fileMetadata);
                    
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

        logger.debug(`Comparing API keys: Received='${serviceApiKey}', Expected='${process.env.SERVICE_API_KEY}'`);
        if (serviceApiKey !== process.env.SERVICE_API_KEY) {
            return next(new AppError(httpStatus.UNAUTHORIZED, 'Invalid service API key'));
        }

        try {
            // Sanitize filename
            req.file.originalname = sanitizeFilename(req.file.originalname);

            // Validate file with more permissive settings for trusted services
            const {mimeType, category} = await validateFile(req.file, {
                maxSize: envConfig.maxFileSize * 2,
            });

            // Process file
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
    upload.array('files', 50),
    catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return next(new AppError(httpStatus.BAD_REQUEST, 'No files uploaded.'));
        }

        try {
            const concurrencyLimit = 5;
            const results: any[] = [];

            for (let i = 0; i < files.length; i += concurrencyLimit) {
                const batch = files.slice(i, i + concurrencyLimit);
                const batchResults = await Promise.all(
                    batch.map(async (file) => {
                        try {
                            file.originalname = sanitizeFilename(file.originalname);
                            const {mimeType, category} = await validateFile(file);
                            const {buffer: processedBuffer, mimeType: processedMimeType} = await processFile(
                                file.buffer,
                                mimeType,
                                category,
                                { optimize: envConfig.imageOptimizationEnabled }
                            );

                            const storageType = getPreferredStorageType(processedBuffer.length, category);
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

    logger.debug(`Retrieving file: ID=${id}, thumbnail=${thumbnail}`);

    try {
        // Try content cache first
        if (envConfig.cachingEnabled) {
            const cachedContent = await getFileContentFromCache(id);
            if (cachedContent) {
                const metadata = await getFileMetadata(id);
                if (metadata) {
                    res.set({
                        'Content-Type': metadata.contentType,
                        'Content-Disposition': getContentDisposition(
                            metadata.filename,
                            metadata.contentType,
                            download === 'true' ? 'attachment' : 'inline'
                        ),
                        'Cache-Control': 'public, max-age=86400',
                        'ETag': `"${id}"`,
                    });
                    return res.send(cachedContent);
                }
            }
        }

        // Get metadata
        const metadata = await getFileMetadata(id);
        if (!metadata) {
            logger.warn(`Metadata NOT FOUND for ID: ${id}`);
            return next(new AppError(httpStatus.NOT_FOUND, 'File metadata not found'));
        }

        logger.debug(`Metadata found for ${id}: storageType=${metadata.storageType}, innerID=${metadata.id}, thumbnailId=${metadata.thumbnailId}`);

        // Handle thumbnail logic
        let targetMetadata: FileMetadata = metadata;
        if (thumbnail === 'true') {
            if (metadata.thumbnailId) {
                const thumbnailMetadata = await getFileMetadata(metadata.thumbnailId);
                if (thumbnailMetadata) {
                    targetMetadata = thumbnailMetadata;
                    logger.debug(`Using thumbnail metadata: ${targetMetadata.id}`);
                } else {
                    logger.warn(`Thumbnail metadata ${metadata.thumbnailId} not found, falling back to original`);
                }
            } else {
                logger.debug('No thumbnail available for this file, using original');
            }
        }

        // Set headers
        res.set({
            'Content-Type': targetMetadata.contentType,
            'Content-Disposition': getContentDisposition(
                targetMetadata.filename,
                targetMetadata.contentType,
                download === 'true' ? 'attachment' : 'inline'
            ),
            'Cache-Control': 'public, max-age=86400',
            'ETag': `"${targetMetadata.id}"`,
        });

        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch.includes(`"${targetMetadata.id}"`)) {
            return res.status(304).end();
        }

        // Stream file
        let fileStream;
        try {
            logger.debug(`Opening stream for storage ID: ${targetMetadata.id}`);
            fileStream = await retrieveFile(targetMetadata);
        } catch (err: any) {
            logger.error(`Retrieve error for ${targetMetadata.id}: ${err.message}`);
            if (err.message && err.message.includes('FileNotFound')) {
                return next(new AppError(httpStatus.NOT_FOUND, 'Physical file not found in storage (GridFS)'));
            }
            throw err;
        }

        if (envConfig.cachingEnabled && targetMetadata.size < 5 * 1024 * 1024) {
            const chunks: Buffer[] = [];
            fileStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            fileStream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                await setFileContentInCache(targetMetadata.id, buffer, targetMetadata.size);
                if (!res.headersSent) res.send(buffer);
            });
            fileStream.on('error', (err: any) => {
                logger.error(`Stream error: ${err.message}`);
                if (!res.headersSent) {
                    const status = err.message.includes('FileNotFound') ? httpStatus.NOT_FOUND : httpStatus.INTERNAL_SERVER_ERROR;
                    next(new AppError(status, err.message.includes('FileNotFound') ? 'Physical file missing' : 'Failed to read stream'));
                }
            });
        } else {
            fileStream.on('error', (err: any) => {
                logger.error(`Pipe error: ${err.message}`);
                if (!res.headersSent) {
                    const status = err.message.includes('FileNotFound') ? httpStatus.NOT_FOUND : httpStatus.INTERNAL_SERVER_ERROR;
                    next(new AppError(status, 'File storage error'));
                }
            });
            fileStream.pipe(res);
        }
    } catch (error: any) {
        logger.error(`Handler error: ${error.message}`);
        return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving file'));
    }
});

/**
 * Delete a file by ID
 */
export const deleteFileHandler = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const {id} = req.params;
    const metadata = await getFileMetadata(id);
    if (!metadata) return next(new AppError(httpStatus.NOT_FOUND, 'File not found'));

    const deleted = await deleteFile(metadata);
    if (!deleted) return next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete file'));

    res.status(httpStatus.OK).json({ message: 'File deleted successfully', id });
});
