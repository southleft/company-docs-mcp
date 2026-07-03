/**
 * Cache — key/value response cache.
 *
 * Abstracts the Cloudflare KV usage in index.ts (env.CONTENT_CACHE) so that
 * non-Cloudflare hosts can supply an in-memory or Redis-backed cache instead.
 * A no-op implementation is a valid choice when caching is undesired.
 */

export interface CachePutOptions {
	/** Time-to-live in seconds. Omit for the implementation default. */
	ttlSeconds?: number;
}

export interface Cache {
	/** Stable selector id, e.g. "kv" | "memory" | "redis" | "none". */
	readonly id: string;

	/** Return the cached value, or null on miss/expiry/error. */
	get<T = unknown>(key: string): Promise<T | null>;

	/** Store a value. Failures should be swallowed (cache is best-effort). */
	put<T = unknown>(key: string, value: T, opts?: CachePutOptions): Promise<void>;

	/** Optional explicit invalidation. */
	delete?(key: string): Promise<void>;
}
