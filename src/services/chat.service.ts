// src/services/chat.service.ts
import { PrismaClient, Prisma, ChatMessage, ChatSession } from "@prisma/client";
import OpenAI from "openai";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const openai = new OpenAI(); // Assumes API key is set in env var
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export interface CreateSessionInput {
  title?: string;
  systemPrompt?: string;
  model?: string; // e.g. "gpt-4o"
  params?: Prisma.InputJsonValue;
}

// Define types for OpenAI messages
type MessageRole = "system" | "user" | "assistant" | "tool";

interface ChatMessageItem {
  role: MessageRole;
  content: string | null;
  tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
  tool_call_id?: string;
  name?: string;
}

// Define type for Supabase document
type SupabaseDocument = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

const createChatMessage = async (
  sessionId: string,
  userMessage: string | null,
  assistantMessage: string | null,
): Promise<ChatMessage> => {
  try {
    return await prisma.chatMessage.create({
      data: {
        sessionId,
        userMessage,
        assistantMessage,
      },
    });
  } catch (error) {
    console.error('Error creating chat message:', error);
    throw error;
  }
};

export const ensureSessionExists = async (sessionId: string): Promise<ChatSession | null> => {
  return await prisma.chatSession.findUnique({ where: { id: sessionId } });
};

export const createSessions = async ({
  title,
  systemPrompt,
  model = "gpt-3.5-turbo",
  params,
}: CreateSessionInput): Promise<ChatSession> =>
  prisma.chatSession.create({
    data: {
      ...(title ? { title } : {}),
      ...(systemPrompt ? { systemPrompt } : {}),
      model,
      ...(params !== undefined ? { params } : {}),
    },
  });

async function getEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return res.data[0].embedding;
}

async function searchSupabaseEmbedding(query: string): Promise<SupabaseDocument[]> {
  const embedding = await getEmbedding(query);
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: 3,
  });
  if (error) throw error;
  console.log('Supabase search result:', data);
  return data as SupabaseDocument[];
}

export const addMessage = async ({ sessionId, content }: { sessionId: string; content: string; }): Promise<ChatMessage> => {
  try {
    const sessionPrompt = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { systemPrompt: true },
    });

    const systemPromptText = sessionPrompt?.systemPrompt || "You are a helpful assistant.";

    const previousMessages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const chatHistory: ChatMessageItem[] = previousMessages.flatMap((msg) => {
      const result: ChatMessageItem[] = [];
      if (msg.userMessage) result.push({ role: "user" as const, content: msg.userMessage });
      if (msg.assistantMessage) result.push({ role: "assistant" as const, content: msg.assistantMessage });
      return result;
    });

    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "get_posts",
          description: "Fetches a list of posts from a sample placeholder API.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
          },
          strict: true
        }
      },
      {
        type: "function",
        function: {
          name: "search_knowledge_base",
          description: "Searches similar documents from Supabase using vector embedding.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Text to search in the vector database."
              }
            },
            required: ["query"],
            additionalProperties: false
          },
          strict: true
        }
      }
    ];

    async function getPosts(): Promise<string> {
      const { data } = await axios.get("https://jsonplaceholder.typicode.com/posts");
      return JSON.stringify((data as any[]).slice(0, 3));
    }       

    const messages: ChatMessageItem[] = [
      { role: "system", content: systemPromptText },
      ...chatHistory,
      { role: "user", content }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools,
    });

    const toolCalls = response.choices[0]?.message?.tool_calls;
    const assistantMessage = response.choices[0]?.message?.content;

    if (toolCalls?.length) {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCalls
      });

      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments);
        let result = "";

        if (toolCall.function.name === "get_posts") {
          result = await getPosts();
        }

        if (toolCall.function.name === "search_knowledge_base") {
          const docs = await searchSupabaseEmbedding(args.query);

          console.log('Supabase search result:', docs);
          result = JSON.stringify(docs);
        }

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: result
        });
      }

      const followUp = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        tools,
      });

      const finalContent = followUp.choices[0]?.message?.content;

      return await createChatMessage(sessionId, content, finalContent || null);
    }

    return await createChatMessage(sessionId, content, assistantMessage || null);
  } catch (error) {
    console.error('Error creating chat message:', error);
    throw error;
  }
};

export const getChatMessagesBySessionId = async (sessionId: string): Promise<ChatMessage[]> => {
  try {
    return await prisma.chatMessage.findMany({
      where: { sessionId },
    });
  } catch (error) {
    console.error('Error getting chat messages by session id:', error);
    throw error;
  }
};