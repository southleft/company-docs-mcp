/**
 * MCP Streamable HTTP Transport Handler
 *
 * Implements MCP Streamable HTTP transport (2025-03-26 spec) for Cloudflare Workers.
 * This replaces the deprecated SSE transport with a modern, stateless approach.
 *
 * Key Features:
 * - Single /mcp endpoint (no separate /sse endpoints)
 * - Stateless session management (no Durable Objects needed)
 * - Optional SSE upgrade for streaming responses
 * - Proper MCP protocol compliance
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  searchWithSupabase as searchEntries,
} from "./lib/search-handler.js";
import {
  loadEntries,
  getEntriesByCategory,
  getAllTags,
  SAMPLE_ENTRIES,
} from "./lib/content-manager.js";

// Type definitions
interface Env {
  OPENAI_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VECTOR_SEARCH_ENABLED?: string;
  VECTOR_SEARCH_MODE?: string;
  LOG_SEARCH_PERFORMANCE?: string;
  OPENAI_MODEL?: string;
  AI_SYSTEM_PROMPT?: string;
  ORGANIZATION_NAME?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// Content loading state
let contentLoaded = false;

async function ensureContentLoaded() {
  if (!contentLoaded) {
    try {
      loadEntries(SAMPLE_ENTRIES);
      console.log('✅ Loaded sample entries for fallback compatibility');
      contentLoaded = true;
    } catch (error) {
      console.error('❌ Failed to load sample entries:', error);
    }
  }
}

/**
 * Creates and configures the MCP server with all available tools
 */
function createMcpServer(env: Env): McpServer {
  const orgName = env.ORGANIZATION_NAME || "Company";

  const server = new McpServer({
    name: `${orgName} Documentation Assistant`,
    version: "2.0.0", // v2 = Streamable HTTP
  });

  /**
   * Tool: search_design_knowledge
   * Search through the complete knowledge base
   */
  server.tool(
    "search_design_knowledge",
    {
      query: z.string().describe("Search query for finding relevant documentation"),
      category: z.enum([
        "components", "tokens", "patterns", "guidelines", "tools", "general"
      ]).optional().describe("Filter by category"),
      tags: z.array(z.string()).optional().describe("Filter by specific tags"),
      limit: z.number().default(15).describe("Maximum number of results to return (default: 15)"),
    },
    async ({ query, category, tags, limit }) => {
      await ensureContentLoaded();

      const searchResults = await searchEntries({
        query,
        category,
        tags,
        limit: limit || 15,
      }, env);

      if (searchResults.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No documentation found matching your search criteria.",
          }],
        };
      }

      const formattedResults = searchResults.map((entry, index) =>
        `**🔍 ${index + 1}. ${entry.title}**

📂 Category: ${entry.metadata.category}
🔖 Tags: ${entry.metadata.tags.join(", ")}
⭐ Confidence: ${entry.metadata.confidence}
🔗 Source: [${entry.source?.location || entry.metadata?.source_url || "N/A"}](${entry.source?.location || entry.metadata?.source_url || "#"})

${entry.content.slice(0, 1000)}${entry.content.length > 1000 ? "..." : ""}

---`
      ).join("\n\n");

      return {
        content: [{
          type: "text" as const,
          text: `Found ${searchResults.length} documentation entries:\n\n${formattedResults}`,
        }],
      };
    }
  );

  /**
   * Tool: search_chunks
   * Search through specific content chunks for detailed information
   */
  server.tool(
    "search_chunks",
    {
      query: z.string().describe("Search query for finding specific content chunks"),
      limit: z.number().default(8).describe("Maximum number of chunks to return (default: 8)"),
    },
    async ({ query, limit }) => {
      await ensureContentLoaded();

      const searchResults = await searchEntries({
        query,
        limit: limit || 8,
      }, env);

      if (searchResults.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No content chunks found matching your search query.",
          }],
        };
      }

      const formattedResults = searchResults.map((entry, index) =>
        `**📄 Chunk ${index + 1}: ${entry.title}**

${entry.content}

🔗 Source: [${entry.source?.location || entry.metadata?.source_url || "N/A"}](${entry.source?.location || entry.metadata?.source_url || "#"})

---`
      ).join("\n\n");

      return {
        content: [{
          type: "text" as const,
          text: `Found ${searchResults.length} content chunks:\n\n${formattedResults}`,
        }],
      };
    }
  );

  /**
   * Tool: browse_by_category
   * Browse all entries in a specific category
   */
  server.tool(
    "browse_by_category",
    {
      category: z.enum([
        "components", "tokens", "patterns", "guidelines", "tools", "general"
      ]).describe("Category to browse"),
    },
    async ({ category }) => {
      await ensureContentLoaded();

      const entries = getEntriesByCategory(category as any);

      if (entries.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No entries found in category: ${category}`,
          }],
        };
      }

      const formattedEntries = entries.map((entry, index) =>
        `${index + 1}. **${entry.title}**
   Tags: ${entry.metadata.tags.join(", ")}
   Source: [${entry.source?.location || entry.metadata?.source_url || "Link"}](${entry.source?.location || entry.metadata?.source_url || "#"})`
      ).join("\n");

      return {
        content: [{
          type: "text" as const,
          text: `**Category: ${category}** (${entries.length} entries)\n\n${formattedEntries}`,
        }],
      };
    }
  );

  /**
   * Tool: get_all_tags
   * Get a list of all available tags in the knowledge base
   */
  server.tool(
    "get_all_tags",
    {},
    async () => {
      await ensureContentLoaded();

      const tags = getAllTags();
      const sortedTags = tags.sort();

      return {
        content: [{
          type: "text" as const,
          text: `**Available Tags** (${tags.length} total):\n\n${sortedTags.map(tag => `• ${tag}`).join("\n")}`,
        }],
      };
    }
  );

  return server;
}

/**
 * Main Streamable HTTP request handler
 *
 * Handles MCP protocol requests according to the Streamable HTTP specification:
 * - POST: Process JSON-RPC messages (tools/list, tools/call, etc.)
 * - GET: Optional server-initiated message stream (not implemented yet)
 * - DELETE: Session cleanup (stateless, so just returns success)
 *
 * Sessions are optional and stateless - no Durable Objects needed!
 */
export async function handleStreamableHttp(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Accept, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Create MCP server instance
  const server = createMcpServer(env);

  try {
    // Handle POST requests (main MCP communication)
    if (request.method === "POST") {
      const sessionId = request.headers.get("Mcp-Session-Id");
      const accept = request.headers.get("Accept") || "";
      const wantsStream = accept.includes("text/event-stream");

      // Parse JSON-RPC message(s)
      const body = await request.json() as any;
      const messages = Array.isArray(body) ? body : [body];

      console.log(`[MCP] Processing ${messages.length} message(s), session=${sessionId || "none"}, stream=${wantsStream}`);

      // Process each message
      const results = [];
      for (const message of messages) {
        console.log(`[MCP] Method: ${message.method}, ID: ${message.id}`);

        // Handle different MCP methods
        if (message.method === "initialize") {
          const origin = new URL(request.url).origin;
          const orgName = env.ORGANIZATION_NAME || "Company";

          const result = {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              protocolVersion: "2025-03-26", // Latest Streamable HTTP spec
              serverInfo: {
                name: `${orgName} Documentation Assistant`,
                version: "2.0.0",
                // Icon URLs for Claude Desktop (experimental)
                icon: `${origin}/icon.png`,
                iconUrl: `${origin}/icon.png`,
              },
              capabilities: {
                tools: {}, // Server provides tools
              },
              // Additional icon metadata (experimental)
              icon: `${origin}/icon.png`,
              iconUrl: `${origin}/icon.png`,
              favicon: `${origin}/favicon.ico`,
            },
          };

          // Generate session ID for new sessions
          if (!sessionId) {
            const newSessionId = crypto.randomUUID();
            console.log(`[MCP] Generated new session ID: ${newSessionId}`);

            results.push(result);

            // Return with session ID header
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Mcp-Session-Id": newSessionId,
              },
            });
          }

          results.push(result);
        }
        else if (message.method === "notifications/initialized") {
          // No response needed for notifications
          console.log("[MCP] Client initialized notification received");
          continue;
        }
        else if (message.method === "ping") {
          results.push({
            jsonrpc: "2.0",
            id: message.id,
            result: {},
          });
        }
        else if (message.method === "tools/list") {
          // Return list of available tools
          const tools = [
            {
              name: "search_design_knowledge",
              description: "Search through the documentation knowledge base by query, category, or tags",
              inputSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Search query for finding relevant documentation"
                  },
                  category: {
                    type: "string",
                    description: "Filter by category",
                    enum: ["components", "tokens", "patterns", "guidelines", "tools", "general"]
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Filter by specific tags"
                  },
                  limit: {
                    type: "number",
                    description: "Maximum number of results to return (default: 15)",
                    default: 15
                  }
                },
                required: ["query"]
              }
            },
            {
              name: "search_chunks",
              description: "Search through specific content chunks for detailed information",
              inputSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Search query for finding specific content chunks"
                  },
                  limit: {
                    type: "number",
                    description: "Maximum number of chunks to return (default: 8)",
                    default: 8
                  }
                },
                required: ["query"]
              }
            },
            {
              name: "browse_by_category",
              description: "Browse all entries in a specific category",
              inputSchema: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    description: "Category to browse",
                    enum: ["components", "tokens", "patterns", "guidelines", "tools", "general"]
                  }
                },
                required: ["category"]
              }
            },
            {
              name: "get_all_tags",
              description: "Get a list of all available tags in the knowledge base",
              inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false
              }
            }
          ];

          results.push({
            jsonrpc: "2.0",
            id: message.id,
            result: { tools },
          });
        }
        else if (message.method === "tools/call") {
          // Call the tool using manual dispatch
          try {
            const toolName = message.params?.name;
            const args = message.params?.arguments || {};

            console.log(`[MCP] Calling tool: ${toolName}`);

            // Manually execute tool logic based on tool name
            let toolResult;

            if (toolName === "search_design_knowledge") {
              await ensureContentLoaded();
              const searchResults = await searchEntries({
                query: args.query,
                category: args.category,
                tags: args.tags,
                limit: args.limit || 15,
              }, env);

              if (searchResults.length === 0) {
                toolResult = {
                  content: [{
                    type: "text" as const,
                    text: "No documentation found matching your search criteria.",
                  }],
                };
              } else {
                const formattedResults = searchResults.map((entry: any, index: number) =>
                  `**🔍 ${index + 1}. ${entry.title}**\n\n📂 Category: ${entry.metadata.category}\n🔖 Tags: ${entry.metadata.tags.join(", ")}\n⭐ Confidence: ${entry.metadata.confidence}\n🔗 Source: [${entry.source?.location || entry.metadata?.source_url || "N/A"}](${entry.source?.location || entry.metadata?.source_url || "#"})\n\n${entry.content.slice(0, 1000)}${entry.content.length > 1000 ? "..." : ""}\n\n---`
                ).join("\n\n");

                toolResult = {
                  content: [{
                    type: "text" as const,
                    text: `Found ${searchResults.length} documentation entries:\n\n${formattedResults}`,
                  }],
                };
              }
            }
            else if (toolName === "search_chunks") {
              await ensureContentLoaded();
              const searchResults = await searchEntries({
                query: args.query,
                limit: args.limit || 8,
              }, env);

              if (searchResults.length === 0) {
                toolResult = {
                  content: [{
                    type: "text" as const,
                    text: "No content chunks found matching your search query.",
                  }],
                };
              } else {
                const formattedResults = searchResults.map((entry: any, index: number) =>
                  `**📄 Chunk ${index + 1}: ${entry.title}**\n\n${entry.content}\n\n🔗 Source: [${entry.source?.location || entry.metadata?.source_url || "N/A"}](${entry.source?.location || entry.metadata?.source_url || "#"})\n\n---`
                ).join("\n\n");

                toolResult = {
                  content: [{
                    type: "text" as const,
                    text: `Found ${searchResults.length} content chunks:\n\n${formattedResults}`,
                  }],
                };
              }
            }
            else if (toolName === "browse_by_category") {
              await ensureContentLoaded();
              const entries = getEntriesByCategory(args.category as any);

              if (entries.length === 0) {
                toolResult = {
                  content: [{
                    type: "text" as const,
                    text: `No entries found in category: ${args.category}`,
                  }],
                };
              } else {
                const formattedEntries = entries.map((entry: any, index: number) =>
                  `${index + 1}. **${entry.title}**\n   Tags: ${entry.metadata.tags.join(", ")}\n   Source: [${entry.source?.location || entry.metadata?.source_url || "Link"}](${entry.source?.location || entry.metadata?.source_url || "#"})`
                ).join("\n");

                toolResult = {
                  content: [{
                    type: "text" as const,
                    text: `**Category: ${args.category}** (${entries.length} entries)\n\n${formattedEntries}`,
                  }],
                };
              }
            }
            else if (toolName === "get_all_tags") {
              await ensureContentLoaded();
              const tags = getAllTags();
              const sortedTags = tags.sort();

              toolResult = {
                content: [{
                  type: "text" as const,
                  text: `**Available Tags** (${tags.length} total):\n\n${sortedTags.map((tag: string) => `• ${tag}`).join("\n")}`,
                }],
              };
            }
            else {
              throw new Error(`Unknown tool: ${toolName}`);
            }

            results.push({
              jsonrpc: "2.0",
              id: message.id,
              result: toolResult,
            });
          } catch (error: any) {
            console.error("[MCP] Tool call error:", error);
            results.push({
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: error.message || "Tool execution failed",
              },
            });
          }
        }
        else {
          // Unknown method
          results.push({
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`,
            },
          });
        }
      }

      // Return single result or batch
      const responseData = messages.length === 1 ? results[0] : results;

      // Standard JSON response (no streaming needed for simple operations)
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Handle GET requests (optional server-initiated streams)
    if (request.method === "GET") {
      const sessionId = request.headers.get("Mcp-Session-Id");

      if (!sessionId) {
        return new Response("Unauthorized: Session ID required", {
          status: 401,
          headers: corsHeaders,
        });
      }

      // For now, just return empty stream
      // In future, could implement server-initiated notifications
      console.log(`[MCP] GET request for session: ${sessionId}`);

      return new Response("GET endpoint not implemented yet", {
        status: 501,
        headers: corsHeaders,
      });
    }

    // Handle DELETE requests (session cleanup)
    if (request.method === "DELETE") {
      const sessionId = request.headers.get("Mcp-Session-Id");
      console.log(`[MCP] DELETE request for session: ${sessionId || "none"}`);

      // Since we're stateless, just return success
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Method not allowed
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        ...corsHeaders,
        "Allow": "GET, POST, DELETE, OPTIONS",
      },
    });

  } catch (error: any) {
    console.error("[MCP] Request handling error:", error);

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal server error",
        data: error.message,
      },
      id: null,
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}
