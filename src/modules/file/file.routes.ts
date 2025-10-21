import express from 'express';
import { 
  uploadSingleHandler, 
  uploadBatchHandler, 
  getFileHandler, 
  uploadServiceHandler,
  deleteFileHandler
} from './file.controller';
import { authenticateJWT } from '../../middlewares/jwt';
import { healthCheckHandler, metricsHandler } from '../../services/monitoring.service';
import {uploadRateLimiter} from "../../config/rateLimit";

const router = express.Router();

// Health check and metrics endpoints (no authentication required)
router.get('/health', healthCheckHandler);
router.get('/metrics', metricsHandler);

// Middleware to protect all other routes in this module
router.use(authenticateJWT);

// Route for single file upload from frontend
router.post('/upload/single', uploadRateLimiter, uploadSingleHandler);

// Route for file upload from another backend service
router.post('/upload/service', uploadServiceHandler);

// Route for batch file upload
router.post('/upload/batch', uploadRateLimiter, uploadBatchHandler);

// Route to get a file by its ID
router.get('/:id', getFileHandler);

// Route to delete a file by its ID
router.delete('/:id', deleteFileHandler);

export default router;
