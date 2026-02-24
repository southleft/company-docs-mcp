/**
 * AI Chat Handler
 *
 * Handles the /ai-chat endpoint: receives user messages, calls OpenAI with
 * tool_choice: "required" to force documentation search, then returns the
 * AI-synthesized response.
 */

import { OpenAI } from "openai";
import { withTimeout, isResourceLimitError, createResourceLimitErrorMessage } from "./lib/utils";
import { OPENAI_TOOLS, executeTool, ensureContentLoaded, type Env } from "./tools";

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
    const apiKey = env.OPENAI_API_KEY;
    const model = env.OPENAI_MODEL || "gpt-4o";
    const orgName = env.ORGANIZATION_NAME || "Documentation";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const openai = new OpenAI({ apiKey, timeout: 45000, maxRetries: 1 });

    // Initial completion — force tool usage
    const completionParams: any = {
      model,
      messages: [
        { role: "system", content: getSystemPrompt(orgName) },
        { role: "user", content: message },
      ],
      tools: OPENAI_TOOLS,
      tool_choice: "required",
      parallel_tool_calls: false,
      stream: false,
    };

    if (model.includes("gpt-5")) {
      completionParams.max_completion_tokens = 4000;
    } else {
      completionParams.max_tokens = 8000;
    }

    let completion;
    try {
      completion = await withTimeout(
        openai.chat.completions.create(completionParams),
        35000,
        "OpenAI initial completion"
      );
    } catch (openaiError: any) {
      throw new Error(`OpenAI API failed: ${openaiError.message || "Unknown error"}`);
    }

    let response = completion.choices[0].message;

    // If no tool calls and no content, force a search
    if (!response.tool_calls?.length && !response.content) {
      throw new Error("OpenAI returned an empty response. Please try rephrasing your question.");
    }

    // Handle tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Strip any intermediate "thinking" content — only the final response matters
      const assistantMsg = { ...response, content: null } as any;
      const messages: any[] = [
        { role: "system", content: getSystemPrompt(orgName) },
        { role: "user", content: message },
        assistantMsg,
      ];

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        try {
          const toolResult = await withTimeout(
            executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), env),
            10000,
            `Tool call: ${toolCall.function.name}`
          );
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
        } catch (error: any) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Error: ${error.message}`,
          });
        }
      }

      // Get final response with tool results
      const finalParams: any = { model, messages, stream: false };
      if (model.includes("gpt-5")) {
        finalParams.max_completion_tokens = 4000;
      } else {
        finalParams.max_tokens = 8000;
      }

      const finalCompletion = await withTimeout(
        openai.chat.completions.create(finalParams),
        45000,
        "OpenAI final completion"
      );

      response = finalCompletion.choices[0].message;

      if (!response?.content) {
        throw new Error("OpenAI returned an empty response after tool execution.");
      }
    }

    return new Response(JSON.stringify({ response: response.content }), {
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
