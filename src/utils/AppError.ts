import httpStatus from 'http-status';

export interface IErrorDetails {
  [key: string]: any;
}

export default class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode?: string;
  public details?: IErrorDetails;
  public action?: string;

  constructor(statusCode: number, message: string, errorCode?: string, action?: string, isOperational = true, stack = '') {
    super(message);
    this.name = this.constructor.name; // Set the name of the error
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.action = action;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static fromError(error: Error, statusCode: number = httpStatus.INTERNAL_SERVER_ERROR, isOperational = false): AppError {
    return new AppError(statusCode, error.message, undefined, undefined, isOperational, error.stack);
  }
}
