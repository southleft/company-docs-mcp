/**
 * Unified search handler that checks Supabase first, falls back to local
 */

import { ContentEntry, SearchOptions, Category } from './content';
import { searchEntries as searchEntriesLocal } from './content-manager';

export async function searchWithSupabase(options: SearchOptions = {}, env?: any): Promise<ContentEntry[]> {
  const { query, category, tags: filterTags, confidence, limit = 50 } = options;
  
  // Get environment variables from Cloudflare env
  const vectorEnabled = env?.VECTOR_SEARCH_ENABLED;
  const vectorSearchMode = env?.VECTOR_SEARCH_MODE || 'text';
  const supabaseUrl = env?.SUPABASE_URL;
  const supabaseKey = env?.SUPABASE_ANON_KEY;
  const openaiKey = env?.OPENAI_API_KEY;
  const logPerformance = env?.LOG_SEARCH_PERFORMANCE === 'true';
  
  // Check if we should use Supabase vector search
  if (query && vectorEnabled === 'true' && vectorSearchMode === 'vector') {
    try {
      // Try to connect to Supabase
      const { createClient } = require('@supabase/supabase-js');
      
      if (supabaseUrl && supabaseKey && openaiKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Generate embedding for the query
        const OpenAI = require('openai');
        const openai = new OpenAI.default({ apiKey: openaiKey });
        
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query.slice(0, 8191),
        });
        
        const queryEmbedding = embeddingResponse.data[0].embedding;
        
        // Search Supabase with vector similarity
        const { data, error } = await supabase.rpc('search_content', {
          query_embedding: queryEmbedding,
          query_text: query, // Hybrid search
          match_threshold: 0.3,
          match_count: limit,
          filter_category: category,
          filter_tags: filterTags
        });
        
        if (!error && data && data.length > 0) {
          if (logPerformance) {
            console.log(`[Vector Search] Found ${data.length} results`);
          }
          
          // Convert Supabase results to ContentEntry format
          return data.map((row: any) => ({
            id: row.id,
            title: row.title,
            content: row.content || '',
            source: {
              type: row.source_type || 'database',
              location: row.source_location || 'supabase',
              ingested_at: row.ingested_at || new Date().toISOString()
            },
            chunks: [],
            metadata: {
              category: row.category || 'general',
              tags: row.tags || [],
              confidence: row.confidence || confidence || 'medium',
              system: row.system_name || '',
              last_updated: row.updated_at || new Date().toISOString(),
              source_url: row.source_location || ''
            }
          }));
        }
        
        if (error && logPerformance) {
          console.error('[Vector Search] Supabase error:', error.message);
        }
      }
    } catch (error: any) {
      if (logPerformance) {
        console.error('[Vector Search] Error:', error?.message || 'Unknown error');
      }
      // Continue to fallback
    }
  }
  
  // Fallback to local keyword search
  if (logPerformance) {
    console.log('[Search] Using local keyword search');
  }
  return searchEntriesLocal(options);
}