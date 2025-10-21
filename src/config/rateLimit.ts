import rateLimit from 'express-rate-limit';
import {MILLISECONDS_IN_A_SECOND, SECONDS_IN_A_MINUTE} from '../utils/constants';
import logger from '../utils/logger';
import envConfig from './envConfig';
import express from 'express';

const isProduction = envConfig.env === 'production';

// Global rate limiter for all routes
const globalRateLimit = rateLimit({
    windowMs: 5 * SECONDS_IN_A_MINUTE * MILLISECONDS_IN_A_SECOND, // 5 minutes
    max: 500, // 500 requests per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        error: 'Too many requests from this IP. Please try again later.',
    },
    handler: (request, response, _next, options) => {
        logger.warn(`Rate limit exceeded for IP: ${request.ip}`);
        response.status(options.statusCode).send(options.message);
    },
});

const authRateLimiter = rateLimit({
    windowMs: 15 * SECONDS_IN_A_MINUTE * MILLISECONDS_IN_A_SECOND, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        error: 'Too many login attempts. Please try again later.',
    },
    handler: (_request, response, next, options) => {
        response.status(options.statusCode).send(options.message);
        next();
    },
});

// API rate limiter for API endpoints
const apiRateLimit = rateLimit({
    windowMs: SECONDS_IN_A_MINUTE * MILLISECONDS_IN_A_SECOND, // 1 minute
    max: 60, // 60 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        error: 'Too many API requests. Please try again later.',
    },
    handler: (request, response, _next, options) => {
        logger.warn(`API rate limit exceeded for IP: ${request.ip}, path: ${request.path}`);
        response.status(options.statusCode).send(options.message);
    },
});

export const rateLimiter = (app: express.Express) => {
    app.use(globalRateLimit);
    if (isProduction) {
        app.use('/api/v1/auth', authRateLimiter);
        app.use('/api/v1', apiRateLimit);
    }
};

// File upload rate limiter
export const uploadRateLimiter = rateLimit({
    windowMs: envConfig.uploadRateLimitWindow * 1000, // Convert seconds to milliseconds
    max: envConfig.uploadRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        error: 'Too many file uploads. Please try again later.',
    },
});
