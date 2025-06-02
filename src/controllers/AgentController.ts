// src/controllers/agent.controller.ts
import { Request, Response } from 'express';
import { AgentService } from '../services/AgentService';


export const create = async (req: Request, res: Response) => {
  const agent = await AgentService.create(req.body);
  res.status(201).json(agent);
};

export const get = async (req: Request, res: Response) => {
  const agent = await AgentService.getById(req.params.agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
};

export const update = async (req: Request, res: Response) => {

    const { agentId } = req.params;

    const agent = await AgentService.getById(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

  const updated = await AgentService.update(req.params.agentId, req.body);
  res.json(updated);
};

export const remove = async (req: Request, res: Response) => {

 const { agentId } = req.params;

    const agent = await AgentService.getById(agentId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
  await AgentService.delete(req.params.agentId);
  res.status(204).send();
};

