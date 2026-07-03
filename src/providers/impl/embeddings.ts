/**
 * Concrete EmbeddingProvider implementations (Wave 2).
 *
 * Thin adapters over the existing functions in ../../lib/embedding-provider —
 * no behavior change, just the plugin interface on top.
 */

import {
	PROVIDER_CONFIG,
	embedWithOpenAI,
	embedWithWorkersAI,
	embedWithWorkersAIRest,
	getCloudflareToken,
} from "../../lib/embedding-provider";
import type { EmbeddingProvider } from "../embedding";
import { ProviderError } from "../types";
import type { ProviderConfig } from "../types";

export function createOpenAIEmbedding(config: ProviderConfig): EmbeddingProvider {
	const apiKey = config.OPENAI_API_KEY;
	if (!apiKey) {
		throw new ProviderError(
			"OPENAI_API_KEY is required for the openai embedding provider",
			"openai",
		);
	}
	const { model, dimensions } = PROVIDER_CONFIG.openai;
	return {
		id: "openai",
		model,
		dimensions,
		embed: (text) => embedWithOpenAI(text, apiKey),
	};
}

export function createWorkersAIEmbedding(config: ProviderConfig): EmbeddingProvider {
	const { model, dimensions } = PROVIDER_CONFIG["workers-ai"];
	const base = { id: "workers-ai", model, dimensions } as const;

	// Inside a Worker: use the zero-latency AI binding
	if (config.AI) {
		return { ...base, embed: (text) => embedWithWorkersAI(text, config.AI) };
	}

	// Outside a Worker (CLI/scripts): fall back to the REST API
	const accountId = config.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = config.CLOUDFLARE_API_TOKEN ?? getCloudflareToken() ?? undefined;
	if (accountId && apiToken) {
		return {
			...base,
			embed: (text) => embedWithWorkersAIRest(text, accountId, apiToken),
		};
	}

	throw new ProviderError(
		"workers-ai embedding requires an AI binding (in a Worker) or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (CLI)",
		"workers-ai",
	);
}
