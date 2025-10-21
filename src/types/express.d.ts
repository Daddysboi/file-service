import { IUser } from '../domains/user/types';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export {};
