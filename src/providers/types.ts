/**
 * Provider plugin system — shared types
 *
 * Wave 1 of the provider-pluggable refactor. These are the contracts every
 * backend implementation (embedding, vector store, chat, cache) is built
 * against. Nothing in the existing runtime imports these yet — Wave 2 moves
 * the current Supabase / Workers AI / OpenAI code behind them.
 */

import type { ContentEntry, Category, Confidence } from "../lib/content";

export type { ContentEntry, Category, Confidence };

/**
 * Raw configuration bag handed to provider factories.
 *
 * It is a superset of the Worker `Env` and `process.env`: string-valued
 * settings plus the opaque Cloudflare bindings (`AI`, `CONTENT_CACHE`) that
 * some providers wrap. Bindings are typed `unknown` so this module stays free
 * of any Cloudflare-specific types.
 */
export type ProviderConfig = Record<string, string | undefined> & {
	/** Cloudflare Workers AI binding, when running inside a Worker. */
	AI?: unknown;
	/** Cloudflare KV namespace binding used for caching, when present. */
	CONTENT_CACHE?: unknown;
};

/**
 * Error raised when a provider cannot be selected or constructed. Carries the
 * offending provider id and the underlying cause for diagnostics.
 */
export class ProviderError extends Error {
	constructor(
		message: string,
		readonly provider: string,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "ProviderError";
	}
}
