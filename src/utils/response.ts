import { Response } from 'express';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'OK',
  status = 200
) => res.status(status).json({ success: true, message, data });

export const sendError = (
  res: Response,
  message = 'Error',
  status = 500,
  errors?: unknown
) => res.status(status).json({ success: false, message, errors });