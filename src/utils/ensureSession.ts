import { ChatSession } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const ensureSessionExists = async (sessionId: string): Promise<ChatSession | null> => {
  return await prisma.chatSession.findUnique({ where: { id: sessionId } });
};