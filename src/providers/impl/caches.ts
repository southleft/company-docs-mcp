/**
 * Cache implementations (Wave 2).
 *
 *   kv     — Cloudflare KV binding (CONTENT_CACHE); survives across isolates
 *   memory — per-process Map with TTL; right default outside Cloudflare
 *   none   — explicit no-op for deployments that don't want caching
 */

import type { Cache, CachePutOptions } from "../cache";
import { ProviderError } from "../types";
import type { ProviderConfig } from "../types";

const DEFAULT_TTL_SECONDS = 300;

export function createKvCache(config: ProviderConfig): Cache {
	const kv = config.CONTENT_CACHE as
		| { get(key: string, type: "text"): Promise<string | null>; put(key: string, value: string, opts?: any): Promise<void>; delete(key: string): Promise<void> }
		| undefined;

	if (!kv) {
		throw new ProviderError(
			"kv cache requires a CONTENT_CACHE KV namespace binding",
			"kv",
		);
	}

	return {
		id: "kv",
		async get<T>(key: string): Promise<T | null> {
			try {
				const raw = await kv.get(key, "text");
				return raw ? (JSON.parse(raw) as T) : null;
			} catch {
				return null;
			}
		},
		async put<T>(key: string, value: T, opts?: CachePutOptions): Promise<void> {
			try {
				await kv.put(key, JSON.stringify(value), {
					expirationTtl: opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS,
				});
			} catch {
				// Cache writes are best-effort
			}
		},
		async delete(key: string): Promise<void> {
			try {
				await kv.delete(key);
			} catch {
				// Best-effort
			}
		},
	};
}

const MEMORY_CACHE_MAX_ENTRIES = 500;

export function createMemoryCache(): Cache {
	const store = new Map<string, { value: unknown; expiresAt: number }>();

	return {
		id: "memory",
		async get<T>(key: string): Promise<T | null> {
			const hit = store.get(key);
			if (!hit) return null;
			if (hit.expiresAt <= Date.now()) {
				store.delete(key);
				return null;
			}
			return hit.value as T;
		},
		async put<T>(key: string, value: T, opts?: CachePutOptions): Promise<void> {
			if (store.size >= MEMORY_CACHE_MAX_ENTRIES) {
				// Evict expired entries first, then the oldest insertion
				const now = Date.now();
				for (const [k, v] of store) {
					if (v.expiresAt <= now) store.delete(k);
				}
				if (store.size >= MEMORY_CACHE_MAX_ENTRIES) {
					const oldest = store.keys().next().value;
					if (oldest !== undefined) store.delete(oldest);
				}
			}
			const ttl = (opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
			store.set(key, { value, expiresAt: Date.now() + ttl });
		},
		async delete(key: string): Promise<void> {
			store.delete(key);
		},
	};
}

export function createNoopCache(): Cache {
	return {
		id: "none",
		async get() {
			return null;
		},
		async put() {},
		async delete() {},
	};
}
