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
 */

export type EmbeddingProvider = 'workers-ai' | 'openai';

export const PROVIDER_CONFIG = {
	'workers-ai': {
		model: '@cf/baai/bge-large-en-v1.5',
		dimensions: 1024,
		maxInputChars: 2000, // BGE models have a 512-token context window (~2000 chars)
	},
	openai: {
		model: 'text-embedding-3-small',
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
	if (explicit === 'openai' || explicit === 'workers-ai') {
		return explicit;
	}
	// Backward compatibility: existing users with OPENAI_API_KEY keep using OpenAI
	return env.OPENAI_API_KEY ? 'openai' : 'workers-ai';
}

// ---------------------------------------------------------------------------
// Workers AI — in-Worker binding (zero network latency)
// ---------------------------------------------------------------------------

export async function embedWithWorkersAI(
	text: string,
	ai: unknown,
): Promise<number[]> {
	const config = PROVIDER_CONFIG['workers-ai'];
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
	const config = PROVIDER_CONFIG['workers-ai'];
	const input = text.slice(0, config.maxInputChars);

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${config.model}`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ text: [input] }),
		},
	);

	if (!response.ok) {
		const body = await response.text().catch(() => '');
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
	const OpenAI = (await import('openai')).default;
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
