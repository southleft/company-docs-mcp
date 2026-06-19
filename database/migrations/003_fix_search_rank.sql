-- ============================================================================
-- Migration 003 — Fix search_content() hybrid ranking
--
-- BUG
-- ---
-- The hybrid (vector + full-text) rank formula PENALIZED the document that
-- matched the text query. A text-matching row was scored:
--       similarity * 0.7 + ts_rank * 0.3
-- while every non-matching row kept its FULL similarity. Because ts_rank values
-- are small (~0.05), the 0.3 weight never makes up for the 0.3 of similarity
-- that is thrown away — so the single most relevant document (the one that
-- matched both the vector AND the text) ranked BELOW documents that matched
-- neither. With template-similar corpora (e.g. component docs that all share
-- Overview / Anatomy / Props sections and cluster tightly in embedding space),
-- the target document was pushed out of the top-N entirely. The chat then
-- answered from adjacent docs and concluded the real one was "not documented".
--
-- Measured impact (real corpus, searching each doc by its own title):
--       searched_for   old rank   new rank
--       Accordion      #10/10  ->  #1
--       Badge          #10/10  ->  #1
--       Alert          #10/10  ->  #1
--       Checkbox        #9/10  ->  #1
--       Tag             #8/10  ->  #1
--       Button          #4/10  ->  #1
--
-- FIX
-- ---
-- Vector similarity is the base score; a text match is a small positive BOOST,
-- never a penalty. Pure-vector ranking already orders these results correctly,
-- so the text signal now only acts as a tie-breaker / relevance bump.
--
-- This is an idempotent CREATE OR REPLACE. Existing deployments must run this
-- migration to pick up the fix — editing the source schema does not change a
-- database that has already been provisioned.
-- ============================================================================

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
    -- Base = vector similarity; text match is a positive boost, never a penalty.
    (v.similarity + 0.15 * COALESCE(t.text_rank, 0)) AS rank
  FROM vector_results v
  LEFT JOIN text_results t ON v.id = t.id
  WHERE v.similarity >= match_threshold
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- Validation (optional). Searching for a document by its own title should rank
-- that document #1. Before this migration it frequently ranked last.
--
--   WITH p AS (SELECT embedding FROM content_entries WHERE title = '<DocTitle>' LIMIT 1)
--   SELECT s.title, round(s.rank::numeric, 3) AS rank
--   FROM p, search_content(p.embedding, '<DocTitle>', 0.15, 5) AS s;
--
-- Expect '<DocTitle>' as the first row.
-- ----------------------------------------------------------------------------
