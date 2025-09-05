/**
 * Text chunking utilities for content processing
 */

import { ContentChunk } from './content';

export interface ChunkOptions {
  chunkSize?: number;
  overlapSize?: number;
}

/**
 * Chunks text content by sections/paragraphs
 */
export function chunkBySection(
  content: string,
  options: ChunkOptions = {}
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
 * Chunks text by fixed size with overlap
 */
export function chunkBySize(
  text: string,
  chunkSize: number = 1000,
  overlapSize: number = 100
): string[] {
  const chunks: string[] = [];
  
  if (text.length <= chunkSize) {
    return [text];
  }
  
  let position = 0;
  while (position < text.length) {
    // Calculate end position
    let end = Math.min(position + chunkSize, text.length);
    
    // Try to break at a sentence or word boundary
    if (end < text.length) {
      // Look for sentence end
      const sentenceEnd = text.lastIndexOf('. ', end);
      if (sentenceEnd > position + chunkSize * 0.8) {
        end = sentenceEnd + 1;
      } else {
        // Look for word boundary
        const wordEnd = text.lastIndexOf(' ', end);
        if (wordEnd > position + chunkSize * 0.8) {
          end = wordEnd;
        }
      }
    }
    
    chunks.push(text.slice(position, end).trim());
    
    // Move position with overlap
    position = end - overlapSize;
    if (position < 0) position = end;
  }
  
  return chunks;
}

/**
 * Chunks text by sentences
 */
export function chunkBySentences(
  text: string,
  sentencesPerChunk: number = 3
): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  
  for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
    const chunk = sentences
      .slice(i, i + sentencesPerChunk)
      .join(' ')
      .trim();
    
    if (chunk) {
      chunks.push(chunk);
    }
  }
  
  return chunks.length > 0 ? chunks : [text];
}
