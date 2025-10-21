import { Document, Query } from 'mongoose';

declare module 'mongoose' {
  interface Document {
    softDelete(): Promise<this>;
  }

  interface Query<ResultType, DocType extends Document> {
    notDeleted(): Query<ResultType, DocType>;
  }
}
