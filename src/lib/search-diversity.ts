/**
 * Search diversity improvements to prevent PDF dominance
 */

import { ContentEntry, ContentChunk } from '../../types/content';

export interface DiverseSearchResult {
  entry: ContentEntry;
  chunk: ContentChunk;
  score: number;
  sourceType: 'pdf' | 'url' | 'other';
}

/**
 * Rebalance search results to ensure diversity across sources
 */
export function diversifySearchResults(
  results: Array<{ entry: ContentEntry; chunk: ContentChunk; score: number }>,
  options: {
    maxPerSource?: number;
    pdfPenalty?: number;
    preferUrls?: boolean;
  } = {}
): DiverseSearchResult[] {
  const { 
    maxPerSource = 3,  // Max chunks from single source
    pdfPenalty = 0.7,  // Reduce PDF scores by 30%
    preferUrls = true  // Boost URL content
  } = options;

  // Track chunks per source
  const sourceCount = new Map<string, number>();
  
  // Process and score results
  const processedResults: DiverseSearchResult[] = results.map(result => {
    const sourceType = detectSourceType(result.entry);
    let adjustedScore = result.score;
    
    // Apply PDF penalty
    if (sourceType === 'pdf') {
      adjustedScore *= pdfPenalty;
    }
    
    // Boost URL content
    if (sourceType === 'url' && preferUrls) {
      adjustedScore *= 1.2;
    }
    
    return {
      ...result,
      score: adjustedScore,
      sourceType
    };
  });
  
  // Sort by adjusted score
  processedResults.sort((a, b) => b.score - a.score);
  
  // Apply per-source limits
  const diverseResults: DiverseSearchResult[] = [];
  
  for (const result of processedResults) {
    const sourceId = result.entry.id;
    const count = sourceCount.get(sourceId) || 0;
    
    if (count < maxPerSource) {
      diverseResults.push(result);
      sourceCount.set(sourceId, count + 1);
    }
  }
  
  return diverseResults;
}

/**
 * Detect source type from entry
 */
function detectSourceType(entry: ContentEntry): 'pdf' | 'url' | 'other' {
  if (entry.source?.type === 'pdf' || entry.id.includes('pdf')) {
    return 'pdf';
  }
  if (entry.source?.type === 'url' || entry.id.includes('url')) {
    return 'url';
  }
  return 'other';
}

/**
 * Group results by source for better presentation
 */
export function groupResultsBySource(
  results: DiverseSearchResult[]
): Map<string, DiverseSearchResult[]> {
  const grouped = new Map<string, DiverseSearchResult[]>();
  
  for (const result of results) {
    const source = result.entry.title;
    if (!grouped.has(source)) {
      grouped.set(source, []);
    }
    grouped.get(source)!.push(result);
  }
  
  return grouped;
}

/**
 * Get source diversity metrics
 */
export function getSourceDiversity(results: DiverseSearchResult[]): {
  totalSources: number;
  pdfSources: number;
  urlSources: number;
  diversityScore: number;
} {
  const sources = new Set(results.map(r => r.entry.id));
  const pdfSources = new Set(results.filter(r => r.sourceType === 'pdf').map(r => r.entry.id));
  const urlSources = new Set(results.filter(r => r.sourceType === 'url').map(r => r.entry.id));
  
  // Calculate diversity score (0-1, higher is more diverse)
  const diversityScore = sources.size / Math.max(results.length, 1);
  
  return {
    totalSources: sources.size,
    pdfSources: pdfSources.size,
    urlSources: urlSources.size,
    diversityScore
  };
}