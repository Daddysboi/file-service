import http from 'http';
import cluster from 'cluster';
import os from 'os';
import { Express } from 'express';
import logger from '../utils/logger';
import envConfig from './envConfig';
import { initRedisClient } from '../services/cache.service';
import { Socket } from 'net'; // added import

// Graceful shutdown timeout
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

// Active connections tracking
const connections = new Set<Socket>(); // track sockets, not ServerResponse

/**
 * Initialize server with clustering support and graceful shutdown
 * @param app Express application
 */
const serverConfig = async (app: Express) => {
  // Initialize Redis client for caching if enabled
  if (envConfig.cachingEnabled && envConfig.redisUrl) {
    await initRedisClient();
  }

  // Use clustering in production if enabled
  if (envConfig.enableClustering && envConfig.env === 'production' && cluster.isPrimary) {
    setupCluster();
    return;
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Track connections for graceful shutdown
  server.on('connection', (connection: Socket) => {
    connections.add(connection);
    connection.on('close', () => {
      connections.delete(connection);
    });
  });

  // Start listening
  server.listen(envConfig.port, () => {
    const addr = server.address();
    const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
    logger.info('-------------*----------------------------------');
    logger.info('|                                               |');
    logger.info('|              Started File Server              |');
    logger.info(`|         Server is listening on ${bind}        |`);
    logger.info('|                                               |');
    logger.info('-----------*------------------------------------');

    if (cluster.isWorker) {
      logger.info(`Worker ${process.pid} started`);
    }
  });

  // Handle graceful shutdown
  setupGracefulShutdown(server);
};

/**
 * Set up cluster workers
 */
const setupCluster = () => {
  const numCPUs = envConfig.workerCount > 0 ? envConfig.workerCount : os.cpus().length;
  
  logger.info(`Setting up cluster with ${numCPUs} workers`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  // Handle worker events
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker');
    cluster.fork();
  });
  
  // Log when a worker comes online
  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });
};

/**
 * Set up graceful shutdown handlers
 * @param server HTTP server
 */
const setupGracefulShutdown = (server: http.Server) => {
  // Function to perform graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
      logger.info('Server closed. No longer accepting connections.');
    });
    
    // Set a timeout to force shutdown if it takes too long
    const forceShutdownTimeout = setTimeout(() => {
      logger.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT}ms. Forcing exit.`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
    
    // Clear timeout if all connections end before timeout
    if (connections.size === 0) {
      clearTimeout(forceShutdownTimeout);
      logger.info('All connections closed. Exiting process.');
      process.exit(0);
    }
    
    // Close existing connections
    connections.forEach((conn) => {
      try {
        conn.end();
      } catch {
        // if end fails, destroy the socket
        conn.destroy();
      }
    });
    
    // Check periodically if connections are closed
    const checkConnectionsInterval = setInterval(() => {
      if (connections.size === 0) {
        clearInterval(checkConnectionsInterval);
        clearTimeout(forceShutdownTimeout);
        logger.info('All connections closed. Exiting process.');
        process.exit(0);
      }
    }, 1000);
  };
  
  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    gracefulShutdown('unhandledRejection');
  });
};

export default serverConfig;