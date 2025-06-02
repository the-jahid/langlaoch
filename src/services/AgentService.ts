



import { prisma } from '../lib/prisma';
import { AgentStatus, ModelType, Prisma } from '@prisma/client';

export type CreateAgentInput = {
  name: string;
  systemPrompt: string;
  model?: ModelType;
  temperature?: number;
};

export type UpdateAgentInput = Partial<{
  name: string;
  systemPrompt: string;
  model: ModelType;
  temperature: number;
  status: AgentStatus;
}>;

export class AgentService {
  /* CREATE -------------------------------------------------------------- */
  static async create(data: CreateAgentInput) {
    return prisma.agent.create({
      data: {
        ...data,
        model: data.model ?? ModelType.GPT_3_5_TURBO,
        temperature: data.temperature ?? 0.7,
      },
    });
  }

  /* READ ---------------------------------------------------------------- */
  static async getById(agentId: string) {
    return prisma.agent.findUnique({ where: { id: agentId } });
  }

  /* UPDATE -------------------------------------------------------------- */
  static async update(agentId: string, data: UpdateAgentInput) {
    return prisma.agent.update({
      where: { id: agentId },
      data,
    });
  }

  /* DELETE -------------------------------------------------------------- */
  static async delete(agentId: string) {
    return prisma.agent.delete({ where: { id: agentId } });
  }

  /* (Optional) LIST ----------------------------------------------------- */
  static async list(params?: Prisma.AgentFindManyArgs) {
    return prisma.agent.findMany(params);
  }
}

























