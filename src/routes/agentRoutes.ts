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


// Define routes for agent operations
agentRouter.post('/agent', validate(CreateAgentSchema), asyncHandler(create));

// Get a single agent by ID
agentRouter.get('/agent/:agentId',  asyncHandler(get));
// update an agent by ID
agentRouter.patch('/agent/:agentId', validate(UpdateAgentSchema), asyncHandler(update));
agentRouter.delete('/agent/:agentId',  asyncHandler(remove));

export default agentRouter;
