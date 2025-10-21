import { Db, GridFSBucket } from 'mongodb';
import { getDb } from './dbConnection';

let bucket: GridFSBucket;

const initializeGridFS = () => {
  const db: Db = getDb();
  if (!db) {
    throw new Error('Database not initialized. Cannot setup GridFS.');
  }
  bucket = new GridFSBucket(db, {
    bucketName: 'uploads', // You can name your bucket anything
  });
  console.log('GridFS initialized');
};

export const getGridFSBucket = (): GridFSBucket => {
  if (!bucket) {
    throw new Error('GridFSBucket not initialized.');
  }
  return bucket;
};

export { initializeGridFS };
