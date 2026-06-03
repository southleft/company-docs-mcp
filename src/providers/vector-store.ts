/**
 * VectorStore — read/write access to the embedded document corpus.
 *
 * This interface absorbs the Supabase calls currently duplicated across
 * search-handler.ts, index.ts and the ingest scripts (createClient +
 * rpc('search_content') + from('content_entries') + row→ContentEntry mapping).
 *
 * Implementations (Wave 2+): Supabase/pgvector (existing), pgvector-direct,
 * Pinecone, Qdrant, etc. Backend-specific concerns (the `search_content`
 * Postgres function, row shape) stay inside each adapter.
 */

import type { ContentEntry, Category } from "./types";

export interface VectorSearchParams {
	/** Pre-computed query embedding for vector search. */
	queryEmbedding?: number[];
	/** Raw query text, for keyword/hybrid fallback inside the store. */
	queryText?: string;
	/** Minimum similarity score (0–1) for a row to qualify. */
	threshold?: number;
	/** Max rows to return. */
	limit?: number;
	/** Restrict to a single category. */
	category?: Category;
	/** Restrict to rows containing these tags. */
	tags?: string[];
}

export interface VectorStore {
	/** Stable selector id, e.g. "supabase" | "pgvector" | "pinecone". */
	readonly id: string;
	/**
	 * Embedding dimension this store is provisioned for, when known. Used to
	 * detect a mismatch against the active EmbeddingProvider before querying.
	 */
	readonly dimensions?: number;

	/** Similarity (and/or keyword) search returning domain entries. */
	search(params: VectorSearchParams): Promise<ContentEntry[]>;

	/** All entries in a category, ordered for browsing. */
	getByCategory(category: Category): Promise<ContentEntry[]>;

	/** Distinct set of tags across the corpus. */
	getAllTags(): Promise<string[]>;

	/** Insert or update a single entry (ingest write path). */
	upsertEntry(entry: ContentEntry): Promise<void>;

	/**
	 * Provision or migrate the backing schema for a given embedding dimension.
	 * Optional: file/in-memory stores may be schemaless. This is where the
	 * embedding↔store dimension contract is enforced.
	 */
	init?(opts: { dimensions: number }): Promise<void>;

	/** Lightweight connectivity/readiness probe. */
	healthCheck(): Promise<boolean>;
}
