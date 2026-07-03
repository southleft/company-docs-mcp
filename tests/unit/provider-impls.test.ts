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

describe("anthropic chat translation", async () => {
	const { toAnthropicMessages, toAnthropicToolChoice } = await import(
		"../../src/providers/impl/anthropic-chat"
	);

	it("lifts system messages into the top-level system param", () => {
		const { system, messages } = toAnthropicMessages([
			{ role: "system", content: "You are a docs assistant." },
			{ role: "user", content: "hi" },
		]);
		expect(system).toBe("You are a docs assistant.");
		expect(messages).toEqual([{ role: "user", content: "hi" }]);
	});

	it("maps assistant tool calls to tool_use blocks with parsed input", () => {
		const { messages } = toAnthropicMessages([
			{
				role: "assistant",
				content: null,
				toolCalls: [{ id: "toolu_1", name: "search", arguments: '{"q":"x"}' }],
			},
		]);
		expect(messages).toEqual([
			{
				role: "assistant",
				content: [{ type: "tool_use", id: "toolu_1", name: "search", input: { q: "x" } }],
			},
		]);
	});

	it("merges consecutive tool results into one user message", () => {
		const { messages } = toAnthropicMessages([
			{ role: "tool", content: "r1", toolCallId: "toolu_1" },
			{ role: "tool", content: "r2", toolCallId: "toolu_2" },
		]);
		expect(messages).toHaveLength(1);
		expect(messages[0].role).toBe("user");
		expect(messages[0].content).toEqual([
			{ type: "tool_result", tool_use_id: "toolu_1", content: "r1" },
			{ type: "tool_result", tool_use_id: "toolu_2", content: "r2" },
		]);
	});

	it("maps neutral toolChoice to Anthropic's union", () => {
		expect(toAnthropicToolChoice("required")).toEqual({
			type: "any",
			disable_parallel_tool_use: true,
		});
		expect(toAnthropicToolChoice("none")).toEqual({ type: "none" });
		expect(toAnthropicToolChoice(undefined)).toBeUndefined();
	});
});

describe("anthropic chat registration", () => {
	it("resolves via CHAT_PROVIDER=anthropic", () => {
		const container = resolveContainer({
			CHAT_PROVIDER: "anthropic",
			ANTHROPIC_API_KEY: "sk-ant-test",
		});
		expect(container.chat.id).toBe("anthropic");
		expect(container.chat.model).toBe("claude-opus-4-8");
	});

	it("auto-selects anthropic when only ANTHROPIC_API_KEY is set", () => {
		const container = resolveContainer({ ANTHROPIC_API_KEY: "sk-ant-test" });
		expect(container.chat.id).toBe("anthropic");
	});
});
