/**
 * MCP Streamable HTTP Handler
 *
 * Implements MCP Streamable HTTP transport (2025-03-26 spec) for Cloudflare Workers.
 * Uses the SDK's McpServer class with proper tool registration — no manual JSON-RPC dispatch.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { zodToJsonSchema } from "zod-to-json-schema";
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
    const orgName = env.ORGANIZATION_NAME || "Company";

    // Echo the client's requested protocol version when we support it, else
    // fall back. Strict clients (e.g. Codex) may reject a response that
    // advertises a version they didn't ask for.
    const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"];
    const requestedVersion = message.params?.protocolVersion;
    const negotiatedVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : "2025-03-26";

    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: negotiatedVersion,
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

  // tools/list — surface the SDK server's registered tools via JSON-RPC
  if (method === "tools/list") {
    const registeredTools = getRegisteredToolSchemas(server);
    return { jsonrpc: "2.0", id: message.id, result: { tools: registeredTools } };
  }

  // tools/call — validate against the tool's schema, then execute
  if (method === "tools/call") {
    const toolName = message.params?.name;
    const args = message.params?.arguments || {};

    try {
      const result = await callRegisteredTool(server, toolName, args);
      return { jsonrpc: "2.0", id: message.id, result };
    } catch (error: any) {
      console.error(`[MCP] Tool call error (${toolName}):`, error.message);
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: error.jsonRpcCode === -32602 ? -32602 : -32603,
          message: error.message || "Tool execution failed",
        },
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
  const internal = server as any;
  const toolMap = internal._registeredTools || internal._tools;

  if (!toolMap) {
    console.warn("[MCP] Could not access internal tool registry — returning empty tools list");
    return [];
  }

  // SDK 1.22+ uses a plain object; older versions used a Map
  const entries: [string, any][] = typeof toolMap.entries === "function" && toolMap.constructor !== Object
    ? Array.from(toolMap.entries())
    : Object.entries(toolMap);

  return entries
    .filter(([, tool]) => tool?.enabled !== false)
    .map(([name, tool]) => ({
      name,
      description: tool?.description || "",
      inputSchema: tool?.inputSchema
        ? zodToJsonSchema(tool.inputSchema, { strictUnions: true })
        : { type: "object", properties: {} },
    }));
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

  // SDK 1.22+ uses a plain object; older versions used a Map
  const tool = typeof toolMap.get === "function" ? toolMap.get(toolName) : toolMap[toolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Enforce the tool's zod input schema. Without this, dispatching straight to
  // the callback silently skips ALL declared constraints (types, .max() caps),
  // letting e.g. limit=999999999 flow unclamped into the database query.
  let validatedArgs = args;
  if (tool.inputSchema && typeof tool.inputSchema.safeParseAsync === "function") {
    const parsed = await tool.inputSchema.safeParseAsync(args);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue: any) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      const err: any = new Error(`Invalid params: ${detail}`);
      err.jsonRpcCode = -32602;
      throw err;
    }
    validatedArgs = parsed.data;
  }

  if (typeof tool.handler === "function") {
    return tool.handler(validatedArgs, {});
  }
  if (typeof tool.callback === "function") {
    return tool.callback(validatedArgs, {});
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

      // Notification-only posts produce no results; per spec return 202 Accepted
      // (a 200 with an empty/`undefined` body is ambiguous to strict clients).
      if (results.length === 0) {
        return new Response(null, { status: 202, headers });
      }

      const responseData = messages.length === 1 ? results[0] : results;
      return new Response(JSON.stringify(responseData), { status: 200, headers });
    }

    // GET — optional server-initiated SSE stream. This server is stateless and
    // doesn't push server-initiated messages, so per the MCP spec we signal
    // that the optional stream isn't offered with 405 Method Not Allowed.
    // Returning 501 makes strict clients (e.g. Codex) treat the connection as
    // broken and never call tools/list.
    if (request.method === "GET") {
      return new Response("Method Not Allowed: this server does not offer a server-initiated stream", {
        status: 405,
        headers: { ...CORS_HEADERS, Allow: "POST, DELETE, OPTIONS" },
      });
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
