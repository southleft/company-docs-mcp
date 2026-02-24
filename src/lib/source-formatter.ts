/**
 * Format and clean up source references for display
 */

import { ContentEntry } from './content';

// Map of known books/PDFs to their actual sources.
// Entries are populated at ingestion time via content metadata — no hardcoded values.
const KNOWN_SOURCES: Record<string, { name: string; url: string }> = {};

/**
 * Format a source reference for clean display
 */
export function formatSourceReference(entry: ContentEntry): {
  displayName: string;
  url: string | null;
  isBook: boolean;
} {
  const title = entry.title.toLowerCase();
  const sourceLocation = entry.source?.location || '';
  
  // Check if this is a known book/PDF
  for (const [key, source] of Object.entries(KNOWN_SOURCES)) {
    if (title.includes(key) || sourceLocation.includes(key)) {
      return {
        displayName: source.name,
        url: source.url,
        isBook: true
      };
    }
  }
  
  // Handle URL sources - check multiple metadata fields
  const urlMatch = entry.metadata?.source || entry.metadata?.source_url || entry.source?.location || '';
  
  if (entry.source?.type === 'url' || entry.id.includes('url') || urlMatch.startsWith('http')) {
    // Extract clean domain name from URL entries
    if (urlMatch.startsWith('http')) {
      try {
        const url = new URL(urlMatch);
        const domain = url.hostname.replace('www.', '');
        return {
          displayName: entry.title || domain,
          url: urlMatch,
          isBook: false
        };
      } catch {
        // Invalid URL, use title
      }
    }
  }
  
  // Fallback to clean title
  return {
    displayName: cleanTitle(entry.title),
    url: entry.metadata?.source || entry.metadata?.source_url || null,
    isBook: false
  };
}

/**
 * Clean up title for display
 */
function cleanTitle(title: string): string {
  // Remove file extensions and clean up
  return title
    .replace(/\.pdf$/i, '')
    .replace(/^PDF:\s*/i, '')
    .replace(/\s*–\s*/g, ' - ')
    .trim();
}

/**
 * Format a source citation for inline text
 */
export function formatInlineCitation(entry: ContentEntry): string {
  const { displayName, url, isBook } = formatSourceReference(entry);
  
  if (url) {
    return `[${displayName}](${url})`;
  }
  
  return displayName;
}

/**
 * Check if entry is from a PDF/book source
 */
export function isBookSource(entry: ContentEntry): boolean {
  const { isBook } = formatSourceReference(entry);
  return isBook || entry.source?.type === 'pdf' || entry.id.includes('pdf');
}