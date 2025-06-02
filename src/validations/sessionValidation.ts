import { z } from 'zod';

/**
 * Create chat session
 */


/**
 * Get, update, or delete a session by ID
 */
export const SessionIdParamSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});
