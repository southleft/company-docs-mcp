-- Migration: Add content_hash column for incremental ingestion
-- This column stores a SHA-256 hash of (title + content) so that
-- the ingest script can skip entries that haven't changed.

ALTER TABLE content_entries
  ADD COLUMN IF NOT EXISTS content_hash TEXT;
