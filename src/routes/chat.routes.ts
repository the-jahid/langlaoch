// routes/chat.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { ChatRole } from '@prisma/client';
import * as chatCtrl from '../controllers/chat.controller';
import { validate } from '../middlewares/validate';

const router = Router();

/* ------------------------------------------------------------------
 * Zod schemas
 * -----------------------------------------------------------------*/
const createSessionSchema = z.object({
  title:        z.string().min(1).max(255).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  model:        z.string().optional(),           // e.g. "gpt-4o"
  params:       z.record(z.any()).optional(),    // arbitrary JSON
});

const sendMessageSchema = z.object({
  role:     z.nativeEnum(ChatRole).default(ChatRole.USER).optional(),
  content:  z.string().min(1, 'Message cannot be empty'),
  metadata: z.record(z.any()).optional(),
});

/* ------------------------------------------------------------------
 * Routes
 * -----------------------------------------------------------------*/

// Create a new chat session
router.post(
  '/sessions',
  validate(createSessionSchema),      // validates req.body
  chatCtrl.createSession
);

// Send a user message within an existing session
router.post(
  '/sessions/:sessionId/messages',
  validate(sendMessageSchema),        // validates req.body
  chatCtrl.sendUserMessage
);

// Get a session with all its messages
router.get('/sessions/:sessionId', chatCtrl.getSession);

export default router;


