import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { ChatMessageIdParamSchema, CreateChatMessageSchema, UpdateChatMessageSchema } from '../validations/chatValidation';
import { asyncHandler } from '../utils/asyncHandler';

import { createChat, getChatMessagesBySessionIdcontroller } from '../controllers/chatController';


const chatRouter = Router();

// Create a new chat message
chatRouter.post(
  '/:sessionId',
  validate(CreateChatMessageSchema),
  asyncHandler(createChat)
);


// Get a all chat history by session ID
chatRouter.get(
  '/:sessionId',
  validate(ChatMessageIdParamSchema, 'params'),
  asyncHandler(getChatMessagesBySessionIdcontroller)
);

// Update a chat message by ID
chatRouter.patch(
  '/chat/:chatId',
  validate(UpdateChatMessageSchema),
  
);

// Delete a chat message by ID
chatRouter.delete(
  '/chat/:chatId',
  validate(ChatMessageIdParamSchema, 'params'),

);

export default chatRouter;
