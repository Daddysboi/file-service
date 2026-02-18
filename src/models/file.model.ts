import mongoose, { Schema, Document } from 'mongoose';
import { FileCategory } from '../services/file-validation.service';
import { StorageType } from '../types/enums';

// Extend the FileMetadata interface for Mongoose Document
export interface IFileMetadata extends Document {
  id: string; // This will be the _id from MongoDB, but we'll use it as a string
  filename: string;
  originalname: string;
  contentType: string;
  size: number;
  category: FileCategory;
  uploadDate: Date;
  storageType: StorageType;
  path?: string; // For local storage
  thumbnailId?: string; // ID of the thumbnail file
  processingOptions?: any; // Any processing options applied
}

const FileMetadataSchema: Schema = new Schema({
  _id: { type: String, required: true }, // Use string for compatibility with existing IDs
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  category: { type: String, enum: Object.values(FileCategory), required: true },
  uploadDate: { type: Date, required: true, default: Date.now },
  storageType: { type: String, enum: Object.values(StorageType), required: true },
  path: { type: String }, // Only for local storage
  thumbnailId: { type: String },
  processingOptions: { type: Schema.Types.Mixed },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
  _id: false, // Don't auto-generate _id, we'll provide it
});

// Pre-save hook to ensure 'id' is set to '_id' if not already
FileMetadataSchema.pre('save', function(next) {
  if (this.isNew && !this._id) {
    this._id = this.id;
  }
  next();
});

// Virtual for 'id' to match the interface, mapping to '_id'
FileMetadataSchema.virtual('id').get(function() {
  return this._id;
});

// Ensure virtuals are included in toJSON and toObject
FileMetadataSchema.set('toJSON', { virtuals: true });
FileMetadataSchema.set('toObject', { virtuals: true });


export const FileMetadataModel = mongoose.model<IFileMetadata>('FileMetadata', FileMetadataSchema);
