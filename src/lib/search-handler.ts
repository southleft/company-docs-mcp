/**
 * Unified search handler that checks the configured vector store first and
 * falls back to local keyword search.
 *
 * Backends resolve through the provider container (src/providers): the
 * embedding provider and vector store are selected by env configuration
 * (EMBEDDING_PROVIDER, VECTOR_STORE) with defaults that preserve the
 * original Workers AI / OpenAI + Supabase behavior.
 */

import { ContentEntry, SearchOptions, Category } from './content';
import { searchEntries as searchEntriesLocal } from './content-manager';
import { resolveContainer } from '../providers';

const DEFAULT_SIMILARITY_THRESHOLD = 0.15;
const SEARCH_CACHE_TTL_SECONDS = 300;

function searchCacheKey(
  query: string,
  limit: number,
  category?: string,
  tags?: string[]
): string {
  const tagPart = tags?.length ? tags.slice().sort().join(',') : '';
  return `vsearch:${query.toLowerCase().trim()}:${limit}:${category || ''}:${tagPart}`;
}

export async function searchWithSupabase(options: SearchOptions = {}, env?: any): Promise<ContentEntry[]> {
  const { query, category, tags: filterTags, confidence } = options;
  // Clamp server-side regardless of caller schema — tool-layer validation
  // can be bypassed, and the limit flows straight into the DB query.
  const limit = Math.min(Math.max(1, options.limit ?? 50), 50);

  const vectorEnabled = env?.VECTOR_SEARCH_ENABLED;
  const vectorSearchMode = env?.VECTOR_SEARCH_MODE || 'text';
  const logPerformance = env?.LOG_SEARCH_PERFORMANCE === 'true';

  const similarityThreshold = parseFloat(env?.VECTOR_SIMILARITY_THRESHOLD || '') || DEFAULT_SIMILARITY_THRESHOLD;

  // Use vector search when configured
  if (query && vectorEnabled === 'true' && vectorSearchMode === 'vector') {
    try {
      const services = resolveContainer(env || {});

      // Repeated queries (chat suggestion buttons, an MCP client retrying)
      // skip the embedding call and DB round-trip entirely.
      const key = searchCacheKey(query, limit, category, filterTags);
      const cached = await services.cache.get<ContentEntry[]>(key);
      if (cached) {
        if (logPerformance) {
          console.log(`[Vector Search] cache hit for "${query}"`);
        }
        return cached;
      }

      const queryEmbedding = await services.embedder.embed(query);

      if (logPerformance) {
        console.log(
          `[Vector Search] provider="${services.embedder.id}" store="${services.vectorStore.id}" query="${query}" dimensions=${queryEmbedding.length}`
        );
      }

      const results = await services.vectorStore.search({
        queryEmbedding,
        queryText: query,
        threshold: similarityThreshold,
        limit,
        category: category as Category | undefined,
        tags: filterTags,
      });

      if (logPerformance) {
        console.log(`[Vector Search] query="${query}" results=${results.length} threshold=${similarityThreshold}`);
      }

      if (results.length > 0) {
        const enriched = confidence
          ? results.map((entry) => ({
              ...entry,
              metadata: { ...entry.metadata, confidence: entry.metadata.confidence || confidence },
            }))
          : results;
        await services.cache.put(key, enriched, { ttlSeconds: SEARCH_CACHE_TTL_SECONDS });
        return enriched;
      }
    } catch (error: any) {
      // Provider construction failures (missing credentials) and query errors
      // both land here — fall through to local keyword search either way.
      console.error('[Vector Search] Error:', error?.message || 'Unknown error');
    }
  }

  // Fallback to local keyword search
  return searchEntriesLocal(options);
}

// ---------------------------------------------------------------------------
// Browse by category via the configured vector store
// ---------------------------------------------------------------------------

/**
 * Query entries by category from the configured store.
 * Falls back to the local content-manager when the store is unavailable.
 */
export async function getEntriesByCategoryFromSupabase(
  category: string,
  env?: any
): Promise<ContentEntry[]> {
  try {
    const services = resolveContainer(env || {});
    const entries = await services.vectorStore.getByCategory(category as Category);
    if (entries.length > 0) {
      return entries;
    }
  } catch (error: any) {
    console.error('[Browse Category] Error:', error?.message || 'Unknown error');
  }

  // Fallback to local content-manager
  const { getEntriesByCategory } = await import('./content-manager');
  return getEntriesByCategory(category as Category);
}

// ---------------------------------------------------------------------------
// Get all tags via the configured vector store
// ---------------------------------------------------------------------------

/**
 * Query all unique tags from the configured store.
 * Falls back to the local content-manager when the store is unavailable.
 */
export async function getAllTagsFromSupabase(env?: any): Promise<string[]> {
  try {
    const services = resolveContainer(env || {});
    const tags = await services.vectorStore.getAllTags();
    if (tags.length > 0) {
      return tags;
    }
  } catch (error: any) {
    console.error('[Get All Tags] Error:', error?.message || 'Unknown error');
  }

  // Fallback to local content-manager
  const { getAllTags } = await import('./content-manager');
  return getAllTags();
}
