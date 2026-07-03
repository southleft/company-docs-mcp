/**
 * Wave 2 provider implementation tests: default registration, cache behavior,
 * and the OpenAI chat message translation.
 */

import { describe, it, expect } from "vitest";
import {
	resolveContainer,
	registerDefaultProviders,
	embeddingRegistry,
	vectorStoreRegistry,
	chatRegistry,
	cacheRegistry,
	ProviderError,
} from "../../src/providers";
import { createMemoryCache, createNoopCache } from "../../src/providers/impl/caches";
import { toOpenAIMessage } from "../../src/providers/impl/openai-chat";

describe("registerDefaultProviders", () => {
	it("registers the built-in provider ids (via barrel import side effect)", () => {
		expect(embeddingRegistry.has("openai")).toBe(true);
		expect(embeddingRegistry.has("workers-ai")).toBe(true);
		expect(vectorStoreRegistry.has("supabase")).toBe(true);
		expect(chatRegistry.has("openai")).toBe(true);
		expect(cacheRegistry.has("kv")).toBe(true);
		expect(cacheRegistry.has("memory")).toBe(true);
		expect(cacheRegistry.has("none")).toBe(true);
	});

	it("is idempotent", () => {
		expect(() => registerDefaultProviders()).not.toThrow();
	});

	it("selects openai embedding when OPENAI_API_KEY is present", () => {
		const container = resolveContainer({ OPENAI_API_KEY: "sk-test" });
		expect(container.embedder.id).toBe("openai");
		expect(container.embedder.dimensions).toBe(1536);
	});

	it("falls back to memory cache without a CONTENT_CACHE binding", () => {
		const container = resolveContainer({});
		expect(container.cache.id).toBe("memory");
	});

	it("fails with a clear error when the supabase store is unconfigured", () => {
		const container = resolveContainer({});
		expect(() => container.vectorStore).toThrow(ProviderError);
		expect(() => container.vectorStore).toThrow(/SUPABASE_URL/);
	});
});

describe("memory cache", () => {
	it("stores and retrieves values", async () => {
		const cache = createMemoryCache();
		await cache.put("k", { a: 1 });
		expect(await cache.get("k")).toEqual({ a: 1 });
	});

	it("expires entries after their TTL", async () => {
		const cache = createMemoryCache();
		await cache.put("k", "v", { ttlSeconds: -1 }); // already expired
		expect(await cache.get("k")).toBeNull();
	});

	it("deletes entries", async () => {
		const cache = createMemoryCache();
		await cache.put("k", "v");
		await cache.delete!("k");
		expect(await cache.get("k")).toBeNull();
	});
});

describe("noop cache", () => {
	it("always misses", async () => {
		const cache = createNoopCache();
		await cache.put("k", "v");
		expect(await cache.get("k")).toBeNull();
	});
});

describe("toOpenAIMessage", () => {
	it("maps tool results to tool_call_id form", () => {
		expect(
			toOpenAIMessage({ role: "tool", content: "result", toolCallId: "call_1" }),
		).toEqual({ role: "tool", tool_call_id: "call_1", content: "result" });
	});

	it("maps assistant tool calls to the function-call shape", () => {
		const msg = toOpenAIMessage({
			role: "assistant",
			content: null,
			toolCalls: [{ id: "call_1", name: "search", arguments: '{"q":"x"}' }],
		});
		expect(msg).toEqual({
			role: "assistant",
			content: null,
			tool_calls: [
				{
					id: "call_1",
					type: "function",
					function: { name: "search", arguments: '{"q":"x"}' },
				},
			],
		});
	});

	it("passes plain messages through", () => {
		expect(toOpenAIMessage({ role: "user", content: "hi" })).toEqual({
			role: "user",
			content: "hi",
		});
	});
});
