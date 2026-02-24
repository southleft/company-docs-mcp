/**
 * Unified search handler that checks Supabase first, falls back to local
 */

import { ContentEntry, SearchOptions, Category } from './content';
import { searchEntries as searchEntriesLocal } from './content-manager';
import {
  detectProvider,
  embedWithWorkersAI,
  embedWithOpenAI,
  type EmbeddingProvider,
} from './embedding-provider';

const DEFAULT_SIMILARITY_THRESHOLD = 0.15;

export async function searchWithSupabase(options: SearchOptions = {}, env?: any): Promise<ContentEntry[]> {
  const { query, category, tags: filterTags, confidence, limit = 50 } = options;

  const vectorEnabled = env?.VECTOR_SEARCH_ENABLED;
  const vectorSearchMode = env?.VECTOR_SEARCH_MODE || 'text';
  const supabaseUrl = env?.SUPABASE_URL;
  // Prefer service key (bypasses RLS) — appropriate for server-side Worker
  const supabaseKey = env?.SUPABASE_SERVICE_KEY || env?.SUPABASE_ANON_KEY;
  const logPerformance = env?.LOG_SEARCH_PERFORMANCE === 'true';

  const similarityThreshold = parseFloat(env?.VECTOR_SIMILARITY_THRESHOLD || '') || DEFAULT_SIMILARITY_THRESHOLD;

  // Use Supabase vector search when configured
  if (query && vectorEnabled === 'true' && vectorSearchMode === 'vector') {
    try {
      const provider = detectProvider(env || {});
      const hasEmbeddingCapability =
        (provider === 'workers-ai' && env?.AI) ||
        (provider === 'openai' && env?.OPENAI_API_KEY);

      if (supabaseUrl && supabaseKey && hasEmbeddingCapability) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Generate query embedding using the detected provider
        let queryEmbedding: number[];
        if (provider === 'workers-ai') {
          queryEmbedding = await embedWithWorkersAI(query, env.AI);
        } else {
          queryEmbedding = await embedWithOpenAI(query, env.OPENAI_API_KEY);
        }

        if (logPerformance) {
          console.log(`[Vector Search] provider="${provider}" query="${query}" dimensions=${queryEmbedding.length}`);
        }

        const { data, error } = await supabase.rpc('search_content', {
          query_embedding: queryEmbedding,
          query_text: query,
          match_threshold: similarityThreshold,
          match_count: limit,
          filter_category: category,
          filter_tags: filterTags,
        });

        if (logPerformance) {
          console.log(`[Vector Search] query="${query}" results=${data?.length || 0} threshold=${similarityThreshold}`);
        }

        if (!error && data && data.length > 0) {
          const qualityResults = data.filter((row: any) => {
            if (row.similarity !== undefined) return row.similarity >= similarityThreshold;
            const lowerQuery = query.toLowerCase();
            return (row.title?.toLowerCase().includes(lowerQuery) ||
                    row.content?.toLowerCase().includes(lowerQuery));
          });

          if (qualityResults.length > 0) {
            return qualityResults.map((row: any) => ({
              id: row.id,
              title: row.title,
              content: row.content || '',
              source: {
                type: row.source_type || 'database',
                location: row.source_location || 'supabase',
                ingested_at: row.ingested_at || new Date().toISOString(),
              },
              chunks: [],
              metadata: {
                category: row.category || 'general',
                tags: row.tags || [],
                confidence: row.confidence || confidence || 'medium',
                system: row.system_name || '',
                last_updated: row.updated_at || new Date().toISOString(),
                source_url: row.source_location || '',
              },
            }));
          }
        }

        if (error) {
          console.error('[Vector Search] RPC error:', error.message);
        }
      }
    } catch (error: any) {
      console.error('[Vector Search] Error:', error?.message || 'Unknown error');
    }
  }

  // Fallback to local keyword search
  return searchEntriesLocal(options);
}

// ---------------------------------------------------------------------------
// Browse by category via Supabase
// ---------------------------------------------------------------------------

/**
 * Query content_entries by category directly from Supabase.
 * Falls back to the local content-manager when Supabase is unavailable.
 */
export async function getEntriesByCategoryFromSupabase(
  category: string,
  env?: any
): Promise<ContentEntry[]> {
  const supabaseUrl = env?.SUPABASE_URL;
  const supabaseKey = env?.SUPABASE_SERVICE_KEY || env?.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('content_entries')
        .select('id, title, content, source_type, source_location, category, tags, confidence, metadata, ingested_at, updated_at')
        .eq('category', category)
        .order('title', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          title: row.title,
          content: row.content || '',
          source: {
            type: row.source_type || 'database',
            location: row.source_location || 'supabase',
            ingested_at: row.ingested_at || new Date().toISOString(),
          },
          chunks: [],
          metadata: {
            category: row.category || 'general',
            tags: row.tags || [],
            confidence: row.confidence || 'medium',
            system: row.metadata?.system_name || '',
            last_updated: row.updated_at || new Date().toISOString(),
            source_url: row.source_location || '',
          },
        }));
      }

      if (error) {
        console.error('[Browse Category] Supabase query error:', error.message);
      }
    } catch (error: any) {
      console.error('[Browse Category] Error:', error?.message || 'Unknown error');
    }
  }

  // Fallback to local content-manager
  const { getEntriesByCategory } = await import('./content-manager');
  return getEntriesByCategory(category as Category);
}

// ---------------------------------------------------------------------------
// Get all tags via Supabase
// ---------------------------------------------------------------------------

/**
 * Query all unique tags from content_entries in Supabase.
 * Falls back to the local content-manager when Supabase is unavailable.
 */
export async function getAllTagsFromSupabase(env?: any): Promise<string[]> {
  const supabaseUrl = env?.SUPABASE_URL;
  const supabaseKey = env?.SUPABASE_SERVICE_KEY || env?.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('content_entries')
        .select('tags');

      if (!error && data && data.length > 0) {
        const tagSet = new Set<string>();
        for (const row of data) {
          if (Array.isArray(row.tags)) {
            for (const tag of row.tags) {
              tagSet.add(tag);
            }
          }
        }
        return Array.from(tagSet).sort();
      }

      if (error) {
        console.error('[Get All Tags] Supabase query error:', error.message);
      }
    } catch (error: any) {
      console.error('[Get All Tags] Error:', error?.message || 'Unknown error');
    }
  }

  // Fallback to local content-manager
  const { getAllTags } = await import('./content-manager');
  return getAllTags();
}
