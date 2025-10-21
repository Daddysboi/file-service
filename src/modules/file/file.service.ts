import { getGridFSBucket } from '../../config/gridfs';
import { Readable } from 'stream';
import { GridFSBucketReadStream, ObjectId } from 'mongodb';

/**
 * Uploads a file to GridFS.
 * @param file The file object from multer (in memory).
 * @returns The ID of the stored file.
 */
export const uploadFile = (file: Express.Multer.File): Promise<ObjectId> => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);

    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: { contentType: file.mimetype, originalname: file.originalname },
    });

    readableStream
      .pipe(uploadStream)
      .on('error', (error) => {
        reject(error);
      })
      .on('finish', () => {
        resolve(uploadStream.id);
      });
  });
};

/**
 * Downloads a file from GridFS.
 * @param id The ID of the file to download.
 * @returns A GridFS download stream.
 */
export const downloadFile = (id: string): GridFSBucketReadStream => {
  const bucket = getGridFSBucket();
  const downloadStream = bucket.openDownloadStream(new ObjectId(id));

  return downloadStream;
};
