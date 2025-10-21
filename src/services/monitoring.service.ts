import os from 'os';
import {Request, Response, NextFunction} from 'express';
import logger from '../utils/logger';
import envConfig from '../config/envConfig';

// Metrics storage
const metrics = {
    startTime: Date.now(),
    requestCount: 0,
    uploadCount: 0,
    downloadCount: 0,
    errorCount: 0,
    totalUploadSize: 0,
    totalDownloadSize: 0,
    responseTimeTotal: 0,
    responseTimeCount: 0,
    storageUsage: {
        gridfs: 0,
        s3: 0,
        local: 0,
    },
};

// Health check status
let isHealthy = true;
let lastHealthCheckTime = Date.now();
let lastDbConnectionStatus = true;

/**
 * Middleware to collect request metrics
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!envConfig.enableMetrics) {
        return next();
    }

    const startTime = Date.now();
    metrics.requestCount++;

    // Track file uploads
    if (req.method === 'POST' && req.path.includes('/upload')) {
        metrics.uploadCount++;

        // Track upload size after request is processed
        // capture original end and replace with a typed-safe wrapper
        const originalEnd = ((res.end as unknown) as (...args: any[]) => any).bind(res);
        (res as any).end = (...args: any[]) => {
            try {
                if ((req as any).file) {
                    metrics.totalUploadSize += (req as any).file.size || 0;
                } else if ((req as any).files && Array.isArray((req as any).files)) {
                    metrics.totalUploadSize += (req as any).files.reduce((total: number, file: any) => total + (file.size || 0), 0);
                }
            } catch (e) {
                // swallow metric errors to avoid interfering with response
            }
            return originalEnd(...args);
        };
    }

    // Track file downloads
    if (req.method === 'GET' && req.path.match(/^\/[^\/]+$/)) {
        metrics.downloadCount++;
    }

    // Track response time
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        metrics.responseTimeTotal += duration;
        metrics.responseTimeCount++;

        // Track errors
        if (res.statusCode >= 400) {
            metrics.errorCount++;
        }

        // Log slow requests
        if (duration > 1000) {
            logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
        }
    });

    next();
};

/**
 * Get system metrics
 * @returns System metrics
 */
const getSystemMetrics = () => {
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memUsage = process.memoryUsage();

    return {
        uptime: process.uptime(),
        cpuUsage: os.loadavg(),
        memoryUsage: {
            free: freeMem,
            total: totalMem,
            usedPercentage: ((totalMem - freeMem) / totalMem) * 100,
            process: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
            },
        },
        platform: process.platform,
        cpuCount: os.cpus().length,
    };
};

/**
 * Get application metrics
 * @returns Application metrics
 */
export const getMetrics = () => {
    if (!envConfig.enableMetrics) {
        return {metricsDisabled: true};
    }

    const systemMetrics = getSystemMetrics();
    const avgResponseTime = metrics.responseTimeCount > 0
        ? metrics.responseTimeTotal / metrics.responseTimeCount
        : 0;

    return {
        system: systemMetrics,
        application: {
            uptime: Date.now() - metrics.startTime,
            requestCount: metrics.requestCount,
            uploadCount: metrics.uploadCount,
            downloadCount: metrics.downloadCount,
            errorCount: metrics.errorCount,
            errorRate: metrics.requestCount > 0
                ? (metrics.errorCount / metrics.requestCount) * 100
                : 0,
            totalUploadSize: metrics.totalUploadSize,
            totalDownloadSize: metrics.totalDownloadSize,
            avgResponseTime,
            storageUsage: metrics.storageUsage,
        },
        health: {
            status: isHealthy ? 'healthy' : 'unhealthy',
            lastCheck: lastHealthCheckTime,
            dbConnection: lastDbConnectionStatus,
        },
    };
};

/**
 * Update storage usage metrics
 * @param storageType Storage type
 * @param size Size in bytes
 */
export const updateStorageMetrics = (storageType: string, size: number) => {
    if (!envConfig.enableMetrics) {
        return;
    }

    if (storageType in metrics.storageUsage) {
        metrics.storageUsage[storageType as keyof typeof metrics.storageUsage] += size;
    }
};

/**
 * Reset metrics (for testing)
 */
export const resetMetrics = () => {
    metrics.requestCount = 0;
    metrics.uploadCount = 0;
    metrics.downloadCount = 0;
    metrics.errorCount = 0;
    metrics.totalUploadSize = 0;
    metrics.totalDownloadSize = 0;
    metrics.responseTimeTotal = 0;
    metrics.responseTimeCount = 0;
    metrics.storageUsage = {
        gridfs: 0,
        s3: 0,
        local: 0,
    };
};

/**
 * Perform health check
 * @returns Health check result
 */
export const performHealthCheck = async () => {
    lastHealthCheckTime = Date.now();

    try {
        // Check database connection
        const mongoose = require('mongoose');
        lastDbConnectionStatus = mongoose.connection.readyState === 1;

        // Check disk space (for local storage)
        const systemMetrics = getSystemMetrics();
        const diskSpaceOk = systemMetrics.memoryUsage.usedPercentage < 90; // Less than 90% used

        // Check memory usage
        const memoryOk = systemMetrics.memoryUsage.process.heapUsed <
            systemMetrics.memoryUsage.process.heapTotal * 0.9; // Less than 90% of heap used

        // Overall health status
        isHealthy = lastDbConnectionStatus && diskSpaceOk && memoryOk;

        return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            checks: {
                database: {
                    status: lastDbConnectionStatus ? 'up' : 'down',
                },
                diskSpace: {
                    status: diskSpaceOk ? 'ok' : 'low',
                    usedPercentage: systemMetrics.memoryUsage.usedPercentage,
                },
                memory: {
                    status: memoryOk ? 'ok' : 'high',
                    heapUsed: systemMetrics.memoryUsage.process.heapUsed,
                    heapTotal: systemMetrics.memoryUsage.process.heapTotal,
                },
            },
            timestamp: lastHealthCheckTime,
        };
    } catch (error) {
        logger.error(`Health check failed: ${error}`);
        isHealthy = false;

        return {
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: lastHealthCheckTime,
        };
    }
};

/**
 * Health check route handler
 */
export const healthCheckHandler = async (_req: Request, res: Response) => {
    const healthCheck = await performHealthCheck();

    if (healthCheck.status === 'healthy') {
        return res.status(200).json(healthCheck);
    } else {
        return res.status(503).json(healthCheck);
    }
};

/**
 * Metrics route handler
 */
export const metricsHandler = (_req: Request, res: Response) => {
    if (!envConfig.enableMetrics) {
        return res.status(404).json({error: 'Metrics are disabled'});
    }

    return res.status(200).json(getMetrics());
};