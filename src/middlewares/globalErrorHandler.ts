import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';
import { ServiceError } from '../utils/serviceError';

export const globalErrorHandler = (
  err: any, // Changed type to any to catch all errors
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Check if the error is an instance of AppError or ServiceError
  if (err instanceof AppError) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  } else if (err instanceof ServiceError) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  }
  else {
    // If it's not a known error type, handle it as a generic error
    console.error(err); // Log the error for debugging purposes
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  }
};