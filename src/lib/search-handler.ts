/**
 * Unified search handler that checks Supabase first, falls back to local
 */

import { ContentEntry, SearchOptions, Category } from './content';
import { searchEntries as searchEntriesLocal } from './content-manager';

const DEFAULT_SIMILARITY_THRESHOLD = 0.15;

export async function searchWithSupabase(options: SearchOptions = {}, env?: any): Promise<ContentEntry[]> {
  const { query, category, tags: filterTags, confidence, limit = 50 } = options;

  const vectorEnabled = env?.VECTOR_SEARCH_ENABLED;
  const vectorSearchMode = env?.VECTOR_SEARCH_MODE || 'text';
  const supabaseUrl = env?.SUPABASE_URL;
  // Prefer service key (bypasses RLS) — appropriate for server-side Worker
  const supabaseKey = env?.SUPABASE_SERVICE_KEY || env?.SUPABASE_ANON_KEY;
  const openaiKey = env?.OPENAI_API_KEY;
  const logPerformance = env?.LOG_SEARCH_PERFORMANCE === 'true';

  const similarityThreshold = parseFloat(env?.VECTOR_SIMILARITY_THRESHOLD || '') || DEFAULT_SIMILARITY_THRESHOLD;

  // Use Supabase vector search when configured
  if (query && vectorEnabled === 'true' && vectorSearchMode === 'vector') {
    try {
      if (supabaseUrl && supabaseKey && openaiKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: openaiKey });

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query.slice(0, 8191),
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

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
