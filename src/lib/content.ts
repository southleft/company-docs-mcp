/**
 * Core types for MCP documentation content
 */

export type SourceType = 'pdf' | 'html' | 'url' | 'markdown';
export type Category = string; // Organizations can define their own categories
export type Confidence = 'high' | 'medium' | 'low';

export interface ContentSource {
  type: SourceType;
  location: string;
  ingested_at: string;
}

export interface ChunkMetadata {
  section?: string;
  page?: number;
  heading?: string;
  [key: string]: any; // Allow for additional metadata
}

export interface ContentChunk {
  id: string;
  text: string;
  metadata?: ChunkMetadata;
}

export interface ContentMetadata {
  category: Category;
  tags: string[];
  confidence: Confidence;
  version?: string;
  last_updated: string;
  author?: string;
  department?: string; // e.g., "Engineering", "Marketing", etc.
  [key: string]: any; // Allow for additional metadata
}

export interface ContentEntry {
  id: string;
  title: string;
  source: ContentSource;
  content: string;
  chunks: ContentChunk[];
  metadata: ContentMetadata;
}

export interface SearchOptions {
  query?: string;
  category?: Category;
  tags?: string[];
  confidence?: Confidence;
  limit?: number;
}

export interface IngestionOptions {
  source: string;
  type: SourceType;
  metadata?: Partial<ContentMetadata>;
  chunkSize?: number;
  overlapSize?: number;
}
