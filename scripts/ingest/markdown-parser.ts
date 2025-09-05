/**
 * Markdown content parser for extracting documentation content
 */

import { ContentEntry, ContentMetadata, SourceType, ContentChunk } from '../../src/lib/content';
import * as crypto from 'node:crypto';

export interface MarkdownParseOptions {
  metadata?: Partial<ContentMetadata>;
  chunkSize?: number;
  overlapSize?: number;
}

/**
 * Generates a unique ID for content entries
 */
function generateId(): string {
  return crypto.randomBytes(12).toString('base64url');
}

/**
 * Chunks text content by sections/paragraphs
 */
function chunkBySection(
  content: string, 
  options: { chunkSize?: number; overlapSize?: number } = {}
): ContentChunk[] {
  const chunkSize = options.chunkSize || 2000;
  const overlapSize = options.overlapSize || 200;
  
  const chunks: ContentChunk[] = [];
  const sections = content.split(/\n#{1,6}\s+/); // Split by markdown headers
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const section of sections) {
    // If adding this section would exceed chunk size, save current chunk
    if (currentChunk.length > 0 && currentChunk.length + section.length > chunkSize) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        metadata: {
          section: `Section ${chunkIndex + 1}`,
        }
      });
      
      // Start new chunk with overlap from previous
      currentChunk = currentChunk.slice(-overlapSize) + '\n\n' + section;
      chunkIndex++;
    } else {
      // Add to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    }
  }
  
  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push({
      id: `chunk_${chunkIndex}`,
      text: currentChunk.trim(),
      metadata: {
        section: `Section ${chunkIndex + 1}`,
      }
    });
  }
  
  // If no chunks were created, create one with all content
  if (chunks.length === 0 && content.trim()) {
    chunks.push({
      id: 'chunk_0',
      text: content.trim(),
      metadata: {
        section: 'Full Document',
      }
    });
  }
  
  return chunks;
}

/**
 * Extract title from markdown content
 */
function extractTitle(content: string, filepath: string): string {
  // Try to find H1 header
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  // Try to find any header
  const headerMatch = content.match(/^#{1,6}\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }
  
  // Use filename as fallback
  const filename = filepath.split('/').pop() || 'Untitled';
  return filename.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

/**
 * Extract metadata hints from markdown content
 */
function extractMetadataFromContent(content: string): Partial<ContentMetadata> {
  const metadata: Partial<ContentMetadata> = {};
  const contentLower = content.toLowerCase();
  
  // Try to detect category
  if (contentLower.includes('component') || contentLower.includes('button') ||
      contentLower.includes('form') || contentLower.includes('card')) {
    metadata.category = 'components';
  } else if (contentLower.includes('token') || contentLower.includes('color') ||
             contentLower.includes('spacing') || contentLower.includes('typography')) {
    metadata.category = 'tokens';
  } else if (contentLower.includes('pattern') || contentLower.includes('layout')) {
    metadata.category = 'patterns';
  } else if (contentLower.includes('guide') || contentLower.includes('tutorial') ||
             contentLower.includes('getting started')) {
    metadata.category = 'guides';
  } else if (contentLower.includes('api') || contentLower.includes('reference')) {
    metadata.category = 'reference';
  }
  
  // Extract potential tags
  const tags: string[] = [];
  
  // Look for common design system terms
  const tagPatterns = [
    /\b(button|input|form|card|modal|dropdown|nav|header|footer|table|list)\b/gi,
    /\b(color|spacing|typography|shadow|border|radius|font|theme)\b/gi,
    /\b(responsive|mobile|desktop|tablet|accessibility|a11y|wcag)\b/gi,
    /\b(react|vue|angular|svelte|web components?)\b/gi,
    /\b(design system|component library|style guide|pattern library)\b/gi,
  ];
  
  for (const pattern of tagPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      tags.push(...matches.map(m => m.toLowerCase().replace(/\s+/g, '-')));
    }
  }
  
  // Also extract tags from headers
  const headers = content.match(/^#{1,6}\s+(.+)$/gm);
  if (headers) {
    for (const header of headers) {
      const cleanHeader = header.replace(/^#{1,6}\s+/, '').toLowerCase();
      if (cleanHeader.length > 3 && cleanHeader.length < 30) {
        tags.push(cleanHeader.replace(/[^a-z0-9]+/g, '-'));
      }
    }
  }
  
  // Unique tags, limited to top 15
  metadata.tags = [...new Set(tags)]
    .filter(tag => tag.length > 2)
    .slice(0, 15);
  
  // Set confidence based on content quality indicators
  const hasHeaders = /^#{1,6}\s+/m.test(content);
  const hasCodeBlocks = /```[\s\S]*?```/.test(content);
  const hasLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(content);
  const wordCount = content.split(/\s+/).length;
  
  if (wordCount > 500 && hasHeaders && (hasCodeBlocks || hasLinks)) {
    metadata.confidence = 'high';
  } else if (wordCount > 200 && hasHeaders) {
    metadata.confidence = 'medium';
  } else {
    metadata.confidence = 'low';
  }
  
  return metadata;
}

/**
 * Parse markdown content and create a ContentEntry
 */
export async function parseMarkdown(
  markdownContent: string,
  sourcePath: string,
  options: MarkdownParseOptions = {}
): Promise<ContentEntry> {
  // Extract title
  const title = extractTitle(markdownContent, sourcePath);
  
  // Extract metadata hints
  const extractedMetadata = extractMetadataFromContent(markdownContent);
  
  // Process content - clean up but preserve markdown structure
  let processedContent = markdownContent
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove excessive blank lines
    .replace(/\n{4,}/g, '\n\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
  
  // Create chunks
  const chunks = chunkBySection(processedContent, {
    chunkSize: options.chunkSize,
    overlapSize: options.overlapSize,
  });
  
  // Build the content entry
  const entry: ContentEntry = {
    id: generateId(),
    title,
    source: {
      type: 'markdown' as SourceType,
      location: sourcePath,
      ingested_at: new Date().toISOString(),
    },
    content: processedContent,
    chunks,
    metadata: {
      category: 'general',
      tags: [],
      confidence: 'medium',
      last_updated: new Date().toISOString(),
      ...extractedMetadata,
      ...options.metadata,
    },
  };
  
  return entry;
}
