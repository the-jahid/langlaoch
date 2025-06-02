// src/services/chat.service.ts
import { PrismaClient, Prisma, ChatMessage, ChatSession } from "@prisma/client";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";


// Initialize clients with error checking
const prisma = new PrismaClient();
const openai = new OpenAI();

// Enhanced Supabase client initialization with better error handling
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set' : 'Missing');
  throw new Error('Supabase configuration missing');
}

// Create Supabase client with custom fetch options
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
  global: {
    fetch: async (url, options = {}) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        console.error('Fetch error:', error);
        throw error;
      }
    },
  },
});

export interface CreateSessionInput {
  title?: string;
  systemPrompt?: string;
  model?: string;
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

// Test Supabase connection
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('documents')
      .select('count')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
}

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

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    });
    return res.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw new Error(`Failed to create embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function searchSupabaseEmbedding(query: string): Promise<SupabaseDocument[]> {
  try {
    // Validate query
    if (!query || query.trim().length === 0) {
      console.error('Empty query provided to searchSupabaseEmbedding');
      return [];
    }

    console.log('Searching for:', query);

    // Get embedding
    const embedding = await getEmbedding(query);
    
    // Validate embedding
    if (!embedding || embedding.length === 0) {
      console.error('Failed to generate embedding');
      return [];
    }

    console.log('Embedding generated, length:', embedding.length);

    // Call Supabase RPC with error handling
    try {
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_count: 3,
      });
      
      if (error) {
        console.error('Supabase RPC error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        
        // If the function doesn't exist, provide helpful error
        if (error.code === 'P0001' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          throw new Error('The match_documents function does not exist in Supabase. Please ensure it is created in your database.');
        }
        
        throw new Error(`Supabase error: ${error.message}`);
      }
      
      console.log('Supabase search successful, results:', data?.length || 0);
      return (data as SupabaseDocument[]) || [];
    } catch (rpcError) {
      console.error('RPC call failed:', rpcError);
      throw rpcError;
    }
  } catch (error) {
    console.error('Error in searchSupabaseEmbedding:', error);
    throw error;
  }
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${i + 1} failed:`, error);
      
      // Don't retry if it's a configuration error
      if (error instanceof Error && 
          (error.message.includes('does not exist') || 
           error.message.includes('Missing Supabase'))) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed after retries');
}

// Tool function implementations
async function executeToolCall(toolCall: OpenAI.Chat.ChatCompletionMessageToolCall): Promise<string> {
  const args = JSON.parse(toolCall.function.arguments);
  
  switch (toolCall.function.name) {
    case "search_knowledge_base":
      try {
        console.log('Executing search_knowledge_base with query:', args.query);
        
        // Use retry wrapper for resilience
        const docs = await withRetry(() => searchSupabaseEmbedding(args.query));
        
        console.log('Search completed, found documents:', docs.length);
        
        if (!docs || docs.length === 0) {
          return JSON.stringify({ 
            message: "No documents found matching your query.",
            results: []
          });
        }
        
        return JSON.stringify({
          message: `Found ${docs.length} relevant document(s).`,
          results: docs
        });
      } catch (error) {
        console.error('Error searching knowledge base:', error);
        
        // Provide detailed error information
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorDetails = error instanceof Error ? error.stack : '';
        
        // Check for specific error types
        let hint = '';
        if (errorMessage.includes('fetch failed')) {
          hint = 'Network connection issue. Check Supabase URL and internet connection.';
        } else if (errorMessage.includes('does not exist')) {
          hint = 'The match_documents function is missing. Please create it in your Supabase database.';
        } else if (errorMessage.includes('Missing Supabase')) {
          hint = 'Supabase environment variables are not configured.';
        }
        
        return JSON.stringify({ 
          error: 'Failed to search knowledge base',
          message: errorMessage,
          details: errorDetails,
          hint: hint,
          code: error instanceof Error && 'code' in error ? (error as any).code : ''
        });
      }
    
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
  }
}

export const addMessage = async ({ 
  sessionId, 
  content, 
  agentId 
}: { 
  sessionId: string; 
  content: string; 
  agentId: string; 
}): Promise<ChatMessage> => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { systemPrompt: true }
    });
    const systemPromptText = agent?.systemPrompt ?? "You are a helpful assistant.";

    const previousMessages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const chatHistory: ChatMessageItem[] = previousMessages.flatMap((msg) => {
      const result: ChatMessageItem[] = [];
      if (msg.userMessage) result.push({ role: "user", content: msg.userMessage });
      if (msg.assistantMessage) result.push({ role: "assistant", content: msg.assistantMessage });
      return result;
    });

    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "search_knowledge_base",
          description: "Searches for relevant documents from the Supabase knowledge base using vector similarity search. Use this when the user asks questions that might be answered by stored documents or knowledge.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to find relevant documents. This should be descriptive and capture the main topic or question the user is asking about."
              }
            },
            required: ["query"],
            additionalProperties: false
          },
          strict: true
        }
      }
    ];

    const messages: ChatMessageItem[] = [
      { role: "system", content: systemPromptText },
      ...chatHistory,
      { role: "user", content }
    ];

    // First API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools,
    });

    const choice = response.choices[0];
    if (!choice?.message) {
      throw new Error('No response from OpenAI');
    }

    const { tool_calls: toolCalls, content: assistantContent } = choice.message;

    // If no tool calls, return the assistant's response directly
    if (!toolCalls?.length) {
      return await createChatMessage(sessionId, content, assistantContent || null);
    }

    // Add assistant message with tool calls to conversation
    messages.push({
      role: "assistant",
      content: assistantContent,
      tool_calls: toolCalls
    });

    // Execute all tool calls
    for (const toolCall of toolCalls) {
      try {
        const result = await executeToolCall(toolCall);
        
        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: result
        });
      } catch (error) {
        console.error(`Error executing tool ${toolCall.function.name}:`, error);
        
        // Add error message as tool response
        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: JSON.stringify({ 
            error: `Failed to execute ${toolCall.function.name}`,
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        });
      }
    }

    // Second API call with tool results
    const followUpResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools,
    });

    const finalChoice = followUpResponse.choices[0];
    if (!finalChoice?.message) {
      throw new Error('No follow-up response from OpenAI');
    }

    const finalContent = finalChoice.message.content;

    // Check if there are more tool calls in the follow-up response
    if (finalChoice.message.tool_calls?.length) {
      console.warn('Additional tool calls detected in follow-up response, ignoring for now');
    }

    return await createChatMessage(sessionId, content, finalContent || null);

  } catch (error) {
    console.error('Error in addMessage:', error);
    throw error;
  }
};

export const getChatMessagesBySessionId = async (sessionId: string): Promise<ChatMessage[]> => {
  try {
    return await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    console.error('Error getting chat messages by session id:', error);
    throw error;
  }
};

// Initialize and test connection on module load
testSupabaseConnection().catch(console.error);