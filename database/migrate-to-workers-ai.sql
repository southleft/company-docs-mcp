-- ============================================================================
-- Migration: OpenAI (1536) → Workers AI (1024)
--
-- Run this if you have an existing database using OpenAI embeddings and want
-- to switch to Workers AI. After running this migration, re-ingest your
-- content with: npx company-docs publish --clear
--
-- WARNING: This drops all existing embeddings. You MUST re-ingest content
-- after running this migration because Workers AI and OpenAI produce
-- incompatible embedding vectors.
-- ============================================================================

-- Step 1: Drop dependent views and indexes (they reference the embedding column)
DROP VIEW IF EXISTS search_analytics;
DROP INDEX IF EXISTS idx_entries_embedding;
DROP INDEX IF EXISTS idx_chunks_embedding;

-- Step 2: Clear existing embeddings (incompatible dimensions)
UPDATE content_entries SET embedding = NULL;
UPDATE content_chunks SET embedding = NULL;

-- Step 3: Alter columns to new dimension
ALTER TABLE content_entries ALTER COLUMN embedding TYPE vector(1024);
ALTER TABLE content_chunks ALTER COLUMN embedding TYPE vector(1024);

-- Step 3b: Recreate the analytics view
CREATE OR REPLACE VIEW search_analytics AS
SELECT
  COUNT(*) AS total_entries,
  COUNT(embedding) AS entries_with_embeddings,
  COUNT(*) FILTER (WHERE category IS NOT NULL) AS categorized_entries,
  ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) AS embedding_coverage_percent,
  ARRAY_AGG(DISTINCT category) AS categories,
  (SELECT COUNT(*) FROM content_chunks) AS total_chunks
FROM content_entries;

-- Step 4: Recreate HNSW indexes
CREATE INDEX idx_entries_embedding ON content_entries
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_embedding ON content_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Step 5: Update search functions to accept the new dimension

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
