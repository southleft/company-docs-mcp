-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Embedding Dimension Configuration
--
-- Default: 1024 (Workers AI — @cf/baai/bge-large-en-v1.5)
--
-- If using OpenAI embeddings (text-embedding-3-small), change all occurrences
-- of vector(1024) below to vector(1536).
--
-- The dimension MUST match the embedding provider configured in your .env file.
-- Mixing dimensions (e.g. ingesting with Workers AI then querying with OpenAI)
-- will cause search errors.
-- ============================================================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS content_chunks CASCADE;
DROP TABLE IF EXISTS content_entries CASCADE;

-- Main content entries table
CREATE TABLE content_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT,
  source_location TEXT,
  category TEXT,
  system_name TEXT,
  tags TEXT[],
  confidence TEXT,
  embedding vector(1024),
  metadata JSONB,
  content_hash TEXT, -- SHA-256 hash for incremental ingestion
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  search_text tsvector
);

-- Content chunks for granular search
CREATE TABLE content_chunks (
  id SERIAL PRIMARY KEY,
  entry_id TEXT REFERENCES content_entries(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1024),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, chunk_index)
);

-- Indexes for performance
CREATE INDEX idx_entries_embedding ON content_entries
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_embedding ON content_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_entries_category ON content_entries(category);
CREATE INDEX idx_entries_confidence ON content_entries(confidence);
CREATE INDEX idx_entries_tags ON content_entries USING GIN(tags);
CREATE INDEX idx_entries_search_text ON content_entries USING GIN(search_text);
CREATE INDEX idx_entries_metadata ON content_entries USING GIN(metadata);

-- Function for hybrid search (vector + full-text)
CREATE OR REPLACE FUNCTION search_content(
  query_embedding vector(1024),
  query_text TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_category TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  category TEXT,
  tags TEXT[],
  confidence TEXT,
  similarity FLOAT,
  rank FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      e.id,
      e.title,
      e.content,
      e.category,
      e.tags,
      e.confidence,
      1 - (e.embedding <=> query_embedding) AS similarity
    FROM content_entries e
    WHERE
      (filter_category IS NULL OR e.category = filter_category)
      AND (filter_tags IS NULL OR e.tags && filter_tags)
      AND e.embedding IS NOT NULL
  ),
  text_results AS (
    SELECT
      e.id,
      ts_rank(e.search_text, plainto_tsquery('english', query_text)) AS text_rank
    FROM content_entries e
    WHERE
      query_text IS NOT NULL
      AND e.search_text @@ plainto_tsquery('english', query_text)
  )
  SELECT
    v.id,
    v.title,
    v.content,
    v.category,
    v.tags,
    v.confidence,
    v.similarity,
    CASE
      WHEN query_text IS NOT NULL AND t.text_rank IS NOT NULL THEN
        (v.similarity * 0.7 + t.text_rank * 0.3)
      ELSE v.similarity
    END AS rank
  FROM vector_results v
  LEFT JOIN text_results t ON v.id = t.id
  WHERE v.similarity >= match_threshold
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- Function for chunk-level search
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(1024),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  entry_id TEXT,
  entry_title TEXT,
  chunk_index INTEGER,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.entry_id,
    e.title AS entry_title,
    c.chunk_index,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM content_chunks c
  JOIN content_entries e ON c.entry_id = e.id
  WHERE c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to find similar entries
CREATE OR REPLACE FUNCTION find_similar_entries(
  target_id TEXT,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  target_embedding vector(1024);
BEGIN
  -- Get the embedding of the target entry
  SELECT embedding INTO target_embedding
  FROM content_entries
  WHERE content_entries.id = target_id;

  IF target_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.category,
    1 - (e.embedding <=> target_embedding) AS similarity
  FROM content_entries e
  WHERE e.id != target_id
    AND e.embedding IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Analytics view for monitoring
CREATE OR REPLACE VIEW search_analytics AS
SELECT
  COUNT(*) AS total_entries,
  COUNT(embedding) AS entries_with_embeddings,
  COUNT(*) FILTER (WHERE category IS NOT NULL) AS categorized_entries,
  ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) AS embedding_coverage_percent,
  ARRAY_AGG(DISTINCT category) AS categories,
  (SELECT COUNT(*) FROM content_chunks) AS total_chunks
FROM content_entries;

-- Function to update search_text
CREATE OR REPLACE FUNCTION update_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.content, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search_text
CREATE TRIGGER update_search_text_trigger
  BEFORE INSERT OR UPDATE ON content_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_search_text();

-- Trigger to update timestamps
CREATE TRIGGER update_entries_timestamp
  BEFORE UPDATE ON content_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security — allow public read access to documentation content
ALTER TABLE content_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to content_entries"
  ON content_entries FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to content_chunks"
  ON content_chunks FOR SELECT
  USING (true);
