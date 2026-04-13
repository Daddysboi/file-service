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

// Public routes (no JWT required)

// Route for file upload from another backend service (protected by API Key in handler)
router.post('/upload/service', uploadServiceHandler);

// Route to get a file by its ID (Public access)
// If you need this to be private, move it below authenticateJWT
router.get('/:id', getFileHandler);

// Middleware to protect all other routes in this module
router.use(authenticateJWT);

// Route for single file upload from frontend (User must be logged in)
router.post('/upload/single', uploadRateLimiter, uploadSingleHandler);

// Route for batch file upload (User must be logged in)
router.post('/upload/batch', uploadRateLimiter, uploadBatchHandler);

// Route to delete a file by its ID (User must be logged in)
router.delete('/:id', deleteFileHandler);

export default router;
