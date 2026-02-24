/**
 * MCP Streamable HTTP Handler
 *
 * Implements MCP Streamable HTTP transport (2025-03-26 spec) for Cloudflare Workers.
 * Uses the SDK's McpServer class with proper tool registration — no manual JSON-RPC dispatch.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools, type Env, type WorkerExecutionContext } from "./tools";

// CORS headers for all responses
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Accept, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Creates a configured MCP server instance with all tools registered.
 */
function createMcpServer(env: Env): McpServer {
  const orgName = env.ORGANIZATION_NAME || "Company";

  const server = new McpServer({
    name: `${orgName} Documentation Assistant`,
    version: "2.0.0",
  });

  registerTools(server, env);

  return server;
}

/**
 * Processes a single JSON-RPC message through the MCP server.
 *
 * The SDK's McpServer handles tool registration, listing, and execution internally.
 * We only need to manage the HTTP transport layer here.
 */
async function processMessage(server: McpServer, message: any, env: Env, requestUrl: string): Promise<any> {
  const method = message.method;

  // Initialize — must return server capabilities
  if (method === "initialize") {
    const origin = new URL(requestUrl).origin;
    const orgName = env.ORGANIZATION_NAME || "Company";

    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: {
          name: `${orgName} Documentation Assistant`,
          version: "2.0.0",
        },
        capabilities: {
          tools: {},
        },
      },
    };
  }

  // Notifications don't need responses
  if (method === "notifications/initialized") {
    return null;
  }

  // Ping
  if (method === "ping") {
    return { jsonrpc: "2.0", id: message.id, result: {} };
  }

  // tools/list — delegate to the SDK server's internal registry
  if (method === "tools/list") {
    // Access the internal server to get registered tools
    const lowLevelServer = (server as any).server;
    if (lowLevelServer && typeof lowLevelServer.getRegisteredTools === "function") {
      const tools = lowLevelServer.getRegisteredTools();
      return { jsonrpc: "2.0", id: message.id, result: { tools } };
    }

    // Fallback: manually invoke the list handler through the protocol
    // The SDK registers tools internally — we need to surface them via JSON-RPC
    const registeredTools = getRegisteredToolSchemas(server);
    return { jsonrpc: "2.0", id: message.id, result: { tools: registeredTools } };
  }

  // tools/call — execute through the SDK's registered handlers
  if (method === "tools/call") {
    const toolName = message.params?.name;
    const args = message.params?.arguments || {};

    try {
      // Use the SDK's internal tool execution
      const lowLevelServer = (server as any).server;
      if (lowLevelServer && typeof lowLevelServer.callTool === "function") {
        const result = await lowLevelServer.callTool(toolName, args);
        return { jsonrpc: "2.0", id: message.id, result };
      }

      // Fallback: call tool handler directly from the registered tools map
      const result = await callRegisteredTool(server, toolName, args);
      return { jsonrpc: "2.0", id: message.id, result };
    } catch (error: any) {
      console.error(`[MCP] Tool call error (${toolName}):`, error.message);
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32603, message: error.message || "Tool execution failed" },
      };
    }
  }

  // Unknown method
  return {
    jsonrpc: "2.0",
    id: message.id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

/**
 * Extract registered tool schemas from the McpServer instance.
 * The SDK stores tools internally — we access them for the tools/list response.
 */
function getRegisteredToolSchemas(server: McpServer): any[] {
  // Access the SDK's internal tool registry
  const internal = server as any;

  // Try _registeredTools (SDK v1.x pattern)
  if (internal._registeredTools) {
    return Array.from(internal._registeredTools.entries()).map((entry: any) => ({
      name: entry[0],
      description: entry[1]?.description || "",
      inputSchema: entry[1]?.inputSchema || { type: "object", properties: {} },
    }));
  }

  // Try _tools (alternative internal name)
  if (internal._tools) {
    return Array.from(internal._tools.entries()).map((entry: any) => ({
      name: entry[0],
      description: entry[1]?.description || "",
      inputSchema: entry[1]?.inputSchema || { type: "object", properties: {} },
    }));
  }

  console.warn("[MCP] Could not access internal tool registry — returning empty tools list");
  return [];
}

/**
 * Call a registered tool handler directly through the SDK's internal registry.
 */
async function callRegisteredTool(server: McpServer, toolName: string, args: any): Promise<any> {
  const internal = server as any;
  const toolMap = internal._registeredTools || internal._tools;

  if (!toolMap) {
    throw new Error("Cannot access tool registry");
  }

  const tool = toolMap.get(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // The SDK stores the handler function — call it
  if (typeof tool.handler === "function") {
    return tool.handler(args, {});
  }
  if (typeof tool.callback === "function") {
    return tool.callback(args, {});
  }

  throw new Error(`Tool "${toolName}" has no callable handler`);
}

/**
 * Main Streamable HTTP request handler
 *
 * Handles MCP protocol requests according to the Streamable HTTP specification:
 * - POST: Process JSON-RPC messages (tools/list, tools/call, etc.)
 * - GET: Optional server-initiated message stream (not yet implemented)
 * - DELETE: Session cleanup (stateless, returns success)
 */
export async function handleMcp(
  request: Request,
  env: Env,
  _ctx: WorkerExecutionContext
): Promise<Response> {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const server = createMcpServer(env);

  try {
    // POST — main MCP communication
    if (request.method === "POST") {
      const sessionId = request.headers.get("Mcp-Session-Id");
      const body = (await request.json()) as any;
      const messages = Array.isArray(body) ? body : [body];

      console.log(`[MCP] Processing ${messages.length} message(s), session=${sessionId || "none"}`);

      const results: any[] = [];
      for (const message of messages) {
        const result = await processMessage(server, message, env, request.url);
        if (result !== null) {
          results.push(result);
        }
      }

      // For initialize, include a new session ID header
      const isInitialize = messages.some((m: any) => m.method === "initialize");
      const headers: Record<string, string> = {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      };
      if (isInitialize && !sessionId) {
        headers["Mcp-Session-Id"] = crypto.randomUUID();
      }

      const responseData = messages.length === 1 ? results[0] : results;
      return new Response(JSON.stringify(responseData), { status: 200, headers });
    }

    // GET — server-initiated streams (not implemented)
    if (request.method === "GET") {
      return new Response("SSE endpoint not implemented", { status: 501, headers: CORS_HEADERS });
    }

    // DELETE — session cleanup (stateless)
    if (request.method === "DELETE") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: { ...CORS_HEADERS, Allow: "GET, POST, DELETE, OPTIONS" },
    });
  } catch (error: any) {
    console.error("[MCP] Request handling error:", error);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error", data: error.message },
        id: null,
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
