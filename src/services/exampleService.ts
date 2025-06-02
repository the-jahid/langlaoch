import { ServiceError } from '../utils/serviceError';

export const exampleService = async (data: any) => {
  try {
    // Some operation that might fail
    if (!data) {
      throw ServiceError.ValidationError('Data is required');
    }

    if (data.id === '123') {
      throw ServiceError.NotFound('Resource with id 123 not found');
    }

    // ... more logic ...

    if (/* database operation failed */ false) {
      throw ServiceError.DatabaseError('Failed to save data');
    }

    return { success: true, message: 'Operation successful' };
  } catch (error) {
    // Handle the error (e.g., log it, re-throw it, etc.)
    console.error(error);
    throw error; // Re-throw the error to be caught by your error handling middleware
  }
};
