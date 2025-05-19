// src/validators/chat.validator.ts
import { z } from 'zod';
import { ChatRole } from '@prisma/client';

/* ------------------------------------------------------------------ *
 *  Create a new chat-session  (POST /sessions)
 * ------------------------------------------------------------------ */
export const CreateSessionSchema = z.object({
  title:        z.string().min(1).max(255),
  systemPrompt: z.string().max(10_000),
  model:        z.string(),           // e.g. "gpt-4o"
  params:       z.record(z.any()).optional(),    // arbitrary JSON
});

/* ------------------------------------------------------------------ *
 *  Send a message in a session  (POST /sessions/:sessionId/messages)
 * ------------------------------------------------------------------ */
export const SendMessageSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('sessionId must be a valid UUID'),
  }),
  body: z.object({
    role:     z.nativeEnum(ChatRole).default(ChatRole.USER).optional(),
    content:  z.string().min(1, 'Message content cannot be empty'),
    
  }),
});

/* ------------------------------------------------------------------ *
 *  Get a session with messages  (GET /sessions/:sessionId)
 * ------------------------------------------------------------------ */
export const GetSessionSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});
