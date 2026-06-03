/**
 * ServiceContainer — the resolved set of backends for one request/process.
 *
 * The router and handlers (Wave 2) take a ServiceContainer instead of reaching
 * for Supabase/Workers AI directly. Each host entry (Cloudflare, Node) builds
 * the container from its environment via `resolveContainer`.
 *
 * The four registries below are the plugin extension points. They are defined
 * here but intentionally empty in Wave 1 — concrete implementations register
 * themselves in Wave 2+. `resolveContainer` will throw a clear ProviderError
 * until a matching provider id has been registered.
 */

import { ProviderRegistry } from "./registry";
import type { ProviderConfig } from "./types";
import type { EmbeddingProvider } from "./embedding";
import type { VectorStore } from "./vector-store";
import type { ChatProvider } from "./chat";
import type { Cache } from "./cache";

export const embeddingRegistry = new ProviderRegistry<EmbeddingProvider>("embedding");
export const vectorStoreRegistry = new ProviderRegistry<VectorStore>("vector-store");
export const chatRegistry = new ProviderRegistry<ChatProvider>("chat");
export const cacheRegistry = new ProviderRegistry<Cache>("cache");

export interface ServiceContainer {
	embedder: EmbeddingProvider;
	vectorStore: VectorStore;
	chat: ChatProvider;
	cache: Cache;
}

/** Explicit provider-id overrides; any omitted field is auto-detected. */
export interface ContainerSelection {
	embedding?: string;
	vectorStore?: string;
	chat?: string;
	cache?: string;
}

/**
 * Resolve a full ServiceContainer from raw config plus optional explicit
 * selection. Defaults preserve today's behavior:
 *   - embedding: EMBEDDING_PROVIDER, else "openai" if OPENAI_API_KEY, else "workers-ai"
 *   - vectorStore: VECTOR_STORE, else "supabase"
 *   - chat: CHAT_PROVIDER, else "openai"
 *   - cache: CACHE, else "kv" if a CONTENT_CACHE binding exists, else "memory"
 */
export function resolveContainer(
	config: ProviderConfig,
	selection: ContainerSelection = {},
): ServiceContainer {
	const embeddingId =
		selection.embedding ??
		config.EMBEDDING_PROVIDER ??
		(config.OPENAI_API_KEY ? "openai" : "workers-ai");
	const vectorStoreId = selection.vectorStore ?? config.VECTOR_STORE ?? "supabase";
	const chatId = selection.chat ?? config.CHAT_PROVIDER ?? "openai";
	const cacheId =
		selection.cache ?? config.CACHE ?? (config.CONTENT_CACHE ? "kv" : "memory");

	return {
		embedder: embeddingRegistry.resolve(embeddingId, config),
		vectorStore: vectorStoreRegistry.resolve(vectorStoreId, config),
		chat: chatRegistry.resolve(chatId, config),
		cache: cacheRegistry.resolve(cacheId, config),
	};
}
