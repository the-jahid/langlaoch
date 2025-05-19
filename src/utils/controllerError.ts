// src/utils/controllerError.ts
import { Request, Response, NextFunction } from 'express';
import AppError from './AppError';

/**
 * Wrap an async controller so unhandled errors automatically reach the
 * global error middleware.  Usage:
 *
 *   export const getFoo = wrapController(async (req, res) => { ... });
 */
export const wrapController =
  <T = any>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
  ) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

/**
 * Use this inside an explicit try/catch block when you need to run extra
 * logic before forwarding the error (e.g. rollback, custom logging, etc.).
 *
 *   try {
 *     ...
 *   } catch (err) {
 *     handleControllerError(err, next);
 *   }
 */
export const handleControllerError = (
  err: unknown,
  next: NextFunction,
  defaultStatus = 500,
  defaultMessage = 'Internal controller error'
) => {
  if (err instanceof AppError) {
    // Already our custom error → pass straight through
    return next(err);
  }

  // Anything else becomes an operational AppError
  const wrapped = new AppError(
    (err as Error)?.message || defaultMessage,
    defaultStatus,
    true
  );
  next(wrapped);
};
/**
 * Use this inside an explicit try/catch block when you need to run extra
 * logic before forwarding the error (e.g. rollback, custom logging, etc.).
 *
 *   try {
 *     ...
 *   } catch (err) {
 *     handleControllerError(err, next);
 *   }
 */