# File Service

A high-performance, scalable, and secure file service for handling file uploads, storage, and delivery. This service is designed to handle thousands of files of all sizes and formats with features comparable to Amazon S3 and Cloudinary.

## Features

### Performance and Scalability
- **Multi-storage Backend**: Support for MongoDB GridFS, Amazon S3, and local filesystem
- **Intelligent Storage Selection**: Automatically selects the best storage backend based on file size and type
- **Caching**: In-memory and Redis-based caching for frequently accessed files
- **Image Optimization**: Automatic image resizing, format conversion, and quality adjustment
- **Thumbnail Generation**: Automatic thumbnail creation for images
- **Clustering**: Multi-core utilization for improved performance
- **Compression**: Response compression for faster delivery
- **Conditional Requests**: Support for ETags and conditional GET requests

### Security
- **JWT Authentication**: Secure access to file operations
- **Service-to-Service Authentication**: API key-based authentication for backend services
- **File Validation**: Comprehensive file type and content validation
- **Filename Sanitization**: Prevention of path traversal and other security issues
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Content Disposition**: Appropriate content disposition based on file type
- **CORS Configuration**: Configurable cross-origin resource sharing

### Reliability
- **Graceful Shutdown**: Clean shutdown with connection draining
- **Error Handling**: Comprehensive error handling and logging
- **Health Checks**: Endpoint for monitoring service health
- **Metrics Collection**: Detailed metrics for monitoring and alerting
- **Worker Respawning**: Automatic respawning of crashed worker processes

## API Endpoints

### File Operations
- `POST /api/v1/files/upload/single`: Upload a single file
- `POST /api/v1/files/upload/batch`: Upload multiple files in a batch
- `POST /api/v1/files/upload/service`: Upload a file from another service
- `GET /api/v1/files/:id`: Get a file by ID
- `DELETE /api/v1/files/:id`: Delete a file by ID

### Monitoring
- `GET /api/v1/files/health`: Check service health
- `GET /api/v1/files/metrics`: Get service metrics

## Configuration

The service is highly configurable through environment variables:

### Server Configuration
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production)

### MongoDB Configuration
- `MONGODB_URL`: MongoDB connection URL

### Redis Configuration
- `REDIS_URL`: Redis connection URL for distributed caching

### AWS Configuration
- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_S3_BUCKET`: S3 bucket name (default: file-service)

### Local Storage Configuration
- `LOCAL_STORAGE_PATH`: Path for local file storage

### File Service Configuration
- `MAX_FILE_SIZE`: Maximum file size in MB (default: 50)
- `DEFAULT_STORAGE_TYPE`: Default storage type (gridfs, s3, local)

### Image Processing Configuration
- `IMAGE_OPTIMIZATION_ENABLED`: Enable image optimization (default: true)
- `DEFAULT_IMAGE_QUALITY`: Default image quality (0-100, default: 80)
- `MAX_IMAGE_DIMENSION`: Maximum image dimension (default: 4000)
- `GENERATE_THUMBNAILS`: Generate thumbnails for images (default: true)

### Caching Configuration
- `CACHING_ENABLED`: Enable caching (default: true)
- `CACHE_MAX_SIZE`: Maximum cache size in MB (default: 100)
- `CACHE_TTL`: Cache TTL in seconds (default: 3600)

### Security Configuration
- `CORS_ORIGINS`: Comma-separated list of allowed origins (default: *)
- `JWT_SECRET`: Secret for JWT signing
- `JWT_EXPIRES_IN`: JWT expiration time (default: 1d)

### Rate Limiting Configuration
- `GLOBAL_RATE_LIMIT`: Global rate limit (default: 500)
- `GLOBAL_RATE_LIMIT_WINDOW`: Global rate limit window in seconds (default: 300)
- `UPLOAD_RATE_LIMIT`: Upload rate limit (default: 20)
- `UPLOAD_RATE_LIMIT_WINDOW`: Upload rate limit window in seconds (default: 60)

### Monitoring Configuration
- `ENABLE_METRICS`: Enable metrics collection (default: false)

### Clustering Configuration
- `ENABLE_CLUSTERING`: Enable clustering (default: false)
- `WORKER_COUNT`: Number of worker processes (default: CPU count)

## Getting Started

### Prerequisites
- Node.js 18.12.0 or higher
- MongoDB
- Redis (optional, for distributed caching)
- AWS account (optional, for S3 storage)

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your configuration
4. Build the project: `npm run build`
5. Start the service: `npm start`

### Development
- Run in development mode: `npm run dev`
- Run tests: `npm test`
- Lint code: `npm run lint`

## Architecture

The file service is built with a modular architecture:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Implement business logic
- **Middleware**: Handle cross-cutting concerns
- **Config**: Configure the application
- **Utils**: Utility functions

Key services include:
- **Cache Service**: Handles caching of file metadata and content
- **File Validation Service**: Validates file types and sizes
- **File Processing Service**: Processes and optimizes files
- **Storage Service**: Manages file storage across different backends
- **Monitoring Service**: Collects metrics and provides health checks

## Performance Considerations

- **Caching**: Frequently accessed files are cached for faster access
- **Image Optimization**: Images are automatically optimized for faster delivery
- **Concurrency Control**: Batch operations use concurrency limits to prevent overloading
- **Streaming**: Files are streamed to and from storage for memory efficiency
- **Clustering**: Multiple worker processes handle requests in parallel

## Security Considerations

- **Authentication**: All file operations require authentication
- **File Validation**: Files are validated for type and content
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Content Disposition**: Forces attachment for potentially dangerous file types
- **Error Handling**: Prevents leaking sensitive information

## License

This project is licensed under the ISC License.