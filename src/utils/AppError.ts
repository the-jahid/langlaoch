export default class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 500,
    public isOperational = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}