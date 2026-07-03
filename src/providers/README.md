# Provider Plugin System

Swappable backends for the four infrastructure seams, so a team can run this on
their own stack instead of being locked to Cloudflare Workers + Workers AI +
Supabase.

> **Status: Wave 2 — live.** The built-in backends (Supabase, Workers AI,
> OpenAI, KV/memory caches) are implemented in [`impl/`](./impl) and registered
> by default when this barrel is imported. The runtime search path
> (`lib/search-handler.ts`), the AI chat handler, and the `/search` response
> cache all resolve their backends through `resolveContainer(env)`. Wave 3
> adds an Anthropic ChatProvider; Wave 4 the re-embed/migration runbook for
> switching embedding providers.

## The four seams

| Registry | Interface | Selector env var | Default |
|----------|-----------|------------------|---------|
| `embeddingRegistry` | [`EmbeddingProvider`](./embedding.ts) | `EMBEDDING_PROVIDER` | `openai` if `OPENAI_API_KEY` else `workers-ai` |
| `vectorStoreRegistry` | [`VectorStore`](./vector-store.ts) | `VECTOR_STORE` | `supabase` |
| `chatRegistry` | [`ChatProvider`](./chat.ts) | `CHAT_PROVIDER` | `openai` |
| `cacheRegistry` | [`Cache`](./cache.ts) | `CACHE` | `kv` if `CONTENT_CACHE` binding else `memory` |

## Using a container

```ts
import { resolveContainer } from "./providers";

const services = resolveContainer(env);        // auto-detect from env (lazy per seam)
const hits = await services.vectorStore.search({ queryText, limit: 5 });
const answer = await services.chat.chat({ messages });
```

## Adding a provider

1. Implement the interface for the seam.
2. Register a factory under a stable id:
   ```ts
   import { vectorStoreRegistry } from "./providers";
   vectorStoreRegistry.register("pinecone", (config) => new PineconeStore(config));
   ```
3. Select it via the seam's env var (`VECTOR_STORE=pinecone`).

No core code changes — selection is by id.

## The one cross-cutting rule: embedding dimension ↔ store schema

`EmbeddingProvider.dimensions` (1024 for Workers AI, 1536 for OpenAI) must match
the vector-store column the corpus was written with. Switching embedding
providers is **not** a runtime flip — it requires re-embedding all content and
migrating the store via [`VectorStore.init({ dimensions })`](./vector-store.ts).
A migration/re-embed runbook lands in Wave 4.
