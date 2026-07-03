# Switching Embedding Providers (Re-Embed Runbook)

Embedding vectors are only comparable when the query and the stored corpus
come from the **same model with the same dimension count**. The two built-in
providers are not interchangeable at runtime:

| Provider (`EMBEDDING_PROVIDER`) | Model | Dimensions |
|---|---|---|
| `workers-ai` (default) | `@cf/baai/bge-large-en-v1.5` | **1024** |
| `openai` | `text-embedding-3-small` | **1536** |

Flipping the env var without migrating the database makes every search fail
(the `search_content` RPC rejects mismatched vector sizes) or, worse, silently
return garbage similarity scores. Switching providers is a **migration**, not
a config change. Expect a few minutes of downtime for search on the affected
deployment, or run the migration against a fresh database and cut over.

## Prerequisites

- Your content sources are re-ingestable: the original files under
  `content/entries/` (or the URLs/PDFs/markdown you ingested from). The
  migration re-embeds from source content — vectors cannot be converted
  between models.
- Credentials for the **target** provider (`OPENAI_API_KEY`, or the Workers AI
  binding / `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` for CLI use).

## Steps

### 1. Update the vector columns

The schema's `vector(N)` columns and the `search_content` / `search_chunks`
function signatures are dimension-specific. Run this SQL against your Supabase
project (via the SQL editor or `psql`), replacing `NEW_DIM` with the target
dimension (1536 for openai, 1024 for workers-ai):

```sql
-- Dropping the embeddings is required: vectors from the old model are
-- meaningless to the new one, and the column type must change anyway.
ALTER TABLE content_entries DROP COLUMN embedding;
ALTER TABLE content_entries ADD COLUMN embedding vector(NEW_DIM);

ALTER TABLE content_chunks DROP COLUMN embedding;
ALTER TABLE content_chunks ADD COLUMN embedding vector(NEW_DIM);

-- Recreate the vector indexes (names may differ; check \di)
CREATE INDEX ON content_entries USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON content_chunks USING ivfflat (embedding vector_cosine_ops);
```

Then re-apply the search functions with the new dimension. The canonical
definitions live in `database/schema.sql` (1024-dim) — copy the
`search_content` and `search_chunks` definitions and change
`vector(1024)` to `vector(NEW_DIM)` in their signatures.

### 2. Point the environment at the new provider

```bash
# .env (CLI/ingestion) and Worker vars/secrets
EMBEDDING_PROVIDER=openai        # or workers-ai
OPENAI_API_KEY=sk-...            # if switching to openai
```

Remember the Worker deployment has its own copy of these
(`wrangler.toml` vars / `wrangler secret put`).

### 3. Re-embed the corpus

```bash
npm run ingest:fresh    # clears existing rows and re-ingests with new embeddings
```

For large corpora, `npm run ingest:preview` first shows what will be processed
and estimates cost. OpenAI `text-embedding-3-small` costs ~$0.02 per million
tokens; Workers AI embedding is included in Cloudflare's Workers AI pricing.

### 4. Verify

```bash
npm test                          # unit tests
npm run dev                       # then exercise a few searches:
curl -s -X POST http://localhost:8787/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"<a doc you know exists>","limit":3}'
```

Confirm the entry you searched for ranks near the top. If the RPC errors with
a dimension mismatch, step 1 and step 3 disagree about `NEW_DIM`.

## Notes

- **MCP clients are unaffected by chat-provider settings** — only
  `EMBEDDING_PROVIDER` and the vector store matter for search quality.
- The `VectorStore` interface exposes `dimensions` and an optional
  `init({ dimensions })` hook; the Supabase adapter reports the schema
  dimension so a mismatched embedder can be detected before querying. A
  future wave may automate step 1 through `init()`, but DDL against your
  database is deliberately manual for now.
