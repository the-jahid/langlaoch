import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export type CreateChatSessionInput = {
  agentId?: string;          // optional → system messages only
  
};

export type UpdateChatSessionInput = Partial<{
  title: string;
  status: 'open' | 'closed' | 'archived';
  systemPrompt: string | null;
  model: string;
  params: Prisma.InputJsonValue | null;
  context: Prisma.InputJsonValue | null;
}>;

export class ChatSessionService {
  /* CREATE -------------------------------------------------------------- */
  static async create(agentId: string) {
    return prisma.chatSession.create({
      data: {
        agentId: agentId,
      },
      include: { messages: true }, // return empty messages array
    });
  }

  /* READ ---------------------------------------------------------------- */
  static async getById(sessionId: string) {
    return prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: true, agent: true },
    });
  }

  /* UPDATE -------------------------------------------------------------- */
  static async update(sessionId: string, data: UpdateChatSessionInput) {
    // Remove undefined properties to satisfy Prisma's strict typing
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    return prisma.chatSession.update({
      where: { id: sessionId },
      data: filteredData,
    });
  }

  /* DELETE -------------------------------------------------------------- */
  static async delete(sessionId: string) {
    return prisma.chatSession.delete({ where: { id: sessionId } });
  }

  /* (Optional) LIST ----------------------------------------------------- */
  static async list(params?: Prisma.ChatSessionFindManyArgs) {
    return prisma.chatSession.findMany(params);
  }
}















