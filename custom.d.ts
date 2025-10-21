import * as express from 'express';

declare global {
  namespace Express {
    export interface Response {
      cookie(name: string, value: string, options?: express.CookieOptions): this;
      query: { token?: string, page?: number };
    }
  }
}
