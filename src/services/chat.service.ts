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

// Define type for Product
interface Product {
  name: string;
  productId: string;
  description: string;
}

// Response type for addMessage that includes products
interface ChatMessageResponse {
  id: string;
  sessionId: string;
  userMessage: string | null;
  assistantMessage: string | null;
  products?: Product[];
  createdAt: Date;
  updatedAt: Date;
}

// Test Supabase connection
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('documents')
      .select('count')
      .limit(1)
      .single()
    
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
      model: "text-embedding-3-small",
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
        match_count: 5, // Increased to get more results
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

// Enhanced helper function to extract products from documents
function extractProductsFromDocuments(docs: SupabaseDocument[]): Product[] {
  const products: Product[] = [];
  
  console.log(`\n========== EXTRACTING PRODUCTS FROM ${docs.length} DOCUMENTS ==========`);
  
  for (let docIndex = 0; docIndex < docs.length; docIndex++) {
    const doc = docs[docIndex];
    
    try {
      console.log(`\n---------- DOCUMENT ${docIndex + 1} ----------`);
      console.log('Document ID:', doc.id);
      console.log('Full Content:\n', doc.content);
      console.log('\nMetadata:', JSON.stringify(doc.metadata, null, 2));
      console.log('----------------------------------------\n');
      
      const content = doc.content;
      let extractedProducts: Product[] = [];
      
      // Check if metadata has complete product info
      if (doc.metadata && (doc.metadata.productId || doc.metadata.product_id || doc.metadata.id)) {
        const productId = String(doc.metadata.productId || doc.metadata.product_id || doc.metadata.id);
        const name = String(doc.metadata.name || doc.metadata.product_name || doc.metadata.title || '');
        const description = String(doc.metadata.description || doc.metadata.details || '');
        
        if (productId && (name || description)) {
          extractedProducts.push({
            productId,
            name: name || `Product ${productId}`,
            description: description || 'No description available'
          });
          console.log('Extracted from metadata:', extractedProducts[0]);
        }
      }
      
      // Extract from content if not found in metadata or metadata incomplete
      if (extractedProducts.length === 0 || 
          (extractedProducts[0] && extractedProducts[0].name === `Product ${extractedProducts[0].productId}`)) {
        
        // Find all product IDs in the content
        const productIdMatches = Array.from(content.matchAll(/Product ID[:\s]*(\d+)/gi));
        
        for (const match of productIdMatches) {
          const productId = match[1];
          const startIndex = match.index || 0;
          
          // Find the section for this product
          // Look backwards from Product ID to find the name
          const beforeContent = content.substring(0, startIndex);
          const beforeLines = beforeContent.split('\n').filter(l => l.trim());
          
          let name = '';
          let description = '';
          
          // The name is often the last non-empty line before "Product ID"
          if (beforeLines.length > 0) {
            const lastLine = beforeLines[beforeLines.length - 1];
            // Clean up common patterns
            name = lastLine
              .replace(/^\d+\.\s*/, '') // Remove numbering
              .replace(/\*\*/g, '')      // Remove bold markers
              .replace(/^[-•]\s*/, '')   // Remove bullet points
              .trim();
            
            // Validate it's a reasonable name
            if (name.length > 100 || name.includes(':') || name.toLowerCase().includes('description')) {
              name = '';
            }
          }
          
          // Find description after Product ID
          const afterContent = content.substring(startIndex + match[0].length);
          
          // Look for explicit Description: label
          const descMatch = afterContent.match(/Description[:\s]*([\s\S]*?)(?=\n\n|\n\s*[-•]|\nProduct ID|$)/i);
          if (descMatch) {
            description = descMatch[1].trim();
          } else {
            // Take the next paragraph after Product ID
            const nextParagraph = afterContent.match(/^\s*[-•]?\s*(.+?)(?=\n\n|\n\s*[-•]|$)/);
            if (nextParagraph) {
              description = nextParagraph[1].trim();
            }
          }
          
          // Clean up description
          if (description) {
            description = description
              .replace(/\s*\n\s*/g, ' ')  // Replace newlines with spaces
              .replace(/\s+/g, ' ')        // Normalize spaces
              .substring(0, 300)           // Limit length
              .trim();
          }
          
          // Check if we already have this product from metadata
          const existingProduct = extractedProducts.find(p => p.productId === productId);
          if (existingProduct) {
            // Update with better name/description if found
            if (name && existingProduct.name === `Product ${productId}`) {
              existingProduct.name = name;
            }
            if (description && existingProduct.description === 'No description available') {
              existingProduct.description = description;
            }
          } else {
            extractedProducts.push({
              productId,
              name: name || `Product ${productId}`,
              description: description || 'No description available'
            });
          }
        }
      }
      
      // If still no products, try to extract from structured content
      if (extractedProducts.length === 0) {
        // Look for patterns like "1. Product Name" or "## Product Name"
        const structuredMatches = Array.from(content.matchAll(/(?:^|\n)(?:\d+\.\s*|#+\s*)([^\n]+)[\s\S]*?(?:Product ID|ID)[:\s]*(\d+)/gmi));
        
        for (const match of structuredMatches) {
          const name = match[1].replace(/\*\*/g, '').trim();
          const productId = match[2];
          
          // Find description in the same block
          const blockStart = match.index || 0;
          const blockEnd = content.indexOf('\n\n', blockStart + match[0].length);
          const block = content.substring(blockStart, blockEnd > 0 ? blockEnd : undefined);
          
          const descMatch = block.match(/Description[:\s]*([\s\S]+?)(?=\n\n|$)/i);
          const description = descMatch ? descMatch[1].trim() : block.substring(0, 200);
          
          extractedProducts.push({
            productId,
            name: name || `Product ${productId}`,
            description: description || 'No description available'
          });
        }
      }
      
      // Add all extracted products
      products.push(...extractedProducts);
      console.log(`Extracted ${extractedProducts.length} products from document ${docIndex + 1}:`, extractedProducts);
      
    } catch (error) {
      console.error(`Error extracting from document ${docIndex + 1}:`, error);
    }
  }
  
  // Remove duplicates based on productId
  const uniqueProducts = products.filter((product, index, self) =>
    index === self.findIndex((p) => p.productId === product.productId)
  );
  
  console.log(`\n========== EXTRACTION COMPLETE ==========`);
  console.log(`Total unique products: ${uniqueProducts.length}`);
  console.log('Products:', JSON.stringify(uniqueProducts, null, 2));
  console.log(`=========================================\n`);
  
  return uniqueProducts;
}

// Helper function to extract products from assistant message as fallback
function extractProductsFromAssistantMessage(message: string): Product[] {
  const products: Product[] = [];
  
  try {
    console.log('Extracting products from assistant message...');
    
    // Split by numbered items (1., 2., etc.)
    const sections = message.split(/(?=\d+\.\s*\*\*)/);
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      // Extract product name from bold text
      const nameMatch = section.match(/\d+\.\s*\*\*([^*]+)\*\*/);
      const name = nameMatch ? nameMatch[1].trim() : '';
      
      // Extract product ID
      const idMatch = section.match(/Product ID\*?\*?:\s*(\d+)/i);
      if (!idMatch) continue;
      const productId = idMatch[1];
      
      // Extract description
      let description = '';
      const descMatch = section.match(/Description\*?\*?:\s*([^-\n]+(?:\n(?!.*:)[^-\n]+)*)/i);
      if (descMatch) {
        description = descMatch[1].trim();
      }
      
      // Extract additional details if present
      const detailsMatch = section.match(/Details\*?\*?:\s*([\s\S]*?)(?=\n\s*-\s*\*\*[A-Z]|$)/i);
      if (detailsMatch && !description) {
        description = detailsMatch[1].trim();
      }
      
      // Clean up description
      description = description
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (productId) {
        products.push({
          productId,
          name: name || `Product ${productId}`,
          description: description || 'No description available'
        });
        
        console.log(`Extracted from assistant message: ${name} (${productId})`);
      }
    }
    
  } catch (error) {
    console.error('Error extracting products from assistant message:', error);
  }
  
  return products;
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
async function executeToolCall(toolCall: OpenAI.Chat.ChatCompletionMessageToolCall): Promise<{ result: string; products: Product[] }> {
  const args = JSON.parse(toolCall.function.arguments);
  let products: Product[] = [];
  
  switch (toolCall.function.name) {
    case "search_knowledge_base":
      try {
        console.log('Executing search_knowledge_base with query:', args.query);
        
        // Use retry wrapper for resilience
        const docs = await withRetry(() => searchSupabaseEmbedding(args.query));
        
        console.log('Search completed, found documents:', docs.length);
        
        if (!docs || docs.length === 0) {
          return {
            result: JSON.stringify({ 
              message: "No documents found matching your query.",
              results: [],
              products: []
            }),
            products: []
          };
        }
        
        // Log document content for debugging
        docs.forEach((doc, index) => {
          console.log(`\n--- Document ${index + 1} ---`);
          console.log('Content preview:', doc.content.substring(0, 300));
          console.log('Metadata:', JSON.stringify(doc.metadata, null, 2));
        });
        
        // Extract products from documents
        products = extractProductsFromDocuments(docs);
        console.log('\nTotal products extracted:', products);
        
        return {
          result: JSON.stringify({
            message: `Found ${docs.length} relevant document(s) containing ${products.length} product(s).`,
            results: docs,
            products: products
          }),
          products: products
        };
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
        
        return {
          result: JSON.stringify({ 
            error: 'Failed to search knowledge base',
            message: errorMessage,
            details: errorDetails,
            hint: hint,
            code: error instanceof Error && 'code' in error ? (error as any).code : '',
            products: []
          }),
          products: []
        };
      }
    
    default:
      return {
        result: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
        products: []
      };
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
}): Promise<ChatMessageResponse> => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { systemPrompt: true }
    });
    
    // Enhanced system prompt to handle product extraction
    const systemPromptText = agent?.systemPrompt ?? "You are a helpful assistant.";
    const enhancedSystemPrompt = `${systemPromptText}

IMPORTANT: When users ask about products or information in the knowledge base:
1. You MUST use the search_knowledge_base tool
2. Present ALL products found with their Product IDs clearly
3. Structure your response to list each product with:
   - Product ID
   - Product Name
   - Description
   - Any other relevant details

The search tool will return products in a structured format. Make sure to present all of them to the user.`;

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
      { role: "system", content: enhancedSystemPrompt },
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

    // Track all products found
    let allProducts: Product[] = [];

    // If no tool calls, check if we should have used the tool
    if (!toolCalls?.length) {
      // Check if the query is about knowledge base or products
      const shouldUseSearch = /knowledge\s*base|product|information|what\s+do\s+you\s+have|inventory|catalog/i.test(content);
      
      if (shouldUseSearch) {
        console.log('Query seems to be about knowledge base but no tool was called. Forcing search...');
        
        // Force a search
        const searchResult = await executeToolCall({
          id: 'forced-search',
          type: 'function',
          function: {
            name: 'search_knowledge_base',
            arguments: JSON.stringify({ query: content })
          }
        });
        
        allProducts = searchResult.products;
        
        // Create a new completion with the search results
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [{
            id: 'forced-search',
            type: 'function',
            function: {
              name: 'search_knowledge_base',
              arguments: JSON.stringify({ query: content })
            }
          }]
        });
        
        messages.push({
          tool_call_id: 'forced-search',
          role: "tool",
          name: 'search_knowledge_base',
          content: searchResult.result
        });
        
        // Get new response with search results
        const retryResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          tools,
        });
        
        const retryChoice = retryResponse.choices[0];
        if (retryChoice?.message?.content) {
          const createdMessage = await createChatMessage(sessionId, content, retryChoice.message.content);
          
          return {
            id: createdMessage.id,
            sessionId: createdMessage.sessionId,
            userMessage: createdMessage.userMessage,
            assistantMessage: createdMessage.assistantMessage,
            products: allProducts,
            createdAt: createdMessage.createdAt,
            updatedAt: createdMessage.updatedAt
          };
        }
      }
      
      // Normal response without tools
      const createdMessage = await createChatMessage(sessionId, content, assistantContent || null);
      return {
        id: createdMessage.id,
        sessionId: createdMessage.sessionId,
        userMessage: createdMessage.userMessage,
        assistantMessage: createdMessage.assistantMessage,
        products: [],
        createdAt: createdMessage.createdAt,
        updatedAt: createdMessage.updatedAt
      };
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
        const { result, products } = await executeToolCall(toolCall);
        
        // Accumulate all products
        if (products.length > 0) {
          allProducts.push(...products);
          console.log(`Tool call ${toolCall.id} found ${products.length} products`);
        }
        
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

    // Remove duplicates from all products
    let uniqueProducts = allProducts.filter((product, index, self) =>
      index === self.findIndex((p) => p.productId === product.productId)
    );

    console.log(`Total unique products found: ${uniqueProducts.length}`);

    // Second API call with tool results
    const followUpMessages = [...messages];
    
    // Add a system message to ensure product information is included
    if (uniqueProducts.length > 0) {
      const productList = uniqueProducts.map(p => 
        `- Product ID: ${p.productId}, Name: ${p.name}`
      ).join('\n');
      
      followUpMessages.push({
        role: "system",
        content: `The search found ${uniqueProducts.length} products. Make sure to mention all of them in your response:\n${productList}`
      });
    }

    const followUpResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: followUpMessages as OpenAI.Chat.ChatCompletionMessageParam[],
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

    // If no products were found from tools but the assistant message contains product info, try to extract
    if (uniqueProducts.length === 0 && finalContent && finalContent.includes('Product ID')) {
      console.log('No products found from tools, attempting to extract from assistant message');
      const extractedProducts = extractProductsFromAssistantMessage(finalContent);
      if (extractedProducts.length > 0) {
        uniqueProducts.push(...extractedProducts);
      }
    }
    
  
    if (uniqueProducts.length > 0 && finalContent) {
      console.log('Enriching products with names and descriptions from assistant message...');
      const assistantProducts = extractProductsFromAssistantMessage(finalContent);
      
      
      uniqueProducts = uniqueProducts.map(product => {
     
        const assistantProduct = assistantProducts.find(ap => ap.productId === product.productId);
        
        if (assistantProduct) {
          
          return {
            productId: product.productId,
            name: (product.name === `Product ${product.productId}` && assistantProduct.name !== `Product ${product.productId}`) 
              ? assistantProduct.name 
              : product.name,
            description: (product.description === 'No description available' && assistantProduct.description !== 'No description available')
              ? assistantProduct.description
              : product.description
          };
        }
        
        return product;
      });
      
      console.log('Enriched products:', JSON.stringify(uniqueProducts, null, 2));
    }

    
    const createdMessage = await createChatMessage(
      sessionId, 
      content, 
      finalContent || null
    );

    console.log(`Final response created with ${uniqueProducts.length} products`);

    // Return the message with products array included
    return {
      id: createdMessage.id,
      sessionId: createdMessage.sessionId,
      userMessage: createdMessage.userMessage,
      assistantMessage: createdMessage.assistantMessage,
      products: uniqueProducts,
      createdAt: createdMessage.createdAt,
      updatedAt: createdMessage.updatedAt
    };

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


testSupabaseConnection().catch(console.error);
