#!/usr/bin/env tsx
/**
 * Ingest content entries into Supabase with vector embeddings.
 *
 * Default behavior is incremental upsert — only entries whose content has
 * changed (based on a SHA-256 hash) are re-embedded and updated.
 *
 * Usage:
 *   npm run ingest:supabase              # incremental upsert
 *   npm run ingest:supabase -- --clear   # wipe + re-ingest everything
 *   npm run ingest:supabase -- --dry-run # preview what would happen
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { ContentEntry } from "../../src/lib/content";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const MAX_EMBEDDING_INPUT = 8191;
const BATCH_SIZE = 5;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Pure helpers (no external state)
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
	const val = process.env[key];
	if (!val) {
		console.error(`Missing required environment variable: ${key}`);
		process.exit(1);
	}
	return val;
}

/** SHA-256 content hash for change detection */
function contentHash(entry: ContentEntry): string {
	return createHash("sha256")
		.update(`${entry.title}\n${entry.content}`)
		.digest("hex");
}

/** Split text into sentence-aware chunks */
function chunkText(text: string, chunkSize = 1000): string[] {
	const chunks: string[] = [];
	const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
	let current = "";

	for (const sentence of sentences) {
		if ((current + sentence).length > chunkSize && current.length > 0) {
			chunks.push(current.trim());
			current = sentence;
		} else {
			current += ` ${sentence}`;
		}
	}
	if (current.trim()) chunks.push(current.trim());

	return chunks.length > 0 ? chunks : [text];
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

export async function main() {
	// Load .env at call time so other CLI commands don't trigger side effects
	await import("dotenv/config");

	// Parse CLI flags
	const args = new Set(process.argv.slice(2));
	const FLAG_CLEAR = args.has("--clear");
	const FLAG_DRY_RUN = args.has("--dry-run");
	const FLAG_VERBOSE = args.has("--verbose") || args.has("-v");

	if (args.has("--help") || args.has("-h")) {
		console.log(`
Usage: npx company-docs ingest supabase [options]

Options:
  --clear      Delete all existing data before ingesting (destructive!)
  --dry-run    Preview changes without writing to the database
  --verbose    Show detailed per-entry progress
  --help       Show this help message

By default the script performs an incremental upsert — only entries whose
content has changed since the last ingestion are re-embedded and uploaded.
`);
		process.exit(0);
	}

	// Init clients
	const SUPABASE_URL = requireEnv("SUPABASE_URL");
	const SUPABASE_KEY =
		process.env.SUPABASE_SERVICE_KEY || requireEnv("SUPABASE_ANON_KEY");
	const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");

	const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
	const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

	// -- Helpers that close over openai / FLAG_VERBOSE -----------------------

	async function withRetry<T>(
		fn: () => Promise<T>,
		label: string,
	): Promise<T> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				return await fn();
			} catch (err: any) {
				lastError = err;
				const isRetryable =
					err?.status === 429 ||
					err?.code === "ECONNRESET" ||
					err?.code === "ETIMEDOUT" ||
					err?.message?.includes("rate limit") ||
					err?.message?.includes("timeout");
				if (!isRetryable || attempt === MAX_RETRIES) throw err;

				const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
				if (FLAG_VERBOSE)
					console.log(
						`  Retry ${attempt}/${MAX_RETRIES} for ${label} in ${delay}ms`,
					);
				await new Promise((r) => setTimeout(r, delay));
			}
		}
		throw lastError;
	}

	async function generateEmbedding(text: string, label: string): Promise<number[]> {
		const input = text.slice(0, MAX_EMBEDDING_INPUT);
		const response = await withRetry(
			() => openai.embeddings.create({ model: EMBEDDING_MODEL, input }),
			label,
		);
		const embedding = response.data[0].embedding;

		if (embedding.length !== EMBEDDING_DIM) {
			throw new Error(
				`Embedding for "${label}" has ${embedding.length} dimensions (expected ${EMBEDDING_DIM})`,
			);
		}

		return embedding;
	}

	async function loadEntriesFromDisk(): Promise<ContentEntry[]> {
		const entriesDir = path.join(process.cwd(), "content", "entries");
		const entries: ContentEntry[] = [];

		try {
			const files = await fs.readdir(entriesDir);
			const jsonFiles = files.filter((f) => f.endsWith(".json"));

			for (const file of jsonFiles) {
				try {
					const raw = await fs.readFile(path.join(entriesDir, file), "utf-8");
					const entry = JSON.parse(raw) as ContentEntry;
					if (entry?.id && entry?.title && entry?.content) {
						entries.push(entry);
					} else if (FLAG_VERBOSE) {
						console.log(`  [skip] ${file} — missing required fields`);
					}
				} catch (err: any) {
					console.error(`  [warn] Failed to parse ${file}: ${err.message}`);
				}
			}
		} catch {
			console.error(`No content/entries/ directory found at ${entriesDir}`);
			console.error("Run an ingestion command first (e.g., npm run ingest:markdown)");
			process.exit(1);
		}

		return entries;
	}

	// -- Main pipeline -------------------------------------------------------

	console.log("Starting Supabase vector ingestion");
	if (FLAG_DRY_RUN) console.log("  DRY RUN — no writes will be performed");
	if (FLAG_CLEAR) console.log("  CLEAR mode — existing data will be deleted");
	console.log();

	// 1. Check that the target table exists
	const { count: existingCount, error: countError } = await supabase
		.from("content_entries")
		.select("*", { count: "exact", head: true });

	if (countError || existingCount === null) {
		console.error('Table "content_entries" does not exist or is inaccessible.');
		console.error(
			"Run the SQL from database/schema.sql in your Supabase dashboard first.",
		);
		process.exit(1);
	}

	console.log(`Existing documents in database: ${existingCount}`);

	// 2. Optionally clear existing data (opt-in only)
	if (FLAG_CLEAR && existingCount > 0) {
		if (FLAG_DRY_RUN) {
			console.log(
				`[dry-run] Would delete ${existingCount} entries and their chunks`,
			);
		} else {
			console.log("Deleting existing data...");
			await supabase.from("content_chunks").delete().neq("id", 0);
			await supabase.from("content_entries").delete().neq("id", "");
			console.log("Existing data cleared.");
		}
	}

	// 3. Fetch existing content hashes for incremental mode
	let existingHashes: Map<string, string> = new Map();
	if (!FLAG_CLEAR) {
		const { data: rows } = await supabase
			.from("content_entries")
			.select("id, content_hash");
		if (rows) {
			for (const row of rows) {
				if (row.content_hash) existingHashes.set(row.id, row.content_hash);
			}
		}
	}

	// 4. Load content from local entries (filesystem-based)
	console.log("Loading content entries from content/entries/...");
	const entries = await loadEntriesFromDisk();
	console.log(`Found ${entries.length} entries to evaluate\n`);

	// 5. Determine which entries need processing
	const toProcess: ContentEntry[] = [];
	let skipped = 0;

	for (const entry of entries) {
		const hash = contentHash(entry);
		if (!FLAG_CLEAR && existingHashes.get(entry.id) === hash) {
			if (FLAG_VERBOSE) console.log(`  [skip] ${entry.title} (unchanged)`);
			skipped++;
		} else {
			toProcess.push(entry);
		}
	}

	console.log(
		`${toProcess.length} entries to process, ${skipped} unchanged (skipped)\n`,
	);

	if (toProcess.length === 0) {
		console.log("Nothing to do — all entries are up to date.");
		return;
	}

	if (FLAG_DRY_RUN) {
		console.log("[dry-run] Entries that would be processed:");
		for (const entry of toProcess) {
			const chunks = chunkText(entry.content);
			console.log(`  - ${entry.title} (${chunks.length} chunks)`);
		}
		const embeddings = toProcess.reduce(
			(n, e) => n + 1 + chunkText(e.content).length,
			0,
		);
		console.log(`\n[dry-run] Estimated embedding API calls: ${embeddings}`);
		return;
	}

	// 6. Process entries in batches
	let successful = 0;
	let failed = 0;

	for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
		const batch = toProcess.slice(i, i + BATCH_SIZE);

		await Promise.all(
			batch.map(async (entry) => {
				try {
					const hash = contentHash(entry);
					const chunks = chunkText(entry.content);

					// Generate main embedding
					const mainEmbedding = await generateEmbedding(
						`${entry.title}\n\n${entry.content}`,
						entry.title,
					);

					const entryRecord = {
						id: entry.id,
						title: entry.title,
						content: entry.content,
						source_type: entry.source?.type || "unknown",
						source_location: entry.source?.location || entry.title,
						category: entry.metadata?.category || null,
						system_name: (entry.metadata as any)?.system_name || null,
						tags: entry.metadata?.tags || [],
						confidence: entry.metadata?.confidence || "medium",
						embedding: mainEmbedding,
						metadata: entry.metadata || {},
						content_hash: hash,
						ingested_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};

					const { error: entryError } = await supabase
						.from("content_entries")
						.upsert(entryRecord);

					if (entryError) throw entryError;

					// Delete old chunks for this entry before inserting new ones
					await supabase
						.from("content_chunks")
						.delete()
						.eq("entry_id", entry.id);

					// Insert chunks (embed each one)
					for (let ci = 0; ci < chunks.length; ci++) {
						const chunkEmbedding = await generateEmbedding(
							chunks[ci],
							`${entry.title} chunk ${ci}`,
						);

						const { error: chunkError } = await supabase
							.from("content_chunks")
							.insert({
								entry_id: entry.id,
								chunk_index: ci,
								chunk_text: chunks[ci],
								embedding: chunkEmbedding,
								metadata: { chunk_size: chunks[ci].length },
								created_at: new Date().toISOString(),
							});

						if (chunkError) {
							console.error(
								`  Chunk ${ci} insert error for "${entry.title}":`,
								chunkError.message,
							);
						}
					}

					console.log(`  [ok] ${entry.title} (${chunks.length} chunks)`);
					successful++;
				} catch (error: any) {
					console.error(`  [fail] ${entry.title}: ${error.message}`);
					failed++;
				}
			}),
		);

		const processed = Math.min(i + BATCH_SIZE, toProcess.length);
		console.log(`Progress: ${processed}/${toProcess.length}`);
	}

	// 7. Summary
	console.log("\nResults:");
	console.log(`  Processed: ${successful}`);
	console.log(`  Skipped (unchanged): ${skipped}`);
	console.log(`  Failed: ${failed}`);

	const { count: finalCount } = await supabase
		.from("content_entries")
		.select("*", { count: "exact", head: true });

	console.log(`  Total documents in database: ${finalCount}`);

	if (failed > 0) {
		process.exit(1);
	}
}

// Run directly when not invoked via the CLI router
if (!process.env.__COMPANY_DOCS_CLI) {
	main().catch((err) => {
		console.error("Fatal error:", err);
		process.exit(1);
	});
}
