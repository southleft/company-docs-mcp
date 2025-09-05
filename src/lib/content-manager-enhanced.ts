/**
 * Enhanced content manager with search diversity improvements
 */

import { searchChunks as searchChunksOriginal } from './content-manager';
import { diversifySearchResults, getSourceDiversity } from './search-diversity';
import { ContentEntry, ContentChunk } from './content';

/**
 * Enhanced chunk search with diversity improvements
 */
export function searchChunksEnhanced(
  query: string, 
  limit: number = 8,
  options: {
    enableDiversity?: boolean;
    maxPerSource?: number;
    preferUrls?: boolean;
    logDiversity?: boolean;
  } = {}
): Array<{ entry: ContentEntry; chunk: ContentChunk; score: number }> {
  const {
    enableDiversity = true,
    maxPerSource = 2,  // Limit to 2 chunks per source for better diversity
    preferUrls = true,
    logDiversity = false
  } = options;

  // Get more results initially to ensure diversity after filtering
  const rawResults = searchChunksOriginal(query, limit * 3);
  
  if (!enableDiversity) {
    return rawResults.slice(0, limit);
  }
  
  // Apply diversity improvements
  const diverseResults = diversifySearchResults(rawResults, {
    maxPerSource,
    pdfPenalty: 0.6,  // Reduce PDF scores by 40%
    preferUrls
  });
  
  if (logDiversity) {
    const metrics = getSourceDiversity(diverseResults.slice(0, limit));
    console.log(`[Search Diversity] Query: "${query}"`);
    console.log(`  Sources: ${metrics.totalSources} (PDF: ${metrics.pdfSources}, URL: ${metrics.urlSources})`);
    console.log(`  Diversity Score: ${(metrics.diversityScore * 100).toFixed(1)}%`);
  }
  
  // Return standard format
  return diverseResults.slice(0, limit).map(result => ({
    entry: result.entry,
    chunk: result.chunk,
    score: result.score
  }));
}

/**
 * Export enhanced search as default
 */
export { searchChunksEnhanced as searchChunks };