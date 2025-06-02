import { z } from 'zod';
import { ChatRole } from '@prisma/client';

/**
 * POST /chat → Create a chat message
 */
export const CreateChatMessageSchema = z.object({
 
  content: z.string().min(1, 'Message content cannot be empty'),
});

/**
 * GET /chat/:chatId
 * DELETE /chat/:chatId
 */
export const ChatMessageIdParamSchema = z.object({
  chatId: z.string().uuid('chatId must be a valid UUID'),
});

/**
 * PATCH /chat/:chatId → Update a chat message
 */
export const UpdateChatMessageSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('chatId must be a valid UUID'),
  }),
  body: z.object({
    role: z.nativeEnum(ChatRole).optional(),
    content: z.string().min(1).optional(),
    functionName: z.string().optional(),
    functionArgs: z.record(z.any()).optional(),
    functionResponse: z.any().optional(),
    tokens: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});
