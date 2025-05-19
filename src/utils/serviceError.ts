// src/services/serviceError.ts
import AppError from '../utils/AppError';

export class ServiceError extends AppError {
  constructor(message: string, statusCode = 500) {
    super(message, statusCode, true);
  }

  static DatabaseError(message = 'Database operation failed') {
    return new ServiceError(message, 500);
  }

  static NotFound(message = 'Requested resource not found') {
    return new ServiceError(message, 404);
  }

  static ValidationError(message = 'Invalid data provided') {
    return new ServiceError(message, 400);
  }
}
