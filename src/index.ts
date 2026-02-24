/**
 * Cloudflare Worker Entry Point
 *
 * Thin router that delegates to specialized handlers:
 *   /mcp       → MCP Streamable HTTP (mcp-handler.ts)
 *   /ai-chat   → OpenAI-powered chat (ai-chat-handler.ts)
 *   /slack     → Slack slash commands (slack-webhook.ts)
 *   /search    → JSON search API
 *   / | /chat  → Chat web UI (chat-ui.ts)
 *   /health    → Health check
 */

import { z } from "zod";
import { handleMcp } from "./mcp-handler";
import { handleAiChat } from "./ai-chat-handler";
import { handleSlackCommand } from "./slack-webhook";
import { ensureContentLoaded, type Env, type WorkerExecutionContext } from "./tools";
import { searchWithSupabase } from "./lib/search-handler";
import { searchChunksEnhanced as searchChunks } from "./lib/content-manager-enhanced";
import { formatSourceReference } from "./lib/source-formatter";
import { getChatHtml } from "./chat-ui";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function corsHeaders(env: Env): Record<string, string> {
  const origin = env.ALLOWED_ORIGINS || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Content-Type": "application/json",
  };
}

function htmlHeaders(env: Env): Record<string, string> {
  const origin = env.ALLOWED_ORIGINS || "*";
  return {
    "Content-Type": "text/html",
    "Access-Control-Allow-Origin": origin,
  };
}

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

function validateEnv(env: Env): string[] {
  const warnings: string[] = [];

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    warnings.push("SUPABASE_URL/SUPABASE_ANON_KEY not set — vector search unavailable");
  }
  if (!env.OPENAI_API_KEY && !env.AI) {
    warnings.push("No embedding provider available — set OPENAI_API_KEY or enable Workers AI binding");
  }
  if (!env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY not set — AI chat unavailable (vector search will use Workers AI)");
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Search request validation
// ---------------------------------------------------------------------------

const SearchRequestSchema = z.object({
  query: z.string().min(1, "query must be a non-empty string").max(500, "query too long"),
  limit: z.number().int().min(1).max(50).default(5),
});

// ---------------------------------------------------------------------------
// KV cache helpers
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 300; // 5 minutes

function cacheKey(query: string, limit: number): string {
  return `search:${query.toLowerCase().trim()}:${limit}`;
}

async function getCached(env: Env, key: string): Promise<unknown | null> {
  if (!env.CONTENT_CACHE) return null;
  try {
    const raw = await env.CONTENT_CACHE.get(key, "text");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCache(env: Env, key: string, value: unknown): Promise<void> {
  if (!env.CONTENT_CACHE) return;
  try {
    await env.CONTENT_CACHE.put(key, JSON.stringify(value), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  } catch {
    // KV write failures are non-fatal
  }
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(env),
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ── MCP Streamable HTTP ──────────────────────────────────────────
    if (url.pathname === "/mcp") {
      return handleMcp(request, env, ctx);
    }

    // ── AI Chat (OpenAI) ─────────────────────────────────────────────
    if (url.pathname === "/ai-chat") {
      return handleAiChat(request, env);
    }

    // ── Slack slash command ──────────────────────────────────────────
    if (url.pathname === "/slack" && request.method === "POST") {
      await ensureContentLoaded();
      return handleSlackCommand(request, env, ctx);
    }

    // ── JSON search endpoint ─────────────────────────────────────────
    if (url.pathname === "/search" && request.method === "POST") {
      return handleSearch(request, env);
    }

    // ── Chat web UI ──────────────────────────────────────────────────
    if (url.pathname === "/" || url.pathname === "/chat") {
      return new Response(getChatHtml(env), { headers: htmlHeaders(env) });
    }

    // ── Health check ─────────────────────────────────────────────────
    if (url.pathname === "/health") {
      const warnings = validateEnv(env);
      return new Response(
        JSON.stringify({
          status: "ok",
          service: `${env.ORGANIZATION_NAME || "Documentation"} MCP`,
          version: "2.0.0",
          warnings: warnings.length > 0 ? warnings : undefined,
        }),
        { headers: corsHeaders(env) }
      );
    }

    // ── Catch-all ────────────────────────────────────────────────────
    return new Response(
      `${env.ORGANIZATION_NAME || "Documentation"} MCP Server - Use /mcp or /ai-chat endpoints`,
      {
        status: 200,
        headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*" },
      }
    );
  },
};

// ---------------------------------------------------------------------------
// /search handler
// ---------------------------------------------------------------------------
async function handleSearch(request: Request, env: Env): Promise<Response> {
  const headers = corsHeaders(env);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues.map((i) => i.message).join("; ") }),
      { status: 400, headers }
    );
  }

  const { query, limit } = parsed.data;

  try {
    // Check KV cache first
    const key = cacheKey(query, limit);
    const cached = await getCached(env, key);
    if (cached) {
      return new Response(JSON.stringify(cached), { headers });
    }

    await ensureContentLoaded();

    let mapped;

    if (env?.SUPABASE_URL && env?.SUPABASE_ANON_KEY) {
      const entries = await searchWithSupabase({ query, limit }, env);
      mapped = entries.map((e) => {
        let sourceUrl = (e.metadata as any)?.source || (e.metadata as any)?.source_url || "";
        if (!sourceUrl && e.content) {
          const sourceMatch = e.content.match(/^source:\s*(https?:\/\/[^\n]+)/m);
          if (sourceMatch) sourceUrl = sourceMatch[1];
        }
        return {
          title: e.title,
          content: e.content.slice(0, 500),
          source: sourceUrl || e.source?.location || "",
          relevance: 1,
          metadata: {
            category: e.metadata?.category,
            tags: e.metadata?.tags,
            source: sourceUrl,
          },
        };
      });
    } else {
      const results = searchChunks(query, limit, {
        enableDiversity: true,
        maxPerSource: 2,
        preferUrls: true,
      });
      mapped = results.map((r) => {
        const { url } = formatSourceReference(r.entry);
        const cleanText = (r.chunk.text || "")
          .replace(/^[-*•]\s*/gm, "")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/^#+\s*/gm, "")
          .trim();
        return {
          title: r.entry.title,
          content: cleanText,
          source: url || r.entry.source?.location || "",
          relevance: r.score ?? 0,
          metadata: {
            category: r.entry.metadata?.category,
            tags: r.entry.metadata?.tags,
            source: (r.entry.metadata as any)?.source || (r.entry.metadata as any)?.source_url,
          },
        };
      });
    }

    const responseBody = { results: mapped, total: mapped.length, query };

    // Write to KV cache in the background
    await setCache(env, key, responseBody);

    return new Response(JSON.stringify(responseBody), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Search failed" }), {
      status: 500,
      headers,
    });
  }
}
