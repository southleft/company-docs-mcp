/**
 * EmbeddingProvider — turns text into a vector.
 *
 * Implementations (Wave 2): Cloudflare Workers AI (1024-dim) and OpenAI
 * (1536-dim), wrapping the functions in ../lib/embedding-provider.ts.
 *
 * IMPORTANT — dimension coupling: `dimensions` is a hard contract. The vector
 * store column and the stored corpus must share this exact size. Changing the
 * embedding provider therefore requires re-embedding all content and migrating
 * the store schema; it is never a runtime-only switch. See VectorStore.init().
 */

export interface EmbeddingProvider {
	/** Stable selector id, e.g. "workers-ai" | "openai". */
	readonly id: string;
	/** Underlying model identifier, for logging and diagnostics. */
	readonly model: string;
	/** Output vector size. MUST equal the vector-store column dimension. */
	readonly dimensions: number;

	/** Embed a single string into a `dimensions`-length vector. */
	embed(text: string): Promise<number[]>;

	/**
	 * Optional batched embedding. When absent, callers fall back to mapping
	 * `embed` over the inputs.
	 */
	embedBatch?(texts: string[]): Promise<number[][]>;
}
