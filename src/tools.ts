/**
 * Unified MCP tool definitions — Single source of truth
 *
 * All tool registrations (MCP SDK, OpenAI function calls) derive from here.
 * This eliminates the previous 6-way duplication of tool logic.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  loadEntries,
  searchEntries as searchEntriesLocal,
  getEntriesByCategory,
  getAllTags,
  SAMPLE_ENTRIES,
} from "./lib/content-manager";
import { searchChunksEnhanced as searchChunksLocal } from "./lib/content-manager-enhanced";
import { searchWithSupabase } from "./lib/search-handler";
import { formatSourceReference } from "./lib/source-formatter";
import type { Category, ContentEntry } from "./lib/content";

// ---------------------------------------------------------------------------
// Env type (shared across modules)
// ---------------------------------------------------------------------------
export interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VECTOR_SEARCH_ENABLED?: string;
  VECTOR_SEARCH_MODE?: string;
  VECTOR_SIMILARITY_THRESHOLD?: string;
  LOG_SEARCH_PERFORMANCE?: string;
  AI_SYSTEM_PROMPT?: string;
  ORGANIZATION_NAME?: string;
  ORGANIZATION_DOMAIN?: string;
  ORGANIZATION_LOGO_URL?: string;
  ORGANIZATION_TAGLINE?: string;
  ORGANIZATION_SUBTITLE?: string;
  ALLOWED_ORIGINS?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_SLASH_COMMAND?: string;
  CONTENT_CACHE?: any;
  AI?: any;
  [key: string]: unknown;
}

export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// ---------------------------------------------------------------------------
// Content loading (lazy, shared state)
// ---------------------------------------------------------------------------
let contentLoaded = false;

export async function ensureContentLoaded(): Promise<void> {
  if (contentLoaded) return;

  try {
    const { loadAllContentEntries } = await import("./lib/content-loader");
    const actualEntries = await loadAllContentEntries();

    if (actualEntries.length > 0) {
      loadEntries(actualEntries);
      console.log(`Loaded ${actualEntries.length} content entries`);
    } else {
      throw new Error("No content entries loaded from manifest");
    }
  } catch (error) {
    console.error("Failed to load content dynamically:", error);
    loadEntries(SAMPLE_ENTRIES);
    console.warn("Using fallback sample content");
  }

  contentLoaded = true;
}

// ---------------------------------------------------------------------------
// Search helpers (use Supabase when available, fall back to local)
// ---------------------------------------------------------------------------
async function search(
  query: string,
  env: Env,
  opts: { category?: string; tags?: string[]; limit?: number } = {}
): Promise<ContentEntry[]> {
  await ensureContentLoaded();
  return searchWithSupabase(
    { query, category: opts.category, tags: opts.tags, limit: opts.limit ?? 15 },
    env
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function formatSearchResults(results: ContentEntry[]): string {
  if (results.length === 0) {
    return "No documentation found matching your search criteria.";
  }

  const formatted = results
    .map((entry, i) => {
      const source = entry.source?.location || entry.metadata?.source_url || "N/A";
      return `**${i + 1}. ${entry.title}**

Category: ${entry.metadata.category}
Tags: ${entry.metadata.tags.join(", ")}
Confidence: ${entry.metadata.confidence}
Source: [${source}](${source})

${entry.content.slice(0, 1000)}${entry.content.length > 1000 ? "..." : ""}

---`;
    })
    .join("\n\n");

  return `Found ${results.length} documentation entries:\n\n${formatted}`;
}

function formatChunkResults(
  results: Array<{ entry: ContentEntry; chunk: { text: string; metadata?: { section?: string } }; score: number }>
): string {
  if (results.length === 0) {
    return "No content chunks found matching your search query.";
  }

  const formatted = results
    .map((result, i) => {
      const { displayName, url } = formatSourceReference(result.entry);
      const sourceLink = url ? `[${displayName}](${url})` : displayName;
      const cleanText = result.chunk.text
        .replace(/^[-*•]\s*/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return `**${result.chunk.metadata?.section || "Insight"}** from ${sourceLink}

${cleanText}`;
    })
    .join("\n\n---\n\n");

  return `Found ${results.length} content chunks:\n\n${formatted}`;
}

// ---------------------------------------------------------------------------
// Register MCP tools on an McpServer instance
// ---------------------------------------------------------------------------
export function registerTools(server: McpServer, env: Env): void {
  // Tool 1: Primary documentation search
  server.tool(
    "search_documentation",
    "Search through the documentation knowledge base by query, category, or tags",
    {
      query: z.string().describe("Search query for finding relevant documentation"),
      category: z
        .enum(["components", "tokens", "patterns", "guidelines", "tools", "general"])
        .optional()
        .describe("Filter by category"),
      tags: z.array(z.string()).optional().describe("Filter by specific tags"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(15)
        .describe("Maximum number of results to return (default: 15)"),
    },
    async ({ query, category, tags, limit }) => {
      const results = await search(query, env, { category, tags, limit });
      return {
        content: [{ type: "text" as const, text: formatSearchResults(results) }],
      };
    }
  );

  // Tool 2: Chunk-level search for detailed information
  server.tool(
    "search_chunks",
    "Search through specific content chunks for detailed information",
    {
      query: z.string().describe("Search query for finding specific content chunks"),
      limit: z
        .number()
        .min(1)
        .max(20)
        .default(8)
        .describe("Maximum number of chunks to return (default: 8)"),
    },
    async ({ query, limit }) => {
      // Try Supabase first for chunk search
      const results = await search(query, env, { limit });

      if (results.length > 0) {
        return {
          content: [{ type: "text" as const, text: formatSearchResults(results) }],
        };
      }

      // Fall back to local enhanced chunk search
      await ensureContentLoaded();
      const chunkResults = searchChunksLocal(query, limit, {
        enableDiversity: true,
        maxPerSource: 2,
        preferUrls: true,
      });

      return {
        content: [{ type: "text" as const, text: formatChunkResults(chunkResults) }],
      };
    }
  );

  // Tool 3: Browse by category
  server.tool(
    "browse_by_category",
    "Browse all entries in a specific category",
    {
      category: z
        .enum(["components", "tokens", "patterns", "guidelines", "tools", "general"])
        .describe("Category to browse"),
    },
    async ({ category }) => {
      await ensureContentLoaded();
      const entries = getEntriesByCategory(category as Category);

      if (entries.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No entries found in category: ${category}` }],
        };
      }

      const formatted = entries
        .map(
          (entry, i) =>
            `${i + 1}. **${entry.title}**\n   Tags: ${entry.metadata.tags.join(", ")}\n   Source: [${entry.source?.location || entry.metadata?.source_url || "Link"}](${entry.source?.location || entry.metadata?.source_url || "#"})`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `**Category: ${category}** (${entries.length} entries)\n\n${formatted}`,
          },
        ],
      };
    }
  );

  // Tool 4: List all tags
  server.tool("get_all_tags", "Get a list of all available tags in the knowledge base", {}, async () => {
    await ensureContentLoaded();
    const tags = getAllTags().sort();

    return {
      content: [
        {
          type: "text" as const,
          text: `**Available Tags** (${tags.length} total):\n\n${tags.map((t) => `• ${t}`).join("\n")}`,
        },
      ],
    };
  });
}

// ---------------------------------------------------------------------------
// OpenAI function-call tool definitions (for AI chat handler)
// ---------------------------------------------------------------------------
export const OPENAI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_documentation",
      description:
        "Primary search tool for ALL questions about the knowledge base. Use for any topic.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          category: { type: "string", description: "Filter by category (optional)" },
          limit: { type: "number", description: "Maximum number of results (default: 25)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_chunks",
      description: "Search for specific detailed information in content chunks",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for specific information" },
          limit: { type: "number", description: "Maximum number of chunks (default: 12)" },
        },
        required: ["query"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Execute a tool call by name (used by AI chat handler)
// ---------------------------------------------------------------------------
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  env: Env
): Promise<string> {
  await ensureContentLoaded();

  switch (toolName) {
    case "search_documentation": {
      const results = await search(String(args.query || ""), env, {
        category: args.category as string | undefined,
        limit: (args.limit as number) || 25,
      });
      return formatSearchResults(results);
    }

    case "search_chunks": {
      const results = await search(String(args.query || ""), env, {
        limit: (args.limit as number) || 12,
      });

      if (results.length > 0) return formatSearchResults(results);

      // Fall back to local chunk search
      const chunkResults = searchChunksLocal(String(args.query || ""), (args.limit as number) || 12, {
        enableDiversity: true,
        maxPerSource: 2,
        preferUrls: true,
      });
      return formatChunkResults(chunkResults);
    }

    case "browse_by_category": {
      const entries = getEntriesByCategory(String(args.category || "general") as Category);
      if (entries.length === 0) return `No entries found in category: ${args.category}`;
      return entries.map((e) => `**${e.title}**\nTags: ${e.metadata.tags.join(", ")}`).join("\n\n");
    }

    case "get_all_tags": {
      const tags = getAllTags();
      return `Available tags (${tags.length}): ${tags.join(", ")}`;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
