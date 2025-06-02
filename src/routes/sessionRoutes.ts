// src/routes/chatSession.routes.ts
import { Router } from 'express';
import { validate } from '../middlewares/validate';
import {
  
  SessionIdParamSchema,
} from '../validations/sessionValidation';
import { create,  remove, } from '../controllers/sessionControllers';
import { asyncHandler } from '../utils/asyncHandler';

const chatSessionRouter = Router();

// Create a new chat session
chatSessionRouter.post(
  '/session/:agentId',
  asyncHandler(create)
  
);

// Delete a chat session by ID
chatSessionRouter.delete(
  '/session/:sessionId',
  validate(SessionIdParamSchema, 'params'),
  asyncHandler(remove)
);

export default chatSessionRouter;

