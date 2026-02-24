/**
 * Embedding Provider Abstraction
 *
 * Supports two embedding backends:
 *   - workers-ai  (default) — Cloudflare Workers AI, BGE-large-en-v1.5, 1024 dimensions
 *   - openai                — OpenAI text-embedding-3-small, 1536 dimensions
 *
 * Provider detection priority:
 *   1. Explicit EMBEDDING_PROVIDER env var
 *   2. If OPENAI_API_KEY is present → "openai" (backward compatibility)
 *   3. Default → "workers-ai"
 *
 * Cloudflare token resolution (for CLI / REST API usage):
 *   1. Explicit CLOUDFLARE_API_TOKEN env var
 *   2. OAuth token from wrangler config (~/.wrangler/config/default.toml)
 */

// node:fs, node:path, node:os are imported lazily inside getCloudflareToken()
// to avoid breaking Cloudflare Worker environments where these modules may not be available.

export type EmbeddingProvider = "workers-ai" | "openai";

export const PROVIDER_CONFIG = {
	"workers-ai": {
		model: "@cf/baai/bge-large-en-v1.5",
		dimensions: 1024,
		maxInputChars: 2000, // BGE models have a 512-token context window (~2000 chars)
	},
	openai: {
		model: "text-embedding-3-small",
		dimensions: 1536,
		maxInputChars: 8191,
	},
} as const;

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

export function detectProvider(env: {
	EMBEDDING_PROVIDER?: string;
	OPENAI_API_KEY?: string;
}): EmbeddingProvider {
	const explicit = env.EMBEDDING_PROVIDER?.toLowerCase();
	if (explicit === "openai" || explicit === "workers-ai") {
		return explicit;
	}
	// Backward compatibility: existing users with OPENAI_API_KEY keep using OpenAI
	return env.OPENAI_API_KEY ? "openai" : "workers-ai";
}

// ---------------------------------------------------------------------------
// Cloudflare token resolution (env var or wrangler OAuth)
// ---------------------------------------------------------------------------

/**
 * Resolve a Cloudflare API token for REST API calls.
 *
 * Priority:
 *   1. CLOUDFLARE_API_TOKEN environment variable (explicit, always wins)
 *   2. OAuth token from wrangler's local config file (written by `npx wrangler login`)
 *
 * Returns null when running inside a Worker (no filesystem) or when neither
 * source provides a token.
 */
export function getCloudflareToken(): string | null {
	// 1. Explicit env var takes priority
	const envToken = process.env.CLOUDFLARE_API_TOKEN;
	if (envToken) {
		return envToken;
	}

	// 2. Try reading the wrangler OAuth config file
	//    In a Worker environment, filesystem modules may not be available,
	//    so we lazy-import and wrap everything in a try/catch.
	try {
		const fs = require("node:fs") as typeof import("node:fs");
		const configPath = getWranglerConfigPath();
		if (!configPath) return null;

		if (!fs.existsSync(configPath)) return null;

		const content = fs.readFileSync(configPath, "utf-8");

		// Parse oauth_token from the simple TOML key-value format
		const tokenMatch = content.match(/^oauth_token\s*=\s*"([^"]+)"/m);
		if (!tokenMatch) return null;

		const oauthToken = tokenMatch[1];

		// Optionally check expiration
		const expiryMatch = content.match(/^expiration_time\s*=\s*"([^"]+)"/m);
		if (expiryMatch) {
			const expiryDate = new Date(expiryMatch[1]);
			if (expiryDate.getTime() < Date.now()) {
				console.warn(
					"Warning: wrangler OAuth token has expired. Run `npx wrangler login` to refresh it.",
				);
				// Still return the token -- Cloudflare may accept slightly-expired tokens
				// and the actual API call will give a clear 401 if truly expired.
			}
		}

		console.log("Using wrangler OAuth token from local config.");
		return oauthToken;
	} catch {
		// Filesystem not available (Worker environment) or other read error
		return null;
	}
}

/**
 * Return the platform-specific path to wrangler's config file.
 */
function getWranglerConfigPath(): string | null {
	const os = require("node:os") as typeof import("node:os");
	const path = require("node:path") as typeof import("node:path");

	const platform = os.platform();

	if (platform === "darwin") {
		return path.join(
			os.homedir(),
			"Library",
			"Preferences",
			".wrangler",
			"config",
			"default.toml",
		);
	}

	if (platform === "win32") {
		const appData = process.env.APPDATA;
		if (!appData) return null;
		return path.join(appData, ".wrangler", "config", "default.toml");
	}

	// Linux and other Unix-like systems
	return path.join(
		os.homedir(),
		".config",
		".wrangler",
		"config",
		"default.toml",
	);
}

// ---------------------------------------------------------------------------
// Workers AI — in-Worker binding (zero network latency)
// ---------------------------------------------------------------------------

export async function embedWithWorkersAI(
	text: string,
	ai: unknown,
): Promise<number[]> {
	const config = PROVIDER_CONFIG["workers-ai"];
	const input = text.slice(0, config.maxInputChars);
	const result = await (ai as any).run(config.model, { text: [input] });
	const embedding: number[] = result.data[0];
	if (!embedding || embedding.length !== config.dimensions) {
		throw new Error(
			`Workers AI returned ${embedding?.length ?? 0} dimensions (expected ${config.dimensions})`,
		);
	}
	return embedding;
}

// ---------------------------------------------------------------------------
// Workers AI — REST API (for CLI / non-Worker contexts)
// ---------------------------------------------------------------------------

export async function embedWithWorkersAIRest(
	text: string,
	accountId: string,
	apiToken: string,
): Promise<number[]> {
	const config = PROVIDER_CONFIG["workers-ai"];
	const input = text.slice(0, config.maxInputChars);

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${config.model}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ text: [input] }),
		},
	);

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`Workers AI API error (${response.status}): ${body.slice(0, 300)}`,
		);
	}

	const data = (await response.json()) as any;
	if (!data.success || !data.result?.data?.[0]) {
		throw new Error(
			`Workers AI returned invalid response: ${JSON.stringify(data.errors || [])}`,
		);
	}

	const embedding: number[] = data.result.data[0];
	if (embedding.length !== config.dimensions) {
		throw new Error(
			`Workers AI returned ${embedding.length} dimensions (expected ${config.dimensions})`,
		);
	}
	return embedding;
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

export async function embedWithOpenAI(
	text: string,
	apiKey: string,
): Promise<number[]> {
	const config = PROVIDER_CONFIG.openai;
	const OpenAI = (await import("openai")).default;
	const openai = new OpenAI({ apiKey });

	const response = await openai.embeddings.create({
		model: config.model,
		input: text.slice(0, config.maxInputChars),
	});

	const embedding = response.data[0].embedding;
	if (embedding.length !== config.dimensions) {
		throw new Error(
			`OpenAI returned ${embedding.length} dimensions (expected ${config.dimensions})`,
		);
	}
	return embedding;
}
