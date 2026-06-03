import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../../src/providers/registry";
import {
	resolveContainer,
	embeddingRegistry,
	vectorStoreRegistry,
	chatRegistry,
	cacheRegistry,
} from "../../src/providers/container";
import { ProviderError } from "../../src/providers/types";
import type { EmbeddingProvider } from "../../src/providers/embedding";
import type { VectorStore } from "../../src/providers/vector-store";
import type { ChatProvider } from "../../src/providers/chat";
import type { Cache } from "../../src/providers/cache";

describe("ProviderRegistry", () => {
	it("registers and resolves a factory by id", () => {
		const reg = new ProviderRegistry<{ value: number }>("test");
		reg.register("a", () => ({ value: 1 }));
		expect(reg.has("a")).toBe(true);
		expect(reg.resolve("a", {}).value).toBe(1);
	});

	it("passes config through to the factory", () => {
		const reg = new ProviderRegistry<{ key?: string }>("test");
		reg.register("a", (config) => ({ key: config.SOME_KEY }));
		expect(reg.resolve("a", { SOME_KEY: "xyz" }).key).toBe("xyz");
	});

	it("throws on duplicate registration", () => {
		const reg = new ProviderRegistry<number>("test");
		reg.register("a", () => 1);
		expect(() => reg.register("a", () => 2)).toThrow(ProviderError);
	});

	it("throws a helpful error for an unknown id", () => {
		const reg = new ProviderRegistry<number>("test");
		reg.register("a", () => 1);
		expect(() => reg.resolve("missing", {})).toThrow(/Unknown test provider "missing"/);
	});

	it("wraps factory errors in a ProviderError", () => {
		const reg = new ProviderRegistry<number>("test");
		reg.register("boom", () => {
			throw new Error("kaboom");
		});
		try {
			reg.resolve("boom", {});
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(ProviderError);
			expect((err as ProviderError).cause).toBeInstanceOf(Error);
		}
	});

	it("lists registered ids in insertion order", () => {
		const reg = new ProviderRegistry<number>("test");
		reg.register("first", () => 1);
		reg.register("second", () => 2);
		expect(reg.ids()).toEqual(["first", "second"]);
	});
});

describe("resolveContainer", () => {
	// Register minimal fakes into the real (module-singleton) registries.
	const embedder: EmbeddingProvider = {
		id: "fake-embed",
		model: "fake",
		dimensions: 8,
		embed: async () => new Array(8).fill(0),
	};
	const store: VectorStore = {
		id: "fake-store",
		search: async () => [],
		getByCategory: async () => [],
		getAllTags: async () => [],
		upsertEntry: async () => {},
		healthCheck: async () => true,
	};
	const chat: ChatProvider = {
		id: "fake-chat",
		model: "fake",
		chat: async () => ({ content: "ok" }),
	};
	const cache: Cache = {
		id: "fake-cache",
		get: async () => null,
		put: async () => {},
	};

	embeddingRegistry.register("fake-embed", () => embedder);
	vectorStoreRegistry.register("fake-store", () => store);
	chatRegistry.register("fake-chat", () => chat);
	cacheRegistry.register("fake-cache", () => cache);

	it("resolves all four seams from explicit selection", () => {
		const container = resolveContainer(
			{},
			{
				embedding: "fake-embed",
				vectorStore: "fake-store",
				chat: "fake-chat",
				cache: "fake-cache",
			},
		);
		expect(container.embedder.id).toBe("fake-embed");
		expect(container.vectorStore.id).toBe("fake-store");
		expect(container.chat.id).toBe("fake-chat");
		expect(container.cache.id).toBe("fake-cache");
	});

	it("honors config-based selection over defaults", () => {
		const container = resolveContainer({
			EMBEDDING_PROVIDER: "fake-embed",
			VECTOR_STORE: "fake-store",
			CHAT_PROVIDER: "fake-chat",
			CACHE: "fake-cache",
		});
		expect(container.embedder.id).toBe("fake-embed");
	});

	it("throws when a default-selected provider is not registered", () => {
		// Default vectorStore id is "supabase", which is not registered in Wave 1.
		expect(() => resolveContainer({}, { embedding: "fake-embed" })).toThrow(
			ProviderError,
		);
	});
});
