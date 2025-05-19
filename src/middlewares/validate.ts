// middlewares/validate.ts
import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { ZodSchema } from 'zod';

/**
 * Zod validation middleware factory.
 * validate(schema)            → validates req.body
 * validate(schema, 'query')   → validates req.query
 * validate(schema, 'params')  → validates req.params
 */
export const validate =
  (
    schema: ZodSchema,
    property: 'body' | 'query' | 'params' = 'body'
  ): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[property]);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid data';
      res.status(400).json({
        error: msg,
        details: parsed.error.format(),
      });
      return; // <- guarantees `void` is returned
    }

    // replace raw input with Zod-parsed (typed) data
    (req as any)[property] = parsed.data;
    next();
  };
