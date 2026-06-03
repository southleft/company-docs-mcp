/**
 * ProviderRegistry — generic id → factory map for one provider kind.
 *
 * A "plugin" is simply a factory registered under an id. Selection happens by
 * id (from an env var), so adding a backend means: implement the interface,
 * register the factory, document the id. No core code changes.
 */

import { ProviderError } from "./types";
import type { ProviderConfig } from "./types";

/** Builds a provider instance from raw config. May read bindings/env vars. */
export type ProviderFactory<T> = (config: ProviderConfig) => T;

export class ProviderRegistry<T> {
	private readonly factories = new Map<string, ProviderFactory<T>>();

	/** @param kind Human-readable label used in error messages. */
	constructor(private readonly kind: string) {}

	/** Register a factory under `id`. Throws on duplicate ids. */
	register(id: string, factory: ProviderFactory<T>): this {
		if (this.factories.has(id)) {
			throw new ProviderError(
				`${this.kind} provider "${id}" is already registered`,
				id,
			);
		}
		this.factories.set(id, factory);
		return this;
	}

	has(id: string): boolean {
		return this.factories.has(id);
	}

	/** Registered ids, in insertion order. */
	ids(): string[] {
		return [...this.factories.keys()];
	}

	/** Construct the provider registered under `id`. */
	resolve(id: string, config: ProviderConfig): T {
		const factory = this.factories.get(id);
		if (!factory) {
			throw new ProviderError(
				`Unknown ${this.kind} provider "${id}". Registered: ${
					this.ids().join(", ") || "none"
				}`,
				id,
			);
		}
		try {
			return factory(config);
		} catch (err) {
			if (err instanceof ProviderError) throw err;
			throw new ProviderError(
				`Failed to create ${this.kind} provider "${id}"`,
				id,
				err,
			);
		}
	}
}
