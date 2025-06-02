import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ChatSessionService } from '../services/sessionService';


/* ------------------------------------------------------------------ *
 * POST /session
 * Body: { agentId, title, ... }
 * ------------------------------------------------------------------ */
export const create = async (req: Request, res: Response) => {

  const { agentId } = req.params;


  if (!agentId) {
    return res.status(400).json({ error: 'agentId  are required' });
  }

  const existingAgent = await prisma.agent.findUnique({
    where: { id: agentId }
  }
  )
  
  if (existingAgent?.id !== agentId) {   
    return res.status(404).json({ error: 'Agent not found' });
  }

  const session = await ChatSessionService.create(agentId);
  res.status(201).json(session);
};

export const remove = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const current = await ChatSessionService.getById(sessionId);
  if (!current) return res.status(404).json({ error: 'Session not found' });

  await ChatSessionService.delete(sessionId);
  res.status(200).json({ message: 'Session deleted successfully' });
};





