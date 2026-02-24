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
 * Parsed YAML frontmatter result
 */
interface FrontmatterResult {
  /** Parsed key-value data from frontmatter */
  data: Record<string, unknown>;
  /** Content with frontmatter stripped */
  content: string;
}

/**
 * Parse a simple YAML value (string, number, boolean, or bracket-syntax array).
 * Handles only the subset of YAML used in documentation frontmatter.
 */
function parseYamlValue(raw: string): unknown {
  const trimmed = raw.trim();

  // Empty value
  if (trimmed === '' || trimmed === '~' || trimmed === 'null') {
    return null;
  }

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Bracket-syntax array: [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(item => {
      const val = item.trim();
      // Strip surrounding quotes from array items
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        return val.slice(1, -1);
      }
      return val;
    });
  }

  // Number (integer or float)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // Quoted string — strip quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Plain string
  return trimmed;
}

/**
 * Extract and parse YAML frontmatter from markdown content.
 * Frontmatter must start at the very beginning of the file with '---'.
 * Returns parsed data and the content with frontmatter removed.
 * If no frontmatter is found, returns empty data and the original content.
 */
function parseFrontmatter(content: string): FrontmatterResult {
  // Frontmatter must start at position 0 with '---'
  if (!content.startsWith('---')) {
    return { data: {}, content };
  }

  // Find the closing '---' delimiter (must be on its own line)
  const closingIndex = content.indexOf('\n---', 3);
  if (closingIndex === -1) {
    return { data: {}, content };
  }

  const frontmatterBlock = content.slice(3, closingIndex).trim();
  // Content starts after the closing '---' and its newline
  const remainingContent = content.slice(closingIndex + 4).replace(/^\n+/, '');

  const data: Record<string, unknown> = {};

  for (const line of frontmatterBlock.split('\n')) {
    // Skip empty lines and comments
    const trimmedLine = line.trim();
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      continue;
    }

    // Match key: value pairs
    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmedLine.slice(0, colonIndex).trim();
    const rawValue = trimmedLine.slice(colonIndex + 1);

    if (key) {
      data[key] = parseYamlValue(rawValue);
    }
  }

  return { data, content: remainingContent };
}

/**
 * Generates a deterministic ID from a file path.
 * Same file always produces the same ID, preventing duplicates on re-ingestion.
 */
function generateIdFromPath(filepath: string): string {
  const basename = filepath.split('/').pop() || filepath;
  const slug = basename
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Short hash for uniqueness in case two files slug to the same thing
  const hash = crypto.createHash('sha256').update(filepath).digest('base64url').slice(0, 8);
  return `${slug}-${hash}`;
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
 * Parse markdown content and create a ContentEntry.
 *
 * Metadata priority (highest to lowest):
 *   1. YAML frontmatter values (author's explicit intent)
 *   2. CLI options.metadata (when explicitly provided)
 *   3. Content-based auto-detection heuristics
 *   4. Defaults
 */
export async function parseMarkdown(
  markdownContent: string,
  sourcePath: string,
  options: MarkdownParseOptions = {}
): Promise<ContentEntry> {
  // ── 1. Parse YAML frontmatter ─────────────────────────────
  const { data: frontmatter, content: contentWithoutFrontmatter } =
    parseFrontmatter(markdownContent);

  // ── 2. Extract title ──────────────────────────────────────
  // Frontmatter title wins, then H1 header, then filename
  const title =
    (typeof frontmatter.title === 'string' && frontmatter.title) ||
    extractTitle(contentWithoutFrontmatter, sourcePath);

  // ── 3. Extract content-based metadata heuristics ──────────
  const extractedMetadata = extractMetadataFromContent(contentWithoutFrontmatter);

  // ── 4. Process content (frontmatter already stripped) ─────
  const processedContent = contentWithoutFrontmatter
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove excessive blank lines
    .replace(/\n{4,}/g, '\n\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();

  // ── 5. Create chunks ─────────────────────────────────────
  const chunks = chunkBySection(processedContent, {
    chunkSize: options.chunkSize,
    overlapSize: options.overlapSize,
  });

  // ── 6. Merge tags (frontmatter first, then auto-detected, deduplicated) ──
  const frontmatterTags: string[] = Array.isArray(frontmatter.tags)
    ? (frontmatter.tags as unknown[]).map(t => String(t))
    : [];
  const autoTags: string[] = extractedMetadata.tags || [];
  const cliTags: string[] = options.metadata?.tags || [];
  const mergedTags = [...new Set([...frontmatterTags, ...cliTags, ...autoTags])];

  // ── 7. Resolve category with priority ordering ────────────
  // Frontmatter > CLI (explicit only) > auto-detected > default
  const resolvedCategory: string =
    (typeof frontmatter.category === 'string' && frontmatter.category) ||
    options.metadata?.category ||
    extractedMetadata.category ||
    'documentation';

  // ── 8. Build additional metadata from frontmatter ─────────
  const frontmatterMeta: Record<string, unknown> = {};
  if (typeof frontmatter.description === 'string') {
    frontmatterMeta.description = frontmatter.description;
  }
  if (typeof frontmatter.source === 'string') {
    frontmatterMeta.source_file = frontmatter.source;
  }
  if (typeof frontmatter.figma === 'string') {
    frontmatterMeta.figma = frontmatter.figma;
  }
  if (typeof frontmatter.status === 'string') {
    frontmatterMeta.status = frontmatter.status;
  }
  if (typeof frontmatter.version === 'string' || typeof frontmatter.version === 'number') {
    frontmatterMeta.version = String(frontmatter.version);
  }
  if (typeof frontmatter.author === 'string') {
    frontmatterMeta.author = frontmatter.author;
  }
  if (typeof frontmatter.department === 'string') {
    frontmatterMeta.department = frontmatter.department;
  }

  // ── 9. Build the content entry ────────────────────────────
  const entry: ContentEntry = {
    id: generateIdFromPath(sourcePath),
    title,
    source: {
      type: 'markdown' as SourceType,
      location: sourcePath,
      ingested_at: new Date().toISOString(),
    },
    content: processedContent,
    chunks,
    metadata: {
      confidence: 'medium',
      last_updated: new Date().toISOString(),
      // Layer metadata: auto-detected → CLI → frontmatter (highest priority)
      ...extractedMetadata,
      ...options.metadata,
      ...frontmatterMeta,
      // Resolved category and merged tags override all layers
      category: resolvedCategory,
      tags: mergedTags,
    },
  };

  return entry;
}
