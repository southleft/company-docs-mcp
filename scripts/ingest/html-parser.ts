/**
 * HTML content parser for extracting design system knowledge
 */

import { ContentEntry, ContentMetadata, SourceType } from "../../src/lib/content";
import { chunkBySection } from "../../src/lib/chunker";
import { generateId } from "../../src/lib/id-generator";
import * as cheerio from 'cheerio';

export interface HTMLParseOptions {
  metadata?: Partial<ContentMetadata>;
  chunkSize?: number;
  overlapSize?: number;
}

/**
 * Extracts text content from HTML, preserving structure
 */
export async function parseHTML(
  htmlContent: string,
  sourcePath: string,
  options: HTMLParseOptions = {}
): Promise<ContentEntry> {
  // Load HTML with cheerio
  const $ = cheerio.load(htmlContent);
  
  // Remove unwanted elements entirely
  $('script').remove();
  $('style').remove();
  $('noscript').remove();
  $('svg').remove();
  $('iframe').remove();
  $('img').remove(); // Remove images as they don't contribute text
  
  // Don't remove elements based on classes or styles - just extract their text
  // Many modern frameworks use these extensively
  
  // Extract title
  const title = $('title').text() || $('h1').first().text() || 'Untitled Document';
  
  // Build structured content
  const contentParts: string[] = [];
  const seenTexts = new Set<string>(); // Track seen text to avoid duplicates
  
  // Extract main content areas
  const mainContent = $('main, article, [role="main"]').first();
  const contentRoot = mainContent.length > 0 ? mainContent : $('body');
  
  // First, extract all headings to maintain structure
  $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();
    const text = $elem.text().trim();
    
    // Skip empty or already seen
    if (!text || seenTexts.has(text)) return;
    seenTexts.add(text);
    
    // Format based on tag type
    switch(tagName) {
      case 'h1':
        contentParts.push(`\n# ${text}\n`);
        break;
      case 'h2':
        contentParts.push(`\n## ${text}\n`);
        break;
      case 'h3':
        contentParts.push(`\n### ${text}\n`);
        break;
      case 'h4':
        contentParts.push(`\n#### ${text}\n`);
        break;
      case 'h5':
        contentParts.push(`\n##### ${text}\n`);
        break;
      case 'h6':
        contentParts.push(`\n###### ${text}\n`);
        break;
    }
  });
  
  // Then extract paragraphs and list items
  $('p, li, td, th, div').each((_, elem) => {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();
    
    // Get direct text content (not from children to avoid duplication)
    const directText = $elem.clone().children().remove().end().text().trim();
    
    // Skip empty, very short, already seen, or numeric-only content
    if (!directText || directText.length < 3 || seenTexts.has(directText)) return;
    if (directText.match(/^[0-9.:,\s\/\-]+$/)) return;
    
    seenTexts.add(directText);
    
    // Format based on tag type
    if (tagName === 'li') {
      contentParts.push(`• ${directText}`);
    } else {
      contentParts.push(directText);
    }
  });
  
  // Extract links separately
  const links: string[] = [];
  $('a[href]').each((_, elem) => {
    const $elem = $(elem);
    const href = $elem.attr('href');
    const text = $elem.text().trim();
    
    if (href && text && text.length > 1) {
      // Skip anchor links and javascript links
      if (!href.startsWith('#') && !href.startsWith('javascript:')) {
        links.push(`[${text}](${href})`);
      }
    }
  });
  
  // Combine content
  let textContent = contentParts.join('\n');
  
  // Add links section if we have links
  if (links.length > 0) {
    // Deduplicate links
    const uniqueLinks = [...new Set(links)];
    textContent += '\n\n## Links\n' + uniqueLinks.join('\n');
  }
  
  // Clean up the final text
  textContent = textContent
    // Remove excessive newlines
    .replace(/\n{4,}/g, '\n\n\n')
    // Remove excessive spaces
    .replace(/[ \t]{2,}/g, ' ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
  
  // Final cleaning
  textContent = cleanText(textContent);

  // Extract metadata hints from content
  const extractedMetadata = extractMetadataFromContent(textContent);

  // Create chunks
  const chunks = chunkBySection(textContent, {
    chunkSize: options.chunkSize,
    overlapSize: options.overlapSize,
  });

  // Build the entry
  const entry: ContentEntry = {
    id: generateId(),
    title,
    source: {
      type: 'html' as SourceType,
      location: sourcePath,
      ingested_at: new Date().toISOString(),
    },
    content: textContent,
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

/**
 * Cleans text by decoding HTML entities and normalizing whitespace
 */
function cleanText(text: string): string {
  return text
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Attempts to extract metadata from the content itself
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
  } else if (contentLower.includes('workflow') || contentLower.includes('process')) {
    metadata.category = 'workflows';
  } else if (contentLower.includes('guideline') || contentLower.includes('principle')) {
    metadata.category = 'guidelines';
  }

  // Extract potential tags
  const tags: string[] = [];
  const tagPatterns = [
    /\b(button|input|form|card|modal|dropdown|nav|header|footer)\b/gi,
    /\b(color|spacing|typography|shadow|border|radius)\b/gi,
    /\b(responsive|mobile|desktop|tablet|accessibility|a11y)\b/gi,
  ];

  for (const pattern of tagPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      tags.push(...matches.map(m => m.toLowerCase()));
    }
  }

  metadata.tags = [...new Set(tags)].slice(0, 10); // Unique tags, max 10

  return metadata;
}
