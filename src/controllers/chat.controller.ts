// controllers/chat.controller.ts
import { Request, Response, NextFunction } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { CreateSessionSchema, GetSessionSchema, SendMessageSchema } from '../validations/chat.validation';
import { addMessage, createSessions, ensureSessionExists, getChatMessagesBySessionId } from '../services/chat.service';

/* ---------- Zod schemas omitted for brevity (unchanged) ---------- */

export const jsonOk = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};

export const jsonError = (
  res: Response,
  message: string,
  status = 400,
  details?: unknown,
): void => {
  res.status(status).json({ success: false, error: { message, details } });
};


/** POST /sessions */
export const createSession = asyncHandler(async (req, res) => {
 const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    jsonError(res, "Validation failed", 400, parsed.error.format());
    return;
  }

  const session = await createSessions({...parsed.data});
  jsonOk(res, session, 201);
});

/** POST /sessions/:sessionId/messages */
export const sendUserMessage = asyncHandler(async (req, res) => {
  const parsed = SendMessageSchema.safeParse({ params: req.params, body: req.body });
  if (!parsed.success) {
    jsonError(res, 'Validation failed', 400, parsed.error.format());
    return;
  }

  const { sessionId, role, content } = {
    ...parsed.data.body,
    sessionId: parsed.data.params.sessionId,
  };

  const session = await ensureSessionExists(sessionId);
  if (!session) {
    jsonError(res, 'Chat session not found', 404);
    return;
  }

  const message = await addMessage({ sessionId,  content });
  jsonOk(res, message, 201);
});

/** GET /sessions/:sessionId */
export const getSession = asyncHandler(async (req, res) => {
  const parsed = GetSessionSchema.safeParse(req.params);
  if (!parsed.success) {
    jsonError(res, 'Validation failed', 400, parsed.error.format());
    return;
  }

  const session = await getChatMessagesBySessionId(parsed.data.sessionId);
  if (!session) {
    jsonError(res, 'Chat session not found', 404);
    return;
  }

  jsonOk(res, session);
});
