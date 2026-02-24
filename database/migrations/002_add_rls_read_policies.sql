-- Add RLS read policies for public documentation access
-- content_entries and content_chunks contain public documentation,
-- so anonymous (anon) role should be able to read them.

-- Ensure RLS is enabled (Supabase enables by default, but be explicit)
ALTER TABLE content_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;

-- Allow public read access to content_entries
CREATE POLICY "Allow public read access on content_entries"
  ON content_entries
  FOR SELECT
  USING (true);

-- Allow public read access to content_chunks
CREATE POLICY "Allow public read access on content_chunks"
  ON content_chunks
  FOR SELECT
  USING (true);
