/**
 * Default provider registration (Wave 2).
 *
 * Registers the built-in backends under their stable ids. Importing the
 * providers barrel (./index) calls this automatically, so runtime code can
 * `resolveContainer(env)` without ceremony. Idempotent — safe to call from
 * multiple entry points (Worker, CLI, tests).
 */

import {
	embeddingRegistry,
	vectorStoreRegistry,
	chatRegistry,
	cacheRegistry,
} from "./container";
import { createOpenAIEmbedding, createWorkersAIEmbedding } from "./impl/embeddings";
import { createSupabaseVectorStore } from "./impl/supabase-vector-store";
import { createOpenAIChat } from "./impl/openai-chat";
import { createKvCache, createMemoryCache, createNoopCache } from "./impl/caches";

let registered = false;

export function registerDefaultProviders(): void {
	if (registered) return;
	registered = true;

	embeddingRegistry.register("openai", createOpenAIEmbedding);
	embeddingRegistry.register("workers-ai", createWorkersAIEmbedding);

	vectorStoreRegistry.register("supabase", createSupabaseVectorStore);

	chatRegistry.register("openai", createOpenAIChat);

	cacheRegistry.register("kv", createKvCache);
	cacheRegistry.register("memory", createMemoryCache);
	cacheRegistry.register("none", createNoopCache);
}
