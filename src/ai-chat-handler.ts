/**
 * AI Chat Handler
 *
 * Handles the /ai-chat endpoint: receives user messages, calls OpenAI with
 * tool_choice: "required" to force documentation search, then returns the
 * AI-synthesized response.
 */

import { withTimeout, isResourceLimitError, createResourceLimitErrorMessage } from "./lib/utils";
import { OPENAI_TOOLS, executeTool, ensureContentLoaded, type Env } from "./tools";
import { resolveContainer, type ChatMessage, type ChatToolDef } from "./providers";

// Neutral tool definitions for the chat provider, derived from the OpenAI-shaped list
const CHAT_TOOLS: ChatToolDef[] = (OPENAI_TOOLS as any[]).map((tool) => ({
  name: tool.function.name,
  description: tool.function.description,
  parameters: tool.function.parameters,
}));

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function getSystemPrompt(orgName: string): string {
  return `You are a ${orgName} documentation assistant.

MANDATORY SEARCH REQUIREMENT:
You MUST call the search_documentation function for EVERY single user question - no exceptions.

CRITICAL WORKFLOW:
1. User asks question -> You MUST call search_documentation
2. Get search results -> Analyze the returned documentation
3. Provide answer based ONLY on search results
4. NEVER answer from your training data - ALWAYS search first

RESPONSE FORMAT:
- Provide COMPREHENSIVE and DETAILED answers based on ALL search results
- Include ALL relevant information from the documentation
- Include specific details, code examples, and implementation guidelines
- Cite source documents naturally in your response

If search returns no results, simply state that the information is not available in the documentation.`;
}

export async function handleAiChat(request: Request, env: Env): Promise<Response> {
  return withTimeout(handleAiChatInternal(request, env), 55000, "AI chat request").catch(
    (error) => {
      if (error.message.includes("timed out")) {
        return new Response(
          JSON.stringify({
            error:
              "Request timeout. Your request took longer than expected. Try breaking your question into smaller parts or try again later.",
          }),
          { status: 408, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }
  );
}

async function handleAiChatInternal(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { message } = (await request.json()) as { message: string };
    const model = env.OPENAI_MODEL || "gpt-4o";
    const orgName = env.ORGANIZATION_NAME || "Documentation";

    // Resolve the configured chat provider (CHAT_PROVIDER env var; openai default)
    let chat;
    try {
      chat = resolveContainer(env as any).chat;
    } catch {
      return new Response(
        JSON.stringify({ error: "Chat provider not configured (set OPENAI_API_KEY or CHAT_PROVIDER)." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const maxTokens = model.includes("gpt-5") ? 4000 : 8000;

    // Initial completion — force tool usage
    let result;
    try {
      result = await withTimeout(
        chat.chat({
          messages: [
            { role: "system", content: getSystemPrompt(orgName) },
            { role: "user", content: message },
          ],
          tools: CHAT_TOOLS,
          toolChoice: "required",
          maxTokens,
        }),
        35000,
        "Chat initial completion"
      );
    } catch (chatError: any) {
      throw new Error(`Chat provider failed: ${chatError.message || "Unknown error"}`);
    }

    // If no tool calls and no content, force a search
    if (!result.toolCalls?.length && !result.content) {
      throw new Error("The model returned an empty response. Please try rephrasing your question.");
    }

    // Handle tool calls
    if (result.toolCalls && result.toolCalls.length > 0) {
      // Strip any intermediate "thinking" content — only the final response matters
      const messages: ChatMessage[] = [
        { role: "system", content: getSystemPrompt(orgName) },
        { role: "user", content: message },
        { role: "assistant", content: null, toolCalls: result.toolCalls },
      ];

      // Execute each tool call
      for (const toolCall of result.toolCalls) {
        try {
          const toolResult = await withTimeout(
            executeTool(toolCall.name, JSON.parse(toolCall.arguments), env),
            10000,
            `Tool call: ${toolCall.name}`
          );
          messages.push({ role: "tool", toolCallId: toolCall.id, content: toolResult });
        } catch (error: any) {
          messages.push({
            role: "tool",
            toolCallId: toolCall.id,
            content: `Error: ${error.message}`,
          });
        }
      }

      // Get final response with tool results
      result = await withTimeout(
        chat.chat({ messages, maxTokens }),
        45000,
        "Chat final completion"
      );

      if (!result?.content) {
        throw new Error("The model returned an empty response after tool execution.");
      }
    }

    return new Response(JSON.stringify({ response: result.content }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("AI Chat Error:", error);

    if (isResourceLimitError(error)) {
      return new Response(JSON.stringify({ error: createResourceLimitErrorMessage() }), {
        status: 503,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let errorMessage = "An error occurred while processing your request";
    let statusCode = 500;

    if (error.message?.includes("401")) {
      errorMessage = "OpenAI API authentication failed.";
      statusCode = 401;
    } else if (error.message?.includes("429")) {
      errorMessage = "OpenAI API rate limit exceeded. Please try again later.";
      statusCode = 429;
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`;
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
