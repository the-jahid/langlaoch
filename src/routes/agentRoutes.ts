// src/routes/agent.routes.ts
import { Router } from 'express';
import { validate } from '../middlewares/validate';
import {
  CreateAgentSchema,
  GetAgentSchema,
  UpdateAgentSchema,
  DeleteAgentSchema,
} from '../validations/agentValidation';
import { create, get, remove, update } from '../controllers/AgentController';
import { asyncHandler } from '../utils/asyncHandler';


const agentRouter = Router();

agentRouter.post('/agent', validate(CreateAgentSchema), asyncHandler(create));


agentRouter.get('/agent/:agentId',  asyncHandler(get));

agentRouter.patch('/agent/:agentId', validate(UpdateAgentSchema), asyncHandler(update));
agentRouter.delete('/agent/:agentId',  asyncHandler(remove));

export default agentRouter;
